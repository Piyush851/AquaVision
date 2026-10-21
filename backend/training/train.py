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
from typing import Tuple, List, Optional

import torch.nn.functional as F

# Add parent directory for module imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.model.model import AquaVisionNet
from app.utils.image_processing import calculate_psnr, postprocess_tensor


class SSIMLoss(nn.Module):
    """
    Differentiable Structural Similarity (SSIM) Loss.
    Penalizes loss of structural textures and luminance contrast.
    """
    def __init__(self, window_size: int = 11, channel: int = 3):
        super().__init__()
        self.window_size = window_size
        self.channel = channel
        self.register_buffer("window", self._create_window(window_size, channel))

    def _gaussian(self, window_size, sigma):
        coords = torch.arange(window_size).float() - window_size // 2
        gauss = torch.exp(-(coords ** 2) / (2 * sigma ** 2))
        return gauss / gauss.sum()

    def _create_window(self, window_size, channel):
        _1d = self._gaussian(window_size, 1.5).unsqueeze(1)
        _2d = _1d.mm(_1d.t()).float().unsqueeze(0).unsqueeze(0)
        return _2d.expand(channel, 1, window_size, window_size).contiguous()

    def forward(self, img1: torch.Tensor, img2: torch.Tensor) -> torch.Tensor:
        channel = img1.size(1)
        if self.window.device != img1.device or self.window.dtype != img1.dtype:
            self.window = self.window.to(device=img1.device, dtype=img1.dtype)
        
        mu1 = F.conv2d(img1, self.window, padding=self.window_size // 2, groups=channel)
        mu2 = F.conv2d(img2, self.window, padding=self.window_size // 2, groups=channel)

        mu1_sq = mu1.pow(2)
        mu2_sq = mu2.pow(2)
        mu1_mu2 = mu1 * mu2

        sigma1_sq = F.conv2d(img1 * img1, self.window, padding=self.window_size // 2, groups=channel) - mu1_sq
        sigma2_sq = F.conv2d(img2 * img2, self.window, padding=self.window_size // 2, groups=channel) - mu2_sq
        sigma12 = F.conv2d(img1 * img2, self.window, padding=self.window_size // 2, groups=channel) - mu1_mu2

        c1 = 0.01 ** 2
        c2 = 0.03 ** 2

        ssim_map = ((2 * mu1_mu2 + c1) * (2 * sigma12 + c2)) / ((mu1_sq + mu2_sq + c1) * (sigma1_sq + sigma2_sq + c2) + 1e-7)
        return 1.0 - ssim_map.mean()



def discover_pairs(data_dir: Path) -> List[Tuple[Path, Path]]:
    """
    Automatically discovers paired degraded and ground truth images across multiple dataset conventions:
    1. UIEB: raw/ and reference/
    2. LSUI: input/ and GT/
    3. EUVP: trainA/ and trainB/ (or Inp/ and GTr/)
    4. EUVP Master: Paired/ folder containing subfolders with trainA/ and trainB/
    """
    pairs: List[Tuple[Path, Path]] = []
    data_dir = Path(data_dir)
    
    # 1. Standard UIEB layout: raw/ vs reference/
    raw_dir = data_dir / "raw"
    ref_dir = data_dir / "reference"
    if raw_dir.exists() and ref_dir.exists():
        raw_files = sorted(list(raw_dir.glob("*.png")) + list(raw_dir.glob("*.jpg")) + list(raw_dir.glob("*.jpeg")))
        for r_file in raw_files:
            target = ref_dir / r_file.name
            if target.exists():
                pairs.append((r_file, target))
        if pairs:
            return pairs

    # 2. LSUI layout: input/ vs GT/
    inp_dir = data_dir / "input"
    gt_dir = data_dir / "GT"
    if inp_dir.exists() and gt_dir.exists():
        inp_files = sorted(list(inp_dir.glob("*.png")) + list(inp_dir.glob("*.jpg")) + list(inp_dir.glob("*.jpeg")))
        for i_file in inp_files:
            target = gt_dir / i_file.name
            if target.exists():
                pairs.append((i_file, target))
        if pairs:
            return pairs

    # 3. EUVP Single Subset: trainA/ vs trainB/
    train_a = data_dir / "trainA"
    train_b = data_dir / "trainB"
    if train_a.exists() and train_b.exists():
        a_files = sorted(list(train_a.glob("*.png")) + list(train_a.glob("*.jpg")) + list(train_a.glob("*.jpeg")) + list(train_a.glob("*.JPEG")))
        for a_file in a_files:
            target = train_b / a_file.name
            if target.exists():
                pairs.append((a_file, target))
        if pairs:
            return pairs

    # 4. EUVP Master directory: recursively look for trainA / trainB pairs
    for sub in data_dir.glob("**/trainA"):
        partner = sub.parent / "trainB"
        if partner.exists():
            for a_file in sorted(list(sub.glob("*.jpg")) + list(sub.glob("*.png")) + list(sub.glob("*.jpeg")) + list(sub.glob("*.JPEG"))):
                target = partner / a_file.name
                if target.exists():
                    pairs.append((a_file, target))

    # 5. EUVP test_samples layout: Inp/ vs GTr/
    inp_sub = data_dir / "Inp"
    gtr_sub = data_dir / "GTr"
    if inp_sub.exists() and gtr_sub.exists():
        for i_file in sorted(list(inp_sub.glob("*.jpg")) + list(inp_sub.glob("*.png"))):
            target = gtr_sub / i_file.name
            if target.exists():
                pairs.append((i_file, target))

    return pairs


class UnderwaterDataset(Dataset):
    """
    Dataset loader for paired underwater image enhancement.
    Accepts explicit pair list or a directory to auto-discover.
    """
    def __init__(
        self,
        data_dir: str = "",
        pairs: Optional[List[Tuple[Path, Path]]] = None,
        img_size: Tuple[int, int] = (256, 256),
        is_train: bool = True
    ):
        self.img_size = img_size
        self.is_train = is_train
        
        if pairs is not None:
            self.pairs = pairs
        elif data_dir:
            self.pairs = discover_pairs(Path(data_dir))
        else:
            self.pairs = []

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


def load_dataset_pairs(
    dataset_name: str = "uieb",
    train_dir: str = "",
    val_dir: str = "",
    val_split: float = 0.1,
    seed: int = 42
) -> Tuple[List[Tuple[Path, Path]], List[Tuple[Path, Path]]]:
    """
    Loads train and val pairs based on dataset selection:
    - 'uieb': dataset/train vs dataset/val
    - 'lsui': dataset/lsui (with automatic 90/10 split)
    - 'euvp': dataset/euvp/Paired (with automatic 90/10 split or validation dirs)
    - 'all': combines UIEB, LSUI, and EUVP
    - 'custom': uses explicit train_dir and val_dir
    """
    backend_root = Path(__file__).resolve().parent.parent
    random.seed(seed)
    
    dataset_name = dataset_name.lower()
    
    if dataset_name == "lsui":
        lsui_root = backend_root / "dataset" / "lsui"
        if not lsui_root.exists():
            lsui_root = Path(r"D:\Projects\UWIE\ProjectManagement\LSUI")
        all_pairs = discover_pairs(lsui_root)
        random.shuffle(all_pairs)
        split_idx = int(len(all_pairs) * (1.0 - val_split))
        train_pairs = all_pairs[:split_idx]
        val_pairs = all_pairs[split_idx:]
        return train_pairs, val_pairs

    elif dataset_name == "euvp":
        euvp_root = backend_root / "dataset" / "euvp"
        if not euvp_root.exists():
            euvp_root = Path(r"D:\Projects\UWIE\ProjectManagement\EUVP")
        all_pairs = discover_pairs(euvp_root / "Paired" if (euvp_root / "Paired").exists() else euvp_root)
        random.shuffle(all_pairs)
        split_idx = int(len(all_pairs) * (1.0 - val_split))
        train_pairs = all_pairs[:split_idx]
        val_pairs = all_pairs[split_idx:]
        return train_pairs, val_pairs

    elif dataset_name == "all":
        # Combine UIEB, LSUI, and EUVP
        t_uieb = discover_pairs(backend_root / "dataset" / "train")
        v_uieb = discover_pairs(backend_root / "dataset" / "val")
        
        t_lsui, v_lsui = load_dataset_pairs("lsui", val_split=val_split, seed=seed)
        t_euvp, v_euvp = load_dataset_pairs("euvp", val_split=val_split, seed=seed)
        
        train_pairs = t_uieb + t_lsui + t_euvp
        val_pairs = v_uieb + v_lsui + v_euvp
        random.shuffle(train_pairs)
        return train_pairs, val_pairs

    else:
        # Default UIEB or custom
        t_dir = Path(train_dir) if train_dir else (backend_root / "dataset" / "train")
        v_dir = Path(val_dir) if val_dir else (backend_root / "dataset" / "val")
        train_pairs = discover_pairs(t_dir)
        val_pairs = discover_pairs(v_dir) if v_dir.exists() else []
        return train_pairs, val_pairs


def train(
    dataset_name: str = "uieb",
    train_dir: str = "",
    val_dir: str = "",
    output_weights: str = "",
    epochs: int = 10,
    batch_size: int = 4,
    lr: float = 1e-4,
    device_str: str = "auto",
    dry_run: bool = False,
    resume: bool = False,
    resume_from: str = "",
    start_epoch: int = 1,
    val_split: float = 0.1,
    num_workers: int = 2,
    use_amp: bool = True
):
    backend_root = Path(__file__).resolve().parent.parent

    # Configure default output weight path based on dataset
    if not output_weights:
        if dataset_name == "lsui":
            output_weights = str(backend_root / "weights" / "model_lsui.pth")
        elif dataset_name == "euvp":
            output_weights = str(backend_root / "weights" / "model_euvp.pth")
        elif dataset_name == "all":
            output_weights = str(backend_root / "weights" / "model_combined.pth")
        else:
            output_weights = str(backend_root / "weights" / "model.pth")
    else:
        # Resolve path
        weights_candidate = Path(output_weights)
        if not weights_candidate.is_absolute():
            weights_candidate = backend_root / weights_candidate
        output_weights = str(weights_candidate)

    # Device configuration
    if device_str == "cuda" and torch.cuda.is_available():
        device = torch.device("cuda")
    elif device_str == "cpu":
        device = torch.device("cpu")
    else:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
    is_cuda = (device.type == "cuda")
    if is_cuda:
        torch.backends.cudnn.benchmark = True
        print(f"[CUDA Acceleration Enabled] Device: {torch.cuda.get_device_name(0)}")
        print(f"[CUDA VRAM] Total Memory: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
    else:
        use_amp = False

    print(f"=== AquaVisionNet Training Engine ===")
    print(f"Dataset Target: {dataset_name.upper()}")
    print(f"Execution Device: {device} | AMP (Mixed Precision): {use_amp}")
    
    # Target directory setup
    weights_path = Path(output_weights)
    weights_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Load dataset pairs
    train_pairs, val_pairs = load_dataset_pairs(
        dataset_name=dataset_name,
        train_dir=train_dir,
        val_dir=val_dir,
        val_split=val_split
    )
    
    train_dataset = UnderwaterDataset(pairs=train_pairs, img_size=(256, 256), is_train=True)
    val_dataset = UnderwaterDataset(pairs=val_pairs, img_size=(256, 256), is_train=False)
    
    print(f"Loaded {len(train_dataset)} training pairs and {len(val_dataset)} validation pairs.")
    
    if len(train_dataset) == 0:
        raise RuntimeError(f"No valid image pairs found for dataset: {dataset_name}")
        
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers if is_cuda else 0,
        pin_memory=is_cuda
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers if is_cuda else 0,
        pin_memory=is_cuda
    ) if len(val_dataset) > 0 else None
    
    # Model, Loss Functions, Optimizer, Scheduler, Scaler
    model = AquaVisionNet().to(device)
    scaler = torch.amp.GradScaler('cuda', enabled=(is_cuda and use_amp))
    
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
    ssim_loss = SSIMLoss().to(device)
    optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=max(epochs // 3, 1), gamma=0.5)
    
    best_psnr = -1.0
    
    for epoch in range(start_epoch, epochs + 1):
        model.train()
        running_loss = 0.0
        
        for step, (raw_batch, ref_batch) in enumerate(train_loader, 1):
            raw_batch = raw_batch.to(device, non_blocking=is_cuda)
            ref_batch = ref_batch.to(device, non_blocking=is_cuda)
            
            optimizer.zero_grad(set_to_none=True)
            
            # Forward pass with Automatic Mixed Precision
            with torch.amp.autocast('cuda', enabled=(is_cuda and use_amp)):
                output_batch = model(raw_batch)
                loss = (
                    l1_loss(output_batch, ref_batch)
                    + 0.5 * mse_loss(output_batch, ref_batch)
                    + 0.2 * ssim_loss(output_batch, ref_batch)
                )
                
            if is_cuda and use_amp:
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                loss.backward()
                optimizer.step()
            
            running_loss += loss.item()
            
            if step % 50 == 0 or step == len(train_loader):
                print(f"  [Epoch {epoch}/{epochs} | Batch {step}/{len(train_loader)}] Current Batch Loss: {loss.item():.4f}", flush=True)

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
                    raw_val = raw_val.to(device, non_blocking=is_cuda)
                    
                    with torch.amp.autocast('cuda', enabled=(is_cuda and use_amp)):
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
            
    print(f"Training for {dataset_name.upper()} finished successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AquaVisionNet on underwater datasets (UIEB, LSUI, EUVP, All).")
    parser.add_argument("--dataset", type=str, default="uieb", choices=["uieb", "lsui", "euvp", "all", "custom"], help="Dataset selection")
    parser.add_argument("--train-dir", type=str, default="", help="Custom training dataset directory")
    parser.add_argument("--val-dir", type=str, default="", help="Custom validation dataset directory")
    parser.add_argument("--weights", type=str, default="", help="Checkpoint output path")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--device", type=str, default="auto", help="Device (cuda, cpu, auto)")
    parser.add_argument("--val-split", type=float, default=0.1, help="Validation split ratio for unpartitioned sets")
    parser.add_argument("--num-workers", type=int, default=2, help="DataLoader CPU worker processes")
    parser.add_argument("--no-amp", action="store_true", help="Disable Automatic Mixed Precision (AMP)")
    parser.add_argument("--dry-run", action="store_true", help="Run quick 1-epoch dry run")
    parser.add_argument("--resume", action="store_true", help="Resume training from existing checkpoint weights")
    parser.add_argument("--resume-from", type=str, default="", help="Explicit path to checkpoint file to resume from")
    parser.add_argument("--start-epoch", type=int, default=1, help="Starting epoch number when resuming")
    
    args = parser.parse_args()
    
    train(
        dataset_name=args.dataset,
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
        start_epoch=args.start_epoch,
        val_split=args.val_split,
        num_workers=args.num_workers,
        use_amp=not args.no_amp
    )
