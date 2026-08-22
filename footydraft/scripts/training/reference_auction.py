import numpy as np
import torch
from typing import List, Dict, Tuple, Optional
from config import AUCTION_BID_INCREMENTS, AUCTION_ACTIONS, AUCTION_LOTS_PER_DRAFTER
from player_pool import GLOBAL_POOL, POSITION_MULTIPLIERS, SLOT_TO_POSITION

class ReferenceAuctionEnv:
    def __init__(self, N: int, scope_type: str, league_name: Optional[str] = None, seed: int = 42):
        self.N = N
        self.scope_type = scope_type
        self.league_name = league_name
        self.pool = GLOBAL_POOL
        self.rng = np.random.RandomState(seed)
        
        self.reset()
        
    def reset(self):
        scope_mask = self.pool.get_scope_mask(self.scope_type, self.league_name)
        self.scope_indices = np.where(scope_mask)[0]
        self.budget = self.pool.calculate_auction_budget(self.scope_indices)
        
        self.lot_list = self._build_lot_list()
        self.lot_idx = 0
        
        self.budgets = np.full(self.N, self.budget, dtype=np.float32)
        self.rosters = [[] for _ in range(self.N)]
        self.sold_lots = []
        self.unsold_lots = []
        
        self.current_lot_pid = -1
        self.current_price = 0.0
        self.high_bidder = -1
        self.round_idx = 0
        
        self.lots_revealed_per_pos = {pos: 0 for pos in POSITION_MULTIPLIERS.keys()}
        self.lots_sold_per_pos = {pos: 0 for pos in POSITION_MULTIPLIERS.keys()}
        
        self._next_lot()
        
    def _build_lot_list(self) -> List[int]:
        slots = {"GK": 1, "LB": 1, "CB": 2, "RB": 1, "CDM": 1, "CM": 1, "LW": 1, "AMF": 1, "RW": 1, "ST": 1}
        chosen = []
        available = list(self.scope_indices)
        
        def pick(options: List[int], count: int) -> List[int]:
            if count <= 0 or not options: return []
            count = min(count, len(options))
            abilities = self.pool.abilities[options]
            max_ab = np.max(abilities)
            weights = np.exp((abilities - max_ab) / 10.0)
            weights /= np.sum(weights)
            picked_idx = self.rng.choice(len(options), size=count, replace=False, p=weights)
            picked = [options[i] for i in picked_idx]
            for p in picked:
                options.remove(p)
            return picked

        for pos, count in slots.items():
            pos_id = self.pool.position_to_id[pos]
            pos_options = [p for p in available if self.pool.position_ids[p] == pos_id]
            chosen.extend(pick(pos_options, count * self.N))
            
        surplus_count = (AUCTION_LOTS_PER_DRAFTER * self.N) - len(chosen)
        if surplus_count > 0:
            chosen.extend(pick(available, surplus_count))
            
        self.rng.shuffle(chosen)
        return chosen
        
    def _next_lot(self):
        if self.lot_idx >= len(self.lot_list):
            self.current_lot_pid = -1
            return
            
        self.current_lot_pid = self.lot_list[self.lot_idx]
        self.current_price = self.pool.opening_bids[self.current_lot_pid]
        self.high_bidder = -1
        self.round_idx = 0
        
        pos = self.pool.positions[self.current_lot_pid]
        self.lots_revealed_per_pos[pos] += 1
        self.lot_idx += 1
        
    def get_legal_actions(self, seat: int) -> np.ndarray:
        legal = np.zeros(4, dtype=bool)
        if self.current_lot_pid == -1: return legal
        if seat == self.high_bidder: return legal
        
        legal[0] = True # Pass
        budget = self.budgets[seat]
        if self.round_idx == 0:
            if budget >= self.current_price: legal[1] = True
        else:
            if budget >= self.current_price + 5.0: legal[1] = True
            if budget >= self.current_price + 10.0: legal[2] = True
            if budget >= self.current_price + 25.0: legal[3] = True
        return legal

    def step(self, actions: List[int]) -> bool:
        """Returns done boolean."""
        if self.current_lot_pid == -1: return True
        
        raises = []
        for seat, a in enumerate(actions):
            if seat == self.high_bidder or not self.get_legal_actions(seat)[a]:
                continue
            if a > 0:
                r = 0.0 if self.round_idx == 0 else AUCTION_BID_INCREMENTS[a-1]
                raises.append((r, seat))
                
        if not raises:
            if self.high_bidder != -1:
                self.budgets[self.high_bidder] -= self.current_price
                self.rosters[self.high_bidder].append(self.current_lot_pid)
                self.sold_lots.append(self.current_lot_pid)
                pos = self.pool.positions[self.current_lot_pid]
                self.lots_sold_per_pos[pos] += 1
            else:
                self.unsold_lots.append(self.current_lot_pid)
                
            self._next_lot()
            return self._check_done()
            
        max_raise = max(r for r, s in raises)
        top_seats = [s for r, s in raises if r == max_raise]
        winner = self.rng.choice(top_seats)
        
        self.high_bidder = winner
        self.current_price += max_raise
        self.round_idx += 1
        
        return self._check_done()

    def _check_done(self) -> bool:
        if self.current_lot_pid == -1: return True
        
        available_pids = set(self.scope_indices) - set(self.sold_lots)
        all_done = True
        for seat in range(self.N):
            squad, _, _ = self.pool.get_optimal_squad_from_roster(self.rosters[seat])
            open_slots = [s for s, pid in squad.items() if pid is None]
            if not open_slots:
                continue
                
            can_afford = False
            for slot in open_slots:
                pos = SLOT_TO_POSITION[slot]
                pos_id = self.pool.position_to_id[pos]
                eligible = [p for p in available_pids if self.pool.position_ids[p] == pos_id]
                if not eligible: continue
                cheapest_price = min(self.pool.opening_bids[p] for p in eligible)
                if self.budgets[seat] >= cheapest_price:
                    can_afford = True
                    break
            if can_afford:
                all_done = False
                break
        return all_done

    def resolve_backfill(self):
        never_block = set(self.scope_indices) - set(self.sold_lots) - set(self.unsold_lots)
        unsold_pile = set(self.unsold_lots)
        
        seat_order = list(range(self.N))
        self.rng.shuffle(seat_order)
        
        for seat in seat_order:
            squad, _, _ = self.pool.get_optimal_squad_from_roster(self.rosters[seat])
            open_slots = [s for s, pid in squad.items() if pid is None]
            for slot in open_slots:
                pos = SLOT_TO_POSITION[slot]
                pos_id = self.pool.position_to_id[pos]
                
                cands = [p for p in never_block if self.pool.position_ids[p] == pos_id]
                if cands:
                    best = min(cands, key=lambda p: (self.pool.opening_bids[p], -self.pool.abilities[p]))
                    self.rosters[seat].append(best)
                    never_block.remove(best)
                    continue
                    
                cands = [p for p in unsold_pile if self.pool.position_ids[p] == pos_id]
                if cands:
                    best = min(cands, key=lambda p: (self.pool.opening_bids[p], -self.pool.abilities[p]))
                    self.rosters[seat].append(best)
                    unsold_pile.remove(best)
