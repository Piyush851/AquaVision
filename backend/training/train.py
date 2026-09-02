import os
import sys
import argparse
import logging
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from typing import Tuple

# Add app parent directory to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.model.model import AquaVisionNet
from app.utils.image_processing import calculate_psnr

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("aquavision.train")


class UnderwaterDataset(Dataset):
    """
    Dataset loader for paired underwater image training.
    Expects dataset directory to contain subfolders 'raw' and 'ground_truth' or paired image names.
    If ground_truth is absent, falls back to self-supervised / synthetic pairing demonstration.
    """
    def __init__(self, data_dir: str, image_size: Tuple[int, int] = (256, 256)):
        self.data_dir = Path(data_dir)
        self.image_size = image_size
        
        self.raw_dir = self.data_dir / "raw"
        self.gt_dir = self.data_dir / "ground_truth"

        if self.raw_dir.exists():
            self.image_paths = list(self.raw_dir.glob("*.jpg")) + list(self.raw_dir.glob("*.png"))
        else:
            self.image_paths = list(self.data_dir.glob("*.jpg")) + list(self.data_dir.glob("*.png"))

    def __len__(self):
        return max(len(self.image_paths), 10)  # Demo minimum length fallback

    def __getitem__(self, idx: int):
        if len(self.image_paths) > 0:
            img_path = self.image_paths[idx % len(self.image_paths)]
            raw_img = cv2.imread(str(img_path))
            raw_img = cv2.cvtColor(raw_img, cv2.COLOR_BGR2RGB)
            
            gt_path = self.gt_dir / img_path.name if self.gt_dir.exists() else None
            if gt_path and gt_path.exists():
                gt_img = cv2.imread(str(gt_path))
                gt_img = cv2.cvtColor(gt_img, cv2.COLOR_BGR2RGB)
            else:
                gt_img = raw_img  # Fallback demo pair
        else:
            # Synthetic tensor generation for demo run validation
            raw_img = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
            gt_img = np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)

        raw_resized = cv2.resize(raw_img, (self.image_size[1], self.image_size[0]))
        gt_resized = cv2.resize(gt_img, (self.image_size[1], self.image_size[0]))

        raw_tensor = torch.from_numpy(raw_resized).permute(2, 0, 1).float() / 255.0
        gt_tensor = torch.from_numpy(gt_resized).permute(2, 0, 1).float() / 255.0

        return raw_tensor, gt_tensor


def train(
    dataset_dir: str = "dataset/train",
    val_dir: str = "dataset/val",
    output_weights: str = "weights/model.pth",
    epochs: int = 10,
    batch_size: int = 4,
    lr: float = 1e-4,
    device_str: str = "auto"
):
    """
    Main training function for AquaVisionNet.
    """
    device = torch.device("cuda" if (device_str in ["auto", "cuda"] and torch.cuda.is_available()) else "cpu")
    logger.info(f"Starting training on device: {device}")

    # Create directories
    weights_path = Path(output_weights)
    weights_path.parent.mkdir(parents=True, exist_ok=True)

    # Initialize Dataset and DataLoader
    train_dataset = UnderwaterDataset(dataset_dir)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)

    val_dataset = UnderwaterDataset(val_dir)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)

    # Initialize Model, Criterion, Optimizer
    model = AquaVisionNet().to(device)
    l1_loss = nn.L1Loss()
    mse_loss = nn.MSELoss()
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    best_psnr = 0.0

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0

        for step, (raw_batch, gt_batch) in enumerate(train_loader, 1):
            raw_batch = raw_batch.to(device)
            gt_batch = gt_batch.to(device)

            optimizer.zero_grad()
            output_batch = model(raw_batch)

            # Combined L1 + MSE loss for color restoration & sharp edge preservation
            loss = l1_loss(output_batch, gt_batch) + 0.5 * mse_loss(output_batch, gt_batch)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        avg_loss = total_loss / max(len(train_loader), 1)
        scheduler.step()

        # Validation Step
        model.eval()
        val_psnr_list = []
        with torch.no_grad():
            for raw_val, gt_val in val_loader:
                raw_val = raw_val.to(device)
                gt_val = gt_val.to(device)
                out_val = model(raw_val)

                # Convert to numpy for PSNR
                out_np = (out_val[0].permute(1, 2, 0).cpu().numpy() * 255.0).astype(np.uint8)
                gt_np = (gt_val[0].permute(1, 2, 0).cpu().numpy() * 255.0).astype(np.uint8)
                val_psnr_list.append(calculate_psnr(gt_np, out_np))

        avg_psnr = np.mean(val_psnr_list) if val_psnr_list else 0.0
        logger.info(f"Epoch [{epoch}/{epochs}] - Loss: {avg_loss:.4f} | Val PSNR: {avg_psnr:.2f} dB")

        # Save checkpoint if best PSNR or at final epoch
        if avg_psnr >= best_psnr or epoch == epochs:
            best_psnr = avg_psnr
            torch.save(model.state_dict(), weights_path)
            logger.info(f"Saved model checkpoint to {weights_path}")

    logger.info("Training process completed successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AquaVision Underwater Image Enhancement Model")
    parser.add_argument("--dataset", type=str, default="dataset/train", help="Path to training dataset folder")
    parser.add_argument("--val", type=str, default="dataset/val", help="Path to validation dataset folder")
    parser.add_argument("--weights", type=str, default="weights/model.pth", help="Path to save output weights checkpoint")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Training batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--device", type=str, default="auto", help="Device (auto, cuda, cpu)")

    args = parser.parse_args()
    train(
        dataset_dir=args.dataset,
        val_dir=args.val,
        output_weights=args.weights,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        device_str=args.device
    )
