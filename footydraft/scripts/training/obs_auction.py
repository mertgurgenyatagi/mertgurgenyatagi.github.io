import torch

def build_auction_obs(
    # Lot
    lot_ability: torch.Tensor,
    lot_position_idx: torch.Tensor, # 0 to 9, -1 if no lot
    lot_derived_price: torch.Tensor,
    lot_opening_bid: torch.Tensor,
    lot_current_price: torch.Tensor,
    lot_rounds_elapsed: torch.Tensor,
    
    # Me
    my_budget: torch.Tensor,
    am_i_high_bidder: torch.Tensor, # bool
    my_best_ability_per_pos: torch.Tensor, # [B, 10]
    my_open_slots_per_pos: torch.Tensor, # [B, 10]
    
    # MV
    marginal_value: torch.Tensor,
    
    # Opponents
    opponents_live_count: torch.Tensor,
    opponents_max_budget: torch.Tensor,
    opponents_mean_budget: torch.Tensor,
    opponents_need_pos_count: torch.Tensor,
    opponents_max_budget_need_pos: torch.Tensor,
    opponents_mean_squad_fill: torch.Tensor,
    
    # History
    lots_revealed_per_pos: torch.Tensor, # [B, 10]
    lots_sold_per_pos: torch.Tensor, # [B, 10]
    lots_remaining: torch.Tensor,
    fraction_elapsed: torch.Tensor,
    
    # Context
    scoped_pool_size: torch.Tensor
) -> torch.Tensor:
    """
    Builds the 69-dimensional normalized observation for the Auction bot.
    All scalar tensors are [B]. Array tensors are [B, 10].
    """
    B = lot_ability.shape[0]
    device = lot_ability.device
    
    # Normalization constants
    NORM_ABILITY = 200.0
    NORM_PRICE = 1000.0 # budgets and prices in millions
    NORM_ROUNDS = 10.0
    NORM_LOTS = 75.0 # Max lots = 15 * 5 = 75
    NORM_POOL = 546.0
    
    # 1. Lot (16)
    pos_onehot = torch.zeros((B, 10), device=device, dtype=torch.float32)
    valid_lot = lot_position_idx >= 0
    pos_onehot[valid_lot, lot_position_idx[valid_lot]] = 1.0
    
    price_opening_ratio = torch.ones_like(lot_current_price) # 1.0 if no opening
    valid_opening = lot_opening_bid > 0
    price_opening_ratio[valid_opening] = lot_current_price[valid_opening] / lot_opening_bid[valid_opening]
    # cap ratio at 10.0
    price_opening_ratio = torch.clamp(price_opening_ratio, 0.0, 10.0) / 10.0
    
    lot_block = torch.cat([
        (lot_ability / NORM_ABILITY).unsqueeze(1),
        pos_onehot,
        (lot_derived_price / NORM_PRICE).unsqueeze(1),
        (lot_opening_bid / NORM_PRICE).unsqueeze(1),
        (lot_current_price / NORM_PRICE).unsqueeze(1),
        price_opening_ratio.unsqueeze(1),
        (lot_rounds_elapsed / NORM_ROUNDS).unsqueeze(1),
    ], dim=1) # 1 + 10 + 1 + 1 + 1 + 1 + 1 = 16
    
    # 2. Me (23)
    budget_price_ratio = torch.zeros_like(my_budget)
    valid_price = lot_current_price > 0
    budget_price_ratio[valid_price] = my_budget[valid_price] / lot_current_price[valid_price]
    budget_price_ratio = torch.clamp(budget_price_ratio, 0.0, 10.0) / 10.0
    
    me_block = torch.cat([
        (my_budget / NORM_PRICE).unsqueeze(1),
        budget_price_ratio.unsqueeze(1),
        am_i_high_bidder.float().unsqueeze(1),
        my_best_ability_per_pos / NORM_ABILITY,
        my_open_slots_per_pos.float() / 2.0, # max 2 open slots per pos (CB)
    ], dim=1) # 1 + 1 + 1 + 10 + 10 = 23
    
    # 3. Marginal value (1)
    # MV can be up to ~200, so normalize by NORM_ABILITY
    mv_block = (marginal_value / NORM_ABILITY).unsqueeze(1) # 1
    
    # 4. Opponents (6)
    opp_block = torch.cat([
        (opponents_live_count.float() / 4.0).unsqueeze(1), # max 4 opponents
        (opponents_max_budget / NORM_PRICE).unsqueeze(1),
        (opponents_mean_budget / NORM_PRICE).unsqueeze(1),
        (opponents_need_pos_count.float() / 4.0).unsqueeze(1),
        (opponents_max_budget_need_pos / NORM_PRICE).unsqueeze(1),
        opponents_mean_squad_fill.unsqueeze(1), # already 0-1
    ], dim=1) # 6
    
    # 5. History (22)
    hist_block = torch.cat([
        lots_revealed_per_pos.float() / NORM_LOTS,
        lots_sold_per_pos.float() / NORM_LOTS,
        (lots_remaining.float() / NORM_LOTS).unsqueeze(1),
        fraction_elapsed.unsqueeze(1), # already 0-1
    ], dim=1) # 10 + 10 + 1 + 1 = 22
    
    # 6. Context (1)
    ctx_block = (scoped_pool_size.float() / NORM_POOL).unsqueeze(1) # 1
    
    obs = torch.cat([
        lot_block, me_block, mv_block, opp_block, hist_block, ctx_block
    ], dim=1)
    
    assert obs.shape[1] == 69, f"Obs dimension is {obs.shape[1]}, expected 69"
    return obs
