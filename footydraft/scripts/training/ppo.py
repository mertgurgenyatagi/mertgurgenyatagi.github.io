import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F

class PPO:
    def __init__(self, model, config):
        self.model = model
        self.config = config
        self.optimizer = optim.Adam(model.parameters(), lr=config["lr"])
        
    def update(self, rollouts):
        # rollouts: list of tuples (obs, masks, actions, log_probs, returns, advantages)
        # We assume rollouts are already flattened
        
        obs = rollouts["obs"]
        masks = rollouts["masks"]
        actions = rollouts["actions"]
        old_log_probs = rollouts["log_probs"]
        returns = rollouts["returns"]
        advantages = rollouts["advantages"]
        
        # Normalize advantages
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        
        dataset_size = obs.shape[0]
        batch_size = self.config["batch_size"]
        
        for _ in range(self.config["epochs_per_update"]):
            indices = torch.randperm(dataset_size, device=obs.device)
            
            for start in range(0, dataset_size, batch_size):
                idx = indices[start:start+batch_size]
                
                b_obs = obs[idx]
                b_masks = masks[idx]
                b_actions = actions[idx]
                b_old_log_probs = old_log_probs[idx]
                b_returns = returns[idx]
                b_advantages = advantages[idx]
                
                logits, values = self.model(b_obs, b_masks)
                
                # Action log probs
                log_probs = F.log_softmax(logits, dim=-1)
                new_log_probs = log_probs.gather(1, b_actions.unsqueeze(-1)).squeeze(-1)
                
                # Entropy
                probs = F.softmax(logits, dim=-1)
                entropy = -(probs * log_probs).sum(dim=-1).mean()
                
                # Ratio
                ratio = torch.exp(new_log_probs - b_old_log_probs)
                
                # Policy loss
                surr1 = ratio * b_advantages
                surr2 = torch.clamp(ratio, 1.0 - self.config["clip_epsilon"], 1.0 + self.config["clip_epsilon"]) * b_advantages
                policy_loss = -torch.min(surr1, surr2).mean()
                
                # Value loss
                value_loss = F.mse_loss(values, b_returns)
                
                # Total loss
                loss = policy_loss + self.config["c_value"] * value_loss - self.config["c_entropy"] * entropy
                
                
                self.optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 0.5)
                self.optimizer.step()
                
        return {
            "policy_loss": policy_loss.item(),
            "value_loss": value_loss.item(),
            "entropy": entropy.item()
        }
