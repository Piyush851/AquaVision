import cv2
import numpy as np
import torch
from PIL import Image
from typing import Tuple, Union, Optional


def apply_gray_world_white_balance(image_bgr: np.ndarray) -> np.ndarray:
    """
    Applies Gray-World White Balance algorithm to mitigate green/blue color casts 
    common in underwater imagery.
    """
    b, g, r = cv2.split(image_bgr.astype(np.float32))
    
    mean_b = np.mean(b) + 1e-5
    mean_g = np.mean(g) + 1e-5
    mean_r = np.mean(r) + 1e-5

    # Overall gray mean
    gray_mean = (mean_b + mean_g + mean_r) / 3.0

    # Scale channels
    b_scaled = np.clip(b * (gray_mean / mean_b), 0, 255)
    g_scaled = np.clip(g * (gray_mean / mean_g), 0, 255)
    r_scaled = np.clip(r * (gray_mean / mean_r), 0, 255)

    balanced = cv2.merge([b_scaled, g_scaled, r_scaled])
    return balanced.astype(np.uint8)


def apply_clahe(image_bgr: np.ndarray, clip_limit: float = 2.5, tile_grid_size: Tuple[int, int] = (8, 8)) -> np.ndarray:
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE) on L-channel in LAB space.
    """
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    cl = clahe.apply(l)

    enhanced_lab = cv2.merge((cl, a, b))
    enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    return enhanced_bgr


def algorithmic_underwater_enhance(image_bgr: np.ndarray) -> np.ndarray:
    """
    Fallback classical computer vision enhancement pipeline for underwater images.
    Combines Gray-World White Balance, CLAHE contrast tuning, and subtle sharpening.
    """
    wb_img = apply_gray_world_white_balance(image_bgr)
    clahe_img = apply_clahe(wb_img, clip_limit=2.0)
    
    # Subtle unsharp masking for detail recovery
    gaussian = cv2.GaussianBlur(clahe_img, (0, 0), 2.0)
    sharpened = cv2.addWeighted(clahe_img, 1.3, gaussian, -0.3, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def preprocess_image_tensor(
    image_input: Union[np.ndarray, Image.Image],
    target_size: Optional[Tuple[int, int]] = (256, 256)
) -> Tuple[torch.Tensor, Tuple[int, int]]:
    """
    Converts RGB numpy array or PIL Image to PyTorch Tensor [1, 3, H, W] normalized to [0, 1].
    """
    if isinstance(image_input, Image.Image):
        image_np = np.array(image_input.convert("RGB"))
    else:
        # Expecting BGR from OpenCV -> convert to RGB
        image_np = cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB)

    orig_height, orig_width = image_np.shape[:2]

    if target_size is not None:
        image_resized = cv2.resize(image_np, (target_size[1], target_size[0]), interpolation=cv2.INTER_CUBIC)
    else:
        image_resized = image_np

    # HWC -> CHW, range [0.0, 1.0]
    tensor = torch.from_numpy(image_resized).permute(2, 0, 1).float() / 255.0
    tensor = tensor.unsqueeze(0)  # [1, 3, H, W]
    
    return tensor, (orig_height, orig_width)


def postprocess_tensor_image(
    tensor: torch.Tensor,
    original_size: Optional[Tuple[int, int]] = None
) -> np.ndarray:
    """
    Converts output PyTorch Tensor [1, 3, H, W] to BGR numpy array [H, W, 3] for saving via OpenCV.
    """
    if tensor.dim() == 4:
        tensor = tensor.squeeze(0)

    tensor = torch.clamp(tensor, 0.0, 1.0)
    image_np = (tensor.permute(1, 2, 0).cpu().detach().numpy() * 255.0).astype(np.uint8)

    # Convert RGB -> BGR for OpenCV saving
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    if original_size is not None:
        orig_h, orig_w = original_size
        image_bgr = cv2.resize(image_bgr, (orig_w, orig_h), interpolation=cv2.INTER_CUBIC)

    return image_bgr


def calculate_psnr(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Calculates Peak Signal-to-Noise Ratio (PSNR) between two images.
    """
    mse = np.mean((img1.astype(np.float64) - img2.astype(np.float64)) ** 2)
    if mse == 0:
        return 100.0
    pixel_max = 255.0
    return float(20 * np.log10(pixel_max / np.sqrt(mse)))
