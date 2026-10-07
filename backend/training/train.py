import os
import sys
import argparse
import random
import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from typing import Tuple, List

# Add parent directory for module imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.model.model import AquaVisionNet
from app.utils.image_processing import calculate_psnr, postprocess_tensor


class UnderwaterDataset(Dataset):
    """
    Dataset loader for paired underwater image enhancement.
    Matches files between raw/ and reference/ folders.
    """
    def __init__(self, data_dir: str, img_size: Tuple[int, int] = (256, 256), is_train: bool = True):
        self.data_dir = Path(data_dir)
        self.img_size = img_size
        self.is_train = is_train
        
        self.raw_dir = self.data_dir / "raw"
        self.ref_dir = self.data_dir / "reference"
        
        self.pairs: List[Tuple[Path, Path]] = []
        
        if self.raw_dir.exists():
            raw_files = sorted(list(self.raw_dir.glob("*.png")) + list(self.raw_dir.glob("*.jpg")))
            for r_file in raw_files:
                ref_file = self.ref_dir / r_file.name
                if ref_file.exists():
                    self.pairs.append((r_file, ref_file))
                elif not self.is_train:
                    # For test/unpaired mode, pair with itself
                    self.pairs.append((r_file, r_file))

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        raw_path, ref_path = self.pairs[idx]
        
        raw_img = cv2.imread(str(raw_path))
        ref_img = cv2.imread(str(ref_path))
        
        if raw_img is None:
            raise ValueError(f"Could not load image: {raw_path}")
        if ref_img is None:
            ref_img = raw_img
            
        raw_img = cv2.cvtColor(raw_img, cv2.COLOR_BGR2RGB)
        ref_img = cv2.cvtColor(ref_img, cv2.COLOR_BGR2RGB)
        
        # Resize to target dimension
        raw_img = cv2.resize(raw_img, (self.img_size[1], self.img_size[0]), interpolation=cv2.INTER_AREA)
        ref_img = cv2.resize(ref_img, (self.img_size[1], self.img_size[0]), interpolation=cv2.INTER_AREA)
        
        # Simple data augmentations during training
        if self.is_train:
            if random.random() > 0.5:
                raw_img = cv2.flip(raw_img, 1)
                ref_img = cv2.flip(ref_img, 1)
            if random.random() > 0.5:
                raw_img = cv2.flip(raw_img, 0)
                ref_img = cv2.flip(ref_img, 0)
                
        # Normalize to [0.0, 1.0] and convert to tensor
        raw_tensor = torch.from_numpy(raw_img).permute(2, 0, 1).float() / 255.0
        ref_tensor = torch.from_numpy(ref_img).permute(2, 0, 1).float() / 255.0
        
        return raw_tensor, ref_tensor


