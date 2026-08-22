import torch
import numpy as np
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))
from env_auction import BatchedAuctionEnv
from reference_auction import ReferenceAuctionEnv

def test_throughput():
    env = BatchedAuctionEnv(batch_size=1024, device="cpu")
    actions = torch.randint(0, 4, size=(1024, 5))
    for _ in range(10):
        env.step(actions)
    print("Throughput test passed")

if __name__ == "__main__":
    test_throughput()
