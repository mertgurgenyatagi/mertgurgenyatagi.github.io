import torch

class ScriptedBidder:
    def __init__(self, alpha: float = 1.0):
        # α determines how aggressive the bot is relative to the marginal value
        self.alpha = alpha

    def get_actions(self, obs: torch.Tensor, masks: torch.Tensor) -> torch.Tensor:
        """
        obs: [B, 69]
        masks: [B, 4] legal actions mask
        Returns actions [B]
        """
        # obs structure:
        # [0]: lot_ability_norm
        # [1:11]: pos_onehot
        # [11]: lot_derived_price_norm
        # [12]: lot_opening_bid_norm
        # [13]: lot_current_price_norm
        # [14]: price_opening_ratio
        # [15]: lot_rounds_elapsed_norm
        
        # [16]: my_budget_norm
        # [17]: budget_price_ratio
        # [18]: am_i_high_bidder
        # [19:29]: my_best_ability_per_pos_norm
        # [29:39]: my_open_slots_per_pos_norm
        
        # [39]: marginal_value_norm
        
        # NORM_PRICE = 1000.0, NORM_ABILITY = 200.0
        
        B = obs.shape[0]
        device = obs.device
        
        lot_current_price_norm = obs[:, 13]
        marginal_value_norm = obs[:, 39]
        
        # We bid if current price < alpha * marginal value
        # But wait, prices are in millions (NORM_PRICE=1000), MV is in score points (NORM_ABILITY=200)
        # So we want (current_price * 1000) < alpha * (mv * 200)
        
        price = lot_current_price_norm * 1000.0
        mv = marginal_value_norm * 200.0
        
        wants_to_bid = price < (self.alpha * mv)
        
        actions = torch.zeros(B, dtype=torch.int64, device=device) # Default Pass
        
        # If we want to bid, pick the largest legal raise
        # Masks: [Pass, +5, +10, +25]
        # In round 0, masks are [Pass, Bid] where Bid=1
        
        # Strategy: pick the highest legal raise that keeps price < alpha*mv. 
        # But since we just want to keep it simple: 
        # If we want to bid, pick +5 (action 1) if legal, or +10 (action 2) if +5 isn't enough to outbid. 
        # Actually, let's just pick action 1 if legal. If not, maybe we are the high bidder or can't afford.
        
        can_act_1 = masks[:, 1]
        can_act_2 = masks[:, 2]
        can_act_3 = masks[:, 3]
        
        bid_mask = wants_to_bid & can_act_1
        actions[bid_mask] = 1
        
        # Simple heuristic, always bid smallest amount possible (action 1) to conserve budget
        return actions