def train(
    train_dir: str = "dataset/train",
    val_dir: str = "dataset/val",
    output_weights: str = "weights/model.pth",
    epochs: int = 10,
    batch_size: int = 4,
    lr: float = 1e-4,
    device_str: str = "auto",
    dry_run: bool = False,
    resume: bool = False,
    resume_from: str = "",
    start_epoch: int = 1
):
    # Device configuration
    if device_str == "cuda" and torch.cuda.is_available():
        device = torch.device("cuda")
    elif device_str == "cpu":
        device = torch.device("cpu")
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
    print(f"Training on device: {device}")
    
    # Target directory setup
    weights_path = Path(output_weights)
    weights_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Datasets and Loaders
    train_dataset = UnderwaterDataset(train_dir, img_size=(256, 256), is_train=True)
    val_dataset = UnderwaterDataset(val_dir, img_size=(256, 256), is_train=False)
    
    print(f"Loaded {len(train_dataset)} training pairs and {len(val_dataset)} validation pairs.")
    
    if len(train_dataset) == 0:
        raise RuntimeError(f"No valid image pairs found in {train_dir}")
        
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0) if len(val_dataset) > 0 else None
    
    # Model, Loss Functions, Optimizer, Scheduler
    model = AquaVisionNet().to(device)
    
    # Checkpoint loading for resume
    ckpt_candidate = Path(resume_from) if resume_from else (weights_path if resume else None)
    if ckpt_candidate and ckpt_candidate.exists():
        try:
            print(f"Loading checkpoint to resume: {ckpt_candidate}")
            state_dict = torch.load(ckpt_candidate, map_location=device)
            model.load_state_dict(state_dict)
            print("Successfully loaded model checkpoint. Resuming training...")
        except Exception as e:
            print(f"[Warning] Could not load checkpoint ({e}). Starting fresh.")
            
    l1_loss = nn.L1Loss()
    mse_loss = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=max(epochs // 3, 1), gamma=0.5)
    
    best_psnr = -1.0
    
    for epoch in range(start_epoch, epochs + 1):
        model.train()
        running_loss = 0.0
        
        for step, (raw_batch, ref_batch) in enumerate(train_loader, 1):
            raw_batch = raw_batch.to(device)
            ref_batch = ref_batch.to(device)
            
            optimizer.zero_grad()
            output_batch = model(raw_batch)
            
            # Loss = L1 + 0.5 * MSE
            loss = l1_loss(output_batch, ref_batch) + 0.5 * mse_loss(output_batch, ref_batch)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            
            if dry_run and step >= 2:
                print(f"[Dry Run] Exiting early at step {step}")
                break
                
        epoch_loss = running_loss / (step if dry_run else len(train_loader))
        scheduler.step()
        
        # Validation PSNR check
        val_psnr = 0.0
        if val_loader:
            model.eval()
            psnr_list = []
            with torch.no_grad():
                for v_step, (raw_val, ref_val) in enumerate(val_loader, 1):
                    raw_val = raw_val.to(device)
                    out_val = model(raw_val)
                    
                    for i in range(out_val.size(0)):
                        out_bgr = postprocess_tensor(out_val[i])
                        ref_bgr = postprocess_tensor(ref_val[i])
                        psnr_list.append(calculate_psnr(out_bgr, ref_bgr))
                        
                    if dry_run and v_step >= 2:
                        break
                        
            val_psnr = float(np.mean(psnr_list)) if psnr_list else 0.0
            
        print(f"Epoch [{epoch}/{epochs}] - Loss: {epoch_loss:.4f} | Val PSNR: {val_psnr:.2f} dB")
        
        # Save model checkpoint
        if val_psnr >= best_psnr or epoch == epochs or dry_run:
            best_psnr = val_psnr
            torch.save(model.state_dict(), weights_path)
            print(f"Saved model checkpoint -> {weights_path}")
            
        if dry_run:
            break
            
    print("Training finished successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AquaVisionNet on underwater dataset.")
    parser.add_argument("--train-dir", type=str, default="dataset/train", help="Training dataset directory")
    parser.add_argument("--val-dir", type=str, default="dataset/val", help="Validation dataset directory")
    parser.add_argument("--weights", type=str, default="weights/model.pth", help="Checkpoint output path")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--device", type=str, default="auto", help="Device (cuda, cpu, auto)")
    parser.add_argument("--dry-run", action="store_true", help="Run quick 1-epoch dry run")
    parser.add_argument("--resume", action="store_true", help="Resume training from existing checkpoint weights")
    parser.add_argument("--resume-from", type=str, default="", help="Explicit path to checkpoint file to resume from")
    parser.add_argument("--start-epoch", type=int, default=1, help="Starting epoch number when resuming")
    
    args = parser.parse_args()
    
    train(
        train_dir=args.train_dir,
        val_dir=args.val_dir,
        output_weights=args.weights,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        device_str=args.device,
        dry_run=args.dry_run,
        resume=args.resume,
        resume_from=args.resume_from,
        start_epoch=args.start_epoch
    )
