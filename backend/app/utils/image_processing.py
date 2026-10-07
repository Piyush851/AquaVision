import cv2
import numpy as np
import torch
from pathlib import Path
from typing import Tuple, Union


def apply_white_balance(img: np.ndarray) -> np.ndarray:
    """Gray-World white balance to correct underwater color casts."""
    b, g, r = cv2.split(img.astype(np.float32))
    
    mean_b = np.mean(b) + 1e-6
    mean_g = np.mean(g) + 1e-6
    mean_r = np.mean(r) + 1e-6
    
    gray_mean = (mean_b + mean_g + mean_r) / 3.0
    
    b_scaled = np.clip(b * (gray_mean / mean_b), 0, 255)
    g_scaled = np.clip(g * (gray_mean / mean_g), 0, 255)
    r_scaled = np.clip(r * (gray_mean / mean_r), 0, 255)
    
    balanced = cv2.merge([b_scaled, g_scaled, r_scaled])
    return balanced.astype(np.uint8)


def apply_clahe(img: np.ndarray, clip_limit: float = 2.0, tile_grid_size: Tuple[int, int] = (8, 8)) -> np.ndarray:
    """Applies CLAHE on the L-channel in LAB color space."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    cl = clahe.apply(l)
    
    merged_lab = cv2.merge((cl, a, b))
    return cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)


def calculate_psnr(target: np.ndarray, ref: np.ndarray) -> float:
    """Calculates Peak Signal-to-Noise Ratio between target and reference images."""
    if target.shape != ref.shape:
        ref = cv2.resize(ref, (target.shape[1], target.shape[0]))
        
    mse = np.mean((target.astype(np.float64) - ref.astype(np.float64)) ** 2)
    if mse <= 1e-10:
        return 100.0
    return float(20 * np.log10(255.0 / np.sqrt(mse)))


def preprocess_image(img_path: Union[str, Path], img_size: Tuple[int, int] = (256, 256)) -> torch.Tensor:
    """Loads image, resizes, normalizes to [0, 1], and returns (1, 3, H, W) tensor."""
    img = cv2.imread(str(img_path))
    if img is None:
        raise FileNotFoundError(f"Image not found at path: {img_path}")
        
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    if img_size:
        img_rgb = cv2.resize(img_rgb, (img_size[1], img_size[0]), interpolation=cv2.INTER_AREA)
        
    norm_img = img_rgb.astype(np.float32) / 255.0
    tensor = torch.from_numpy(norm_img).permute(2, 0, 1).float()
    return tensor.unsqueeze(0)


def postprocess_tensor(tensor: torch.Tensor) -> np.ndarray:
    """Converts a normalized (1, 3, H, W) or (3, H, W) tensor to a uint8 BGR image."""
    if tensor.dim() == 4:
        tensor = tensor.squeeze(0)
        
    img_np = tensor.detach().cpu().numpy().transpose(1, 2, 0)
    img_rgb = (img_np * 255.0).clip(0, 255).astype(np.uint8)
    return cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)


def classical_enhancement(img_bgr: np.ndarray) -> np.ndarray:
    """Combines white balance and CLAHE for fallback processing."""
    wb = apply_white_balance(img_bgr)
    return apply_clahe(wb)
