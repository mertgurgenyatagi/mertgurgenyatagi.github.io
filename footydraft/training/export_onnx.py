import os
import sys

# Add current dir to sys.path to resolve imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import torch
from footydraft_sim.observation import CONTEXT_LEN, CANDIDATE_FEATURE_LEN
from footydraft_sim.env_deal_or_no_deal import OBS_LEN as DOND_OBS_LEN, N_ACTIONS as DOND_N_ACTIONS
from footydraft_sim.env_auction import BIDDING_OBS_LEN, N_BIDDING_ACTIONS
from rl.networks import CandidateScorer, DiscreteHead

def export_candidate_scorer(ckpt_path, out_path):
    print(f"Exporting {ckpt_path} -> {out_path}")
    model = CandidateScorer(CONTEXT_LEN, CANDIDATE_FEATURE_LEN)
    model.load_state_dict(torch.load(ckpt_path, map_location='cpu', weights_only=True))
    model.eval()
    
    # Dummy inputs: Batch size 1, K=5 candidates
    context = torch.randn(1, CONTEXT_LEN)
    candidate_features = torch.randn(1, 5, CANDIDATE_FEATURE_LEN)
    candidate_mask = torch.ones(1, 5, dtype=torch.bool)
    
    torch.onnx.export(
        model, 
        (context, candidate_features, candidate_mask), 
        out_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['context', 'candidate_features', 'candidate_mask'],
        output_names=['logits', 'value'],
        dynamic_axes={
            'candidate_features': {1: 'num_candidates'},
            'candidate_mask': {1: 'num_candidates'},
            'logits': {1: 'num_candidates'}
        }
    )

def export_discrete_head(ckpt_path, out_path, obs_len, n_actions):
    print(f"Exporting {ckpt_path} -> {out_path}")
    model = DiscreteHead(obs_len, n_actions)
    model.load_state_dict(torch.load(ckpt_path, map_location='cpu', weights_only=True))
    model.eval()
    
    features = torch.randn(1, obs_len)
    action_mask = torch.ones(1, n_actions, dtype=torch.bool)
    
    torch.onnx.export(
        model, 
        (features, action_mask), 
        out_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['features', 'action_mask'],
        output_names=['logits', 'value']
    )

if __name__ == '__main__':
    ckpt_dir = 'checkpoints'
    out_dir = '../public/models'
    os.makedirs(out_dir, exist_ok=True)
    
    export_candidate_scorer(os.path.join(ckpt_dir, 'free_pick_optimal.pt'), os.path.join(out_dir, 'free_pick.onnx'))
    export_candidate_scorer(os.path.join(ckpt_dir, 'spin_wheel_optimal.pt'), os.path.join(out_dir, 'spin_wheel.onnx'))
    export_candidate_scorer(os.path.join(ckpt_dir, 'auction_optimal_swap.pt'), os.path.join(out_dir, 'auction_swap.onnx'))
    
    export_discrete_head(os.path.join(ckpt_dir, 'deal_or_no_deal_optimal.pt'), os.path.join(out_dir, 'deal_or_no_deal.onnx'), DOND_OBS_LEN, DOND_N_ACTIONS)
    export_discrete_head(os.path.join(ckpt_dir, 'auction_optimal_bid.pt'), os.path.join(out_dir, 'auction_bid.onnx'), BIDDING_OBS_LEN, N_BIDDING_ACTIONS)
    
    print("Export complete.")
