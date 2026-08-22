import torch
import numpy as np
from typing import Tuple, Dict, Any, Optional
from player_pool import GLOBAL_POOL, POSITION_MULTIPLIERS, SLOT_TO_POSITION
from config import AUCTION_LOTS_PER_DRAFTER, AUCTION_BID_INCREMENTS
from obs_auction import build_auction_obs


class BatchedAuctionEnv:
    def __init__(self, batch_size: int = 4096, device: str = "cpu"):
        self.B = batch_size
        self.device = torch.device(device)
        self.pool = GLOBAL_POOL

        # Load pool data to tensors
        self._abilities = torch.tensor(self.pool.abilities, device=self.device)
        self._derived_prices = torch.tensor(self.pool.derived_prices, device=self.device)
        self._opening_bids = torch.tensor(self.pool.opening_bids, device=self.device)
        self._position_ids = torch.tensor(self.pool.position_ids, device=self.device)

        # Position multipliers
        self._pos_mults = torch.zeros(10, device=self.device)
        for pos, mult in POSITION_MULTIPLIERS.items():
            self._pos_mults[self.pool.position_to_id[pos]] = mult

        # Target slot counts per position (for a 4-2-3-1: 1 for everything except 2 for CB)
        self._slot_counts = torch.ones(10, device=self.device, dtype=torch.int64)
        self._slot_counts[self.pool.position_to_id["CB"]] = 2

        # -------------------------------------------------------------------
        # Pre-computed scope masks (numpy, for fast lot-list building)
        # -------------------------------------------------------------------
        self._scope_np_all = self.pool.get_scope_mask("all")           # [P] bool
        self._scope_np_top5 = self.pool.get_scope_mask("top5")         # [P] bool

        from config import TOP_5_LEAGUES
        self._TOP_5_LEAGUES = TOP_5_LEAGUES
        self._league_masks_np: Dict[str, np.ndarray] = {}
        for lg in TOP_5_LEAGUES:
            self._league_masks_np[lg] = self.pool.get_scope_mask("single_league", lg)

        # Torch versions of scope masks
        self._scope_t_all = torch.tensor(self._scope_np_all, dtype=torch.bool, device=self.device)
        self._scope_t_top5 = torch.tensor(self._scope_np_top5, dtype=torch.bool, device=self.device)
        self._scope_t_leagues: Dict[str, torch.Tensor] = {
            lg: torch.tensor(m, dtype=torch.bool, device=self.device)
            for lg, m in self._league_masks_np.items()
        }

        # numpy position_ids for lot building
        self._pos_ids_np = self.pool.position_ids  # [P] int32

        # Budgets per scope (scalar, pre-computed)
        self._budget_all = float(self.pool.calculate_auction_budget(np.where(self._scope_np_all)[0]))
        self._budget_top5 = float(self.pool.calculate_auction_budget(np.where(self._scope_np_top5)[0]))
        self._budget_leagues: Dict[str, float] = {
            lg: float(self.pool.calculate_auction_budget(np.where(m)[0]))
            for lg, m in self._league_masks_np.items()
        }

        # Positions and their slots for lot building
        self._lot_slots = {
            "GK": 1, "LB": 1, "CB": 2, "RB": 1,
            "CDM": 1, "CM": 1, "LW": 1, "AMF": 1, "RW": 1, "ST": 1
        }

        # State tensors
        self.N = torch.zeros(self.B, dtype=torch.int64, device=self.device)
        self.active_envs = torch.zeros(self.B, dtype=torch.bool, device=self.device)
        self.budgets = torch.zeros((self.B, 5), dtype=torch.float32, device=self.device)
        self.squad_best2 = torch.zeros((self.B, 5, 10, 2), dtype=torch.float32, device=self.device)
        self.lots = torch.zeros((self.B, 15 * 5), dtype=torch.int64, device=self.device) - 1
        self.lot_idx = torch.zeros(self.B, dtype=torch.int64, device=self.device)
        self.current_price = torch.zeros(self.B, dtype=torch.float32, device=self.device)
        self.high_bidder = torch.zeros(self.B, dtype=torch.int64, device=self.device) - 1
        self.round_idx = torch.zeros(self.B, dtype=torch.int64, device=self.device)

        self.lots_revealed = torch.zeros((self.B, 10), dtype=torch.int64, device=self.device)
        self.lots_sold = torch.zeros((self.B, 10), dtype=torch.int64, device=self.device)
        self.sold_mask = torch.zeros((self.B, self.pool.player_count), dtype=torch.bool, device=self.device)
        self.scope_mask = torch.zeros((self.B, self.pool.player_count), dtype=torch.bool, device=self.device)

        self.prev_phi = torch.zeros((self.B, 5), dtype=torch.float32, device=self.device)
        self.last_projected_scores = torch.zeros((self.B, 5), dtype=torch.float32, device=self.device)

        # Precompute cheapest eligible lookup structuresning bid ascending
        self._sorted_by_bid = torch.argsort(self._opening_bids)

        self.reset_all()

    # ------------------------------------------------------------------
    # _build_lots_batched — numpy, one call for all R reset envs
    # ------------------------------------------------------------------
    def _build_lots_batched(
        self,
        scope_masks_np: np.ndarray,   # [R, P] bool
        n_vals_np: np.ndarray,         # [R] int
        lot_tensor: torch.Tensor,      # [B, 75]
        reset_indices: np.ndarray,     # [R] env indices
    ):
        R = len(reset_indices)
        P = self.pool.player_count
        abilities_np = self.pool.abilities    # [P] float32
        pos_ids_np = self._pos_ids_np          # [P] int32
        max_lots = AUCTION_LOTS_PER_DRAFTER * 5  # 75

        out = np.full((R, max_lots), -1, dtype=np.int64)

        pos_order = ["GK", "LB", "CB", "RB", "CDM", "CM", "LW", "AMF", "RW", "ST"]
        pos_id_order = np.array([self.pool.position_to_id[p] for p in pos_order], dtype=np.int32)
        pos_slots_order = np.array([self._lot_slots[p] for p in pos_order], dtype=np.int32)

        available = scope_masks_np.copy()  # [R, P]
        write_pos = np.zeros(R, dtype=np.int64)

        for pi, (pos, pid, base_count) in enumerate(
            zip(pos_order, pos_id_order, pos_slots_order)
        ):
            counts = (base_count * n_vals_np).astype(np.int64)  # [R]
            pos_mask = (pos_ids_np == pid)                        # [P]
            pos_player_indices = np.where(pos_mask)[0]            # [P_pos]
            if len(pos_player_indices) == 0:
                continue

            valid_in_pos = available[:, pos_player_indices]  # [R, P_pos]
            ab_in_pos = abilities_np[pos_player_indices]      # [P_pos]

            for env_i in range(R):
                cnt = int(counts[env_i])
                if cnt == 0:
                    continue
                valid_flags = valid_in_pos[env_i]
                valid_local = np.where(valid_flags)[0]
                if len(valid_local) == 0:
                    continue
                k = min(cnt, len(valid_local))
                ab_sub = ab_in_pos[valid_local]
                ab_sub = ab_sub - ab_sub.max()
                weights = np.exp(ab_sub / 10.0)
                weights /= weights.sum()
                chosen_local = np.random.choice(len(valid_local), size=k, replace=False, p=weights)
                chosen_global = pos_player_indices[valid_local[chosen_local]]
                wp = write_pos[env_i]
                out[env_i, wp:wp + k] = chosen_global
                write_pos[env_i] = wp + k
                available[env_i, chosen_global] = False

        for env_i in range(R):
            N = n_vals_np[env_i]
            total_needed = AUCTION_LOTS_PER_DRAFTER * N
            have = write_pos[env_i]
            surplus = total_needed - have
            if surplus <= 0:
                continue
            remaining_idx = np.where(available[env_i])[0]
            if len(remaining_idx) == 0:
                continue
            k = min(surplus, len(remaining_idx))
            ab_sub = abilities_np[remaining_idx]
            ab_sub = ab_sub - ab_sub.max()
            weights = np.exp(ab_sub / 10.0)
            weights /= weights.sum()
            chosen = np.random.choice(len(remaining_idx), size=k, replace=False, p=weights)
            chosen_global = remaining_idx[chosen]
            wp = write_pos[env_i]
            out[env_i, wp:wp + k] = chosen_global
            write_pos[env_i] = wp + k

        for env_i in range(R):
            end = int(write_pos[env_i])
            if end > 0:
                perm = np.random.permutation(end)
                out[env_i, :end] = out[env_i, :end][perm]

        lot_tensor[reset_indices] = torch.tensor(out, dtype=torch.int64, device=self.device)

    # ------------------------------------------------------------------
    # _sample_configs — vectorised scope + budget; batched lot building
    # ------------------------------------------------------------------
    def _sample_configs(self, mask: torch.Tensor):
        num_resets = mask.sum().item()
        if num_resets == 0:
            return

        reset_indices = mask.nonzero(as_tuple=True)[0]   # [R] tensor

        # Sample N ~ U(2, 5)
        n_vals = torch.randint(2, 6, size=(num_resets,), device=self.device)
        self.N[mask] = n_vals

        scope_probs = torch.tensor([0.5, 0.3, 0.2], device=self.device)
        scope_choices = torch.multinomial(scope_probs, num_resets, replacement=True)
        # 0=all, 1=top5, 2=single_league

        n_vals_cpu = n_vals.cpu().numpy()
        scope_choices_cpu = scope_choices.cpu().numpy()
        reset_indices_cpu = reset_indices.cpu().numpy()

        P = self.pool.player_count
        scope_masks_np = np.zeros((num_resets, P), dtype=bool)
        budgets_np = np.zeros(num_resets, dtype=np.float32)

        is_all = scope_choices_cpu == 0
        is_top5 = scope_choices_cpu == 1
        is_league = scope_choices_cpu == 2

        if is_all.any():
            scope_masks_np[is_all] = self._scope_np_all[np.newaxis, :]
            budgets_np[is_all] = self._budget_all

        if is_top5.any():
            scope_masks_np[is_top5] = self._scope_np_top5[np.newaxis, :]
            budgets_np[is_top5] = self._budget_top5

        if is_league.any():
            league_indices = np.where(is_league)[0]
            for li in league_indices:
                N_i = n_vals_cpu[li]
                valid_leagues = ["Serie A", "Premier Division"]
                if N_i == 2:
                    valid_leagues.append("Bundesliga")
                if N_i <= 3:
                    valid_leagues.append("First Division")
                lg = valid_leagues[np.random.randint(len(valid_leagues))]
                scope_masks_np[li] = self._league_masks_np[lg]
                budgets_np[li] = self._budget_leagues[lg]

        # Write scope_mask to tensor — vectorised
        self.scope_mask[mask] = torch.tensor(scope_masks_np, dtype=torch.bool, device=self.device)

        # Budgets — vectorised
        budget_t = torch.tensor(budgets_np, dtype=torch.float32, device=self.device)   # [R]
        seat_idx = torch.arange(5, device=self.device).unsqueeze(0)                    # [1, 5]
        n_t = n_vals.unsqueeze(1)                                                       # [R, 1]
        active_seats = seat_idx < n_t                                                   # [R, 5]
        self.budgets[mask] = budget_t.unsqueeze(1) * active_seats.float()

        # Lot lists — batched numpy
        self.lots[mask] = -1
        self._build_lots_batched(scope_masks_np, n_vals_cpu, self.lots, reset_indices_cpu)

    # ------------------------------------------------------------------
    # _reset_envs — scatter_add_ for lots_revealed
    # ------------------------------------------------------------------
    def _reset_envs(self, mask: torch.Tensor):
        self.active_envs[mask] = True
        self.squad_best2[mask] = 0.0
        self.lots_revealed[mask] = 0
        self.lots_sold[mask] = 0
        self.sold_mask[mask] = False
        self.lot_idx[mask] = 0
        self.high_bidder[mask] = -1
        self.round_idx[mask] = 0

        self._sample_configs(mask)

        # First lots
        curr_lots = self.lots[mask, 0]   # [R]
        valid_first = curr_lots >= 0
        price_vals = torch.where(
            valid_first,
            self._opening_bids[curr_lots.clamp(min=0)],
            torch.zeros(curr_lots.shape[0], device=self.device)
        )
        self.current_price[mask] = price_vals

        # Update lots_revealed via scatter_add_ — no per-env loop
        env_ids = mask.nonzero(as_tuple=True)[0]   # [R]
        if valid_first.any():
            valid_env_ids = env_ids[valid_first]                              # [V]
            valid_pids = curr_lots[valid_first]                               # [V]
            valid_pos = self._position_ids[valid_pids].long()                 # [V]
            flat_idx = valid_env_ids * 10 + valid_pos                        # [V]
            ones = torch.ones(valid_env_ids.shape[0], dtype=torch.int64, device=self.device)
            self.lots_revealed.view(-1).scatter_add_(0, flat_idx, ones)

        self._recompute_phi(mask)

    # ------------------------------------------------------------------
    # _recompute_phi — fully vectorised, no inner per-env loop
    # ------------------------------------------------------------------
    def _recompute_phi(self, mask: torch.Tensor):
        if not mask.any():
            return

        current_score = (self.squad_best2[mask, :, :, 0] * self._pos_mults).sum(dim=-1)   # [R, 5]

        open_slots = (
            self._slot_counts.view(1, 1, 10)
            - (self.squad_best2[mask, :, :, 0] > 0).long()
        )   # [R, 5, 10]

        cb_idx = self.pool.position_to_id["CB"]
        cb_open = (
            2
            - (self.squad_best2[mask, :, cb_idx, 0] > 0).long()
            - (self.squad_best2[mask, :, cb_idx, 1] > 0).long()
        )   # [R, 5]
        open_slots[:, :, cb_idx] = cb_open

        projected_score = current_score.clone()   # [R, 5]

        eligible_mask = self.scope_mask[mask] & ~self.sold_mask[mask]   # [R, P]
        R_size = eligible_mask.shape[0]

        for pos_idx in range(10):
            needed = open_slots[:, :, pos_idx] > 0   # [R, 5]
            if not needed.any():
                continue

            pos_mask = self._position_ids == pos_idx   # [P]
            pos_player_idx = pos_mask.nonzero(as_tuple=True)[0]   # [P_pos]
            if pos_player_idx.numel() == 0:
                continue

            # [R, P_pos]
            eligible_pos = eligible_mask[:, pos_player_idx]
            bids_pos = self._opening_bids[pos_player_idx]   # [P_pos]

            INF = 1e9
            masked_bids = torch.where(
                eligible_pos,
                bids_pos.unsqueeze(0).expand(R_size, -1),
                torch.full((R_size, pos_player_idx.numel()), INF, device=self.device)
            )
            min_bids, min_idxs = masked_bids.min(dim=1)   # [R]
            has_valid = min_bids < INF                      # [R]

            if not has_valid.any():
                continue

            best_pid = pos_player_idx[min_idxs.clamp(min=0)]   # [R]
            best_ab = torch.where(has_valid, self._abilities[best_pid], torch.zeros(R_size, device=self.device))
            mult = self._pos_mults[pos_idx]

            add_mask = needed & has_valid.unsqueeze(1)   # [R, 5]
            projected_score += add_mask.float() * (best_ab.unsqueeze(1) * mult)

        active_seats_mask = (
            torch.arange(5, device=self.device).unsqueeze(0) < self.N[mask].unsqueeze(1)
        )   # [R, 5]

        mean_proj = (projected_score * active_seats_mask).sum(dim=1) / self.N[mask].float().clamp(min=1)

        self.prev_phi[mask] = projected_score - mean_proj.unsqueeze(1)
        self.last_projected_scores[mask] = projected_score

    def get_avg_squad_score(self) -> float:
        """Returns the average projected 11-player squad score across active seats."""
        active_seats = (torch.arange(5, device=self.device).unsqueeze(0) < self.N.unsqueeze(1)).float()
        return ((self.last_projected_scores * active_seats).sum() / active_seats.sum().clamp(min=1.0)).item()

    # ------------------------------------------------------------------
    # reset_all
    # ------------------------------------------------------------------
    def reset_all(self):
        all_envs = torch.ones(self.B, dtype=torch.bool, device=self.device)
        self._reset_envs(all_envs)
        return self.get_obs(), self.get_legal_actions()

    # ------------------------------------------------------------------
    # step
    # ------------------------------------------------------------------
    def step(self, actions: torch.Tensor):
        """
        actions: [B, 5]
        Returns: obs, rewards, dones, masks
        """
        rewards = torch.zeros((self.B, 5), dtype=torch.float32, device=self.device)
        dones = torch.zeros(self.B, dtype=torch.bool, device=self.device)

        active = self.active_envs
        if not active.any():
            return self.get_obs(), rewards, dones, self.get_legal_actions()

        legal = self.get_legal_actions()

        seat_mask = torch.arange(5, device=self.device).unsqueeze(0) < self.N.unsqueeze(1)
        valid_action = legal.gather(-1, actions.unsqueeze(-1)).squeeze(-1) & seat_mask & active.unsqueeze(1)
        actions = actions.masked_fill(~valid_action, 0)

        # Raises
        raises = torch.zeros((self.B, 5), dtype=torch.float32, device=self.device)
        r0 = (self.round_idx == 0).unsqueeze(1).expand(-1, 5)
        raises[~r0 & (actions == 1)] = 5.0
        raises[~r0 & (actions == 2)] = 10.0
        raises[~r0 & (actions == 3)] = 25.0

        has_raise = (actions > 0).any(dim=1)

        if has_raise.any():
            max_r, _ = raises[has_raise].max(dim=1)
            is_max = raises[has_raise] == max_r.unsqueeze(1)
            rand_tie = torch.rand(is_max.shape, device=self.device)
            rand_tie[~is_max] = -1.0
            winner = rand_tie.argmax(dim=1)
            self.high_bidder[has_raise] = winner
            self.current_price[has_raise] += max_r
            self.round_idx[has_raise] += 1

        # Lots that end — clamp idx to avoid out-of-bounds on exhausted envs
        _safe = self.lot_idx.clamp(max=self.lots.shape[1] - 1)
        _cur_lots = self.lots.gather(1, _safe.unsqueeze(1)).squeeze(1)
        lot_ends = ~has_raise & active & (self.lot_idx < self.lots.shape[1]) & (_cur_lots >= 0)

        if lot_ends.any():
            sold = lot_ends & (self.high_bidder >= 0)

            sold_pids = self.lots[sold, self.lot_idx[sold]]   # [S]
            winners = self.high_bidder[sold]                   # [S]
            prices = self.current_price[sold]                  # [S]

            self.budgets[sold, winners] -= prices

            abs_val = self._abilities[sold_pids]            # [S]
            pos_val = self._position_ids[sold_pids].long()  # [S]
            sold_env_ids = sold.nonzero(as_tuple=True)[0]   # [S]

            if sold_env_ids.numel() > 0:
                # sold_mask update — vectorised index_put_
                self.sold_mask.index_put_(
                    (sold_env_ids, sold_pids),
                    torch.ones(sold_env_ids.shape[0], dtype=torch.bool, device=self.device)
                )

                # lots_sold update — scatter_add_
                flat_sold_idx = sold_env_ids * 10 + pos_val
                ones_s = torch.ones(sold_env_ids.shape[0], dtype=torch.int64, device=self.device)
                self.lots_sold.view(-1).scatter_add_(0, flat_sold_idx, ones_s)

                # squad_best2 best-of-2 insertion — two index_put_ passes
                v0 = self.squad_best2[sold_env_ids, winners, pos_val, 0]   # [S]
                v1 = self.squad_best2[sold_env_ids, winners, pos_val, 1]   # [S]

                better_0 = abs_val > v0                          # [S]
                better_1_only = (~better_0) & (abs_val > v1)    # [S]

                if better_0.any():
                    # slot1 = old slot0
                    self.squad_best2.index_put_(
                        (sold_env_ids[better_0], winners[better_0],
                         pos_val[better_0], torch.ones_like(pos_val[better_0])),
                        v0[better_0]
                    )
                    # slot0 = new
                    self.squad_best2.index_put_(
                        (sold_env_ids[better_0], winners[better_0],
                         pos_val[better_0], torch.zeros_like(pos_val[better_0])),
                        abs_val[better_0]
                    )

                if better_1_only.any():
                    self.squad_best2.index_put_(
                        (sold_env_ids[better_1_only], winners[better_1_only],
                         pos_val[better_1_only], torch.ones_like(pos_val[better_1_only])),
                        abs_val[better_1_only]
                    )

            # Advance to next lot
            self.lot_idx[lot_ends] += 1
            self.round_idx[lot_ends] = 0
            self.high_bidder[lot_ends] = -1

            # Clamp lot_idx before gather — idx may have just crossed the array boundary
            safe_idx = self.lot_idx.clamp(max=self.lots.shape[1] - 1)
            new_lots = self.lots.gather(1, safe_idx.unsqueeze(1)).squeeze(1)
            # A lot is only valid if lot_idx is still in range AND the slot isn't -1
            valid_new = lot_ends & (self.lot_idx < self.lots.shape[1]) & (new_lots >= 0)
            self.current_price[valid_new] = self._opening_bids[new_lots[valid_new]]

            # lots_revealed update — scatter_add_ (no per-env loop)
            if valid_new.any():
                vn_env_ids = valid_new.nonzero(as_tuple=True)[0]
                vn_pids = new_lots[valid_new]
                vn_pos = self._position_ids[vn_pids].long()
                flat_vn = vn_env_ids * 10 + vn_pos
                ones_vn = torch.ones(vn_env_ids.shape[0], dtype=torch.int64, device=self.device)
                self.lots_revealed.view(-1).scatter_add_(0, flat_vn, ones_vn)

            old_phi = self.prev_phi[lot_ends].clone()
            self._recompute_phi(lot_ends)
            new_phi = self.prev_phi[lot_ends]
            rewards[lot_ends] = new_phi - old_phi

            dones = self._check_dones(lot_ends)

            if dones.any():
                self.active_envs[dones] = False
                self._reset_envs(dones)

        return self.get_obs(), rewards, dones, self.get_legal_actions()

    # ------------------------------------------------------------------
    # _check_dones — fully vectorised, no Python loops over envs/seats/pos
    # ------------------------------------------------------------------
    def _check_dones(self, check_mask: torch.Tensor) -> torch.Tensor:
        dones = torch.zeros(self.B, dtype=torch.bool, device=self.device)

        safe_idx = self.lot_idx.clamp(max=self.lots.shape[1] - 1)
        lot_empty = (self.lot_idx >= self.lots.shape[1]) | \
                    (self.lots.gather(1, safe_idx.unsqueeze(1)).squeeze(1) < 0)
        dones[check_mask & lot_empty] = True

        check_afford = check_mask & ~lot_empty
        if not check_afford.any():
            return dones

        # open_slots: [B, 5, 10]
        open_slots = (
            self._slot_counts.view(1, 1, 10)
            - (self.squad_best2[:, :, :, 0] > 0).long()
        )
        cb_idx = self.pool.position_to_id["CB"]
        cb_open = (
            2
            - (self.squad_best2[:, :, cb_idx, 0] > 0).long()
            - (self.squad_best2[:, :, cb_idx, 1] > 0).long()
        )
        open_slots[:, :, cb_idx] = cb_open

        eligible = self.scope_mask & ~self.sold_mask   # [B, P]

        # cheapest_per_pos: [B, 10]
        INF = 1e9
        cheapest_per_pos = torch.full((self.B, 10), INF, device=self.device)
        for pos_idx in range(10):
            pos_mask = self._position_ids == pos_idx
            pos_player_idx = pos_mask.nonzero(as_tuple=True)[0]
            if pos_player_idx.numel() == 0:
                continue
            eligible_pos = eligible[:, pos_player_idx]      # [B, P_pos]
            bids_pos = self._opening_bids[pos_player_idx]   # [P_pos]
            masked_bids = torch.where(
                eligible_pos,
                bids_pos.unsqueeze(0).expand(self.B, -1),
                torch.full((self.B, pos_player_idx.numel()), INF, device=self.device)
            )
            cheapest_per_pos[:, pos_idx] = masked_bids.min(dim=1).values

        # seat_active: [B, 5]
        seat_active = torch.arange(5, device=self.device).unsqueeze(0) < self.N.unsqueeze(1)

        # can_afford: [B, 5, 10]
        can_afford = self.budgets.unsqueeze(2) >= cheapest_per_pos.unsqueeze(1)
        has_open = open_slots > 0

        seat_can_continue = seat_active & (can_afford & has_open).any(dim=2)   # [B, 5]
        env_can_continue = seat_can_continue.any(dim=1)                         # [B]

        dones[check_afford & ~env_can_continue] = True

        return dones

    # ------------------------------------------------------------------
    # get_legal_actions
    # ------------------------------------------------------------------
    def get_legal_actions(self):
        legal = torch.zeros((self.B, 5, 4), dtype=torch.bool, device=self.device)
        if not self.active_envs.any():
            return legal

        active = self.active_envs
        _safe = self.lot_idx.clamp(max=self.lots.shape[1] - 1)
        lot_pids = self.lots.gather(1, _safe.unsqueeze(1)).squeeze(1)
        valid_lot = active & (self.lot_idx < self.lots.shape[1]) & (lot_pids >= 0)

        legal[valid_lot, :, 0] = True

        for i in range(5):
            is_high = self.high_bidder == i
            legal[is_high, i, 0] = True
            legal[is_high, i, 1:] = False

        r0 = self.round_idx == 0
        r0_mask = valid_lot & r0
        r1_mask = valid_lot & ~r0

        for i in range(5):
            b = self.budgets[:, i]
            c0 = b >= self.current_price
            legal[r0_mask & c0, i, 1] = True
            c1 = b >= self.current_price + 5.0
            c2 = b >= self.current_price + 10.0
            c3 = b >= self.current_price + 25.0
            legal[r1_mask & c1, i, 1] = True
            legal[r1_mask & c2, i, 2] = True
            legal[r1_mask & c3, i, 3] = True
            is_high = self.high_bidder == i
            legal[is_high, i, 1:] = False

        seat_mask = torch.arange(5, device=self.device).unsqueeze(0) >= self.N.unsqueeze(1)
        legal[seat_mask, :] = False

        return legal

    # ------------------------------------------------------------------
    # get_obs — vectorised opp_need_pos_count and opp_max_budget_need
    # ------------------------------------------------------------------
    def get_obs(self):
        B5 = self.B * 5
        active = self.active_envs
        _safe = self.lot_idx.clamp(max=self.lots.shape[1] - 1)
        lot_pids = self.lots.gather(1, _safe.unsqueeze(1)).squeeze(1)
        valid_lot = active & (self.lot_idx < self.lots.shape[1]) & (lot_pids >= 0)

        lot_ability = torch.zeros(self.B, device=self.device)
        lot_pos = torch.zeros(self.B, dtype=torch.int64, device=self.device) - 1
        lot_derived = torch.zeros(self.B, device=self.device)
        lot_open = torch.zeros(self.B, device=self.device)

        lot_ability[valid_lot] = self._abilities[lot_pids[valid_lot]]
        lot_pos[valid_lot] = self._position_ids[lot_pids[valid_lot]].long()
        lot_derived[valid_lot] = self._derived_prices[lot_pids[valid_lot]]
        lot_open[valid_lot] = self._opening_bids[lot_pids[valid_lot]]

        def exp(x): return x.unsqueeze(1).expand(-1, 5).reshape(-1)

        my_budget = self.budgets.reshape(-1)
        am_i_high = (
            self.high_bidder.unsqueeze(1) == torch.arange(5, device=self.device).unsqueeze(0)
        ).reshape(-1)

        best2 = self.squad_best2.reshape(B5, 10, 2)
        my_best_ab = best2[:, :, 0]
        my_open = self._slot_counts.unsqueeze(0) - (my_best_ab > 0).long()
        cb_idx = self.pool.position_to_id["CB"]
        cb_open = 2 - (best2[:, cb_idx, 0] > 0).long() - (best2[:, cb_idx, 1] > 0).long()
        my_open[:, cb_idx] = cb_open

        # MV
        mv = torch.zeros(B5, device=self.device)
        l_pos = exp(lot_pos)
        l_ab = exp(lot_ability)
        v_lot = exp(valid_lot)

        for i in range(10):
            mask_i = v_lot & (l_pos == i)
            if not mask_i.any():
                continue
            is_open = my_open[mask_i, i] > 0
            weakest = torch.zeros(mask_i.sum(), device=self.device)
            if i == cb_idx:
                weakest[~is_open] = best2[mask_i][~is_open, i, 1]
            else:
                weakest[~is_open] = best2[mask_i][~is_open, i, 0]
            delta = l_ab[mask_i] - weakest
            mv[mask_i] = torch.clamp(delta, min=0.0) * self._pos_mults[i]

        # Opponents
        seat_mask = torch.arange(5, device=self.device).unsqueeze(0) < self.N.unsqueeze(1)
        opp_live_B5 = (self.N.unsqueeze(1).expand(-1, 5) - 1).clamp(min=0).reshape(-1)

        total_budget = self.budgets.sum(dim=1, keepdim=True)
        opp_sum_budget = (total_budget - self.budgets).reshape(-1)
        opp_mean_budget = torch.zeros(B5, device=self.device)
        valid_opps = opp_live_B5 > 0
        opp_mean_budget[valid_opps] = opp_sum_budget[valid_opps] / opp_live_B5[valid_opps].float()

        opp_max_budget = torch.zeros((self.B, 5), device=self.device)
        for s in range(5):
            others = [x for x in range(5) if x != s]
            opp_max_budget[:, s] = self.budgets[:, others].max(dim=1)[0]

        # Opp open slots: [B, 5, 10]
        opp_open = seat_mask.unsqueeze(2) * (
            self._slot_counts.view(1, 1, 10) - (self.squad_best2[..., 0] > 0).long()
        )
        opp_open[:, :, cb_idx] = seat_mask * (
            2
            - (self.squad_best2[:, :, cb_idx, 0] > 0).long()
            - (self.squad_best2[:, :, cb_idx, 1] > 0).long()
        )

        total_open = opp_open.sum(dim=2)   # [B, 5]
        fill_frac = (11.0 - total_open.float()) / 11.0

        # Build other_indices [5, 4] once
        all_seats = torch.arange(5, device=self.device)
        other_indices = torch.stack([all_seats[all_seats != s] for s in range(5)])  # [5, 4]
        other_idx_expanded = other_indices.unsqueeze(0).expand(self.B, -1, -1)       # [B, 5, 4]

        # opp_mean_fill
        fill_frac_others = fill_frac.unsqueeze(1).expand(-1, 5, -1).gather(
            2, other_idx_expanded
        )   # [B, 5, 4]
        valid_N = (self.N - 1).clamp(min=1).float()
        opp_mean_fill = fill_frac_others.sum(dim=2) / valid_N.unsqueeze(1)   # [B, 5]

        # opp_need_pos_count and opp_max_budget_need — vectorised
        lot_pos_clamped = lot_pos.clamp(min=0)
        lp_expand = lot_pos_clamped.view(self.B, 1, 1).expand(self.B, 5, 1)
        opp_open_at_pos = opp_open.gather(2, lp_expand).squeeze(2)   # [B, 5]

        opp_open_others = opp_open_at_pos.unsqueeze(1).expand(-1, 5, -1).gather(
            2, other_idx_expanded
        )   # [B, 5, 4]
        needs = opp_open_others > 0

        budgets_others = self.budgets.unsqueeze(1).expand(-1, 5, -1).gather(
            2, other_idx_expanded
        )   # [B, 5, 4]

        valid_lot_expand = valid_lot.view(self.B, 1, 1).expand(self.B, 5, 4)
        needs_valid = needs & valid_lot_expand   # [B, 5, 4]

        opp_need_pos_count = needs_valid.float().sum(dim=2)                    # [B, 5]
        budgets_needed = budgets_others * needs_valid.float()
        opp_max_budget_need = budgets_needed.max(dim=2).values                 # [B, 5]

        # History
        lots_remaining = (AUCTION_LOTS_PER_DRAFTER * self.N) - self.lot_idx
        lots_total = (AUCTION_LOTS_PER_DRAFTER * self.N).float()
        frac_elapsed = self.lot_idx.float() / lots_total.clamp(min=1.0)
        scope_sizes = self.scope_mask.sum(dim=1)

        obs = build_auction_obs(
            lot_ability=exp(lot_ability),
            lot_position_idx=exp(lot_pos),
            lot_derived_price=exp(lot_derived),
            lot_opening_bid=exp(lot_open),
            lot_current_price=exp(self.current_price),
            lot_rounds_elapsed=exp(self.round_idx.float()),

            my_budget=my_budget,
            am_i_high_bidder=am_i_high,
            my_best_ability_per_pos=my_best_ab,
            my_open_slots_per_pos=my_open.float(),

            marginal_value=mv,

            opponents_live_count=opp_live_B5,
            opponents_max_budget=opp_max_budget.reshape(-1),
            opponents_mean_budget=opp_mean_budget,
            opponents_need_pos_count=opp_need_pos_count.reshape(-1),
            opponents_max_budget_need_pos=opp_max_budget_need.reshape(-1),
            opponents_mean_squad_fill=opp_mean_fill.reshape(-1),

            lots_revealed_per_pos=self.lots_revealed.unsqueeze(1).expand(-1, 5, -1).reshape(B5, 10),
            lots_sold_per_pos=self.lots_sold.unsqueeze(1).expand(-1, 5, -1).reshape(B5, 10),
            lots_remaining=exp(lots_remaining),
            fraction_elapsed=exp(frac_elapsed),
            scoped_pool_size=exp(scope_sizes)
        )

        inactive_mask = ~seat_mask.reshape(-1)
        obs[inactive_mask] = 0.0

        return obs.reshape(self.B, 5, 69)
