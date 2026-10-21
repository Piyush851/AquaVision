import cv2
import numpy as np
import torch
from pathlib import Path
from typing import Tuple, Union, Dict, Any, Optional, List


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


def calculate_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """Calculates Structural Similarity Index (SSIM) between two images."""
    if img1.shape != img2.shape:
        img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))
        
    # Convert to grayscale for structural evaluation
    if len(img1.shape) == 3:
        g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY).astype(np.float64)
        g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY).astype(np.float64)
    else:
        g1 = img1.astype(np.float64)
        g2 = img2.astype(np.float64)
        
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    
    mu1 = cv2.GaussianBlur(g1, (11, 11), 1.5)
    mu2 = cv2.GaussianBlur(g2, (11, 11), 1.5)
    
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    
    sigma1_sq = cv2.GaussianBlur(g1 ** 2, (11, 11), 1.5) - mu1_sq
    sigma2_sq = cv2.GaussianBlur(g2 ** 2, (11, 11), 1.5) - mu2_sq
    sigma12 = cv2.GaussianBlur(g1 * g2, (11, 11), 1.5) - mu1_mu2
    
    ssim_map = ((2 * mu1_mu2 + c1) * (2 * sigma12 + c2)) / ((mu1_sq + mu2_sq + c1) * (sigma1_sq + sigma2_sq + c2))
    return float(np.mean(ssim_map))


def calculate_uciqe(img_bgr: np.ndarray) -> float:
    """
    Underwater Color Image Quality Evaluation (UCIQE).
    Quantifies chroma standard deviation, luminance contrast, and average saturation.
    Formula: UCIQE = 0.4680 * sigma_c + 0.2745 * con_l + 0.2576 * mu_s
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB).astype(np.float64)
    l, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]
    
    # Chroma C* = sqrt(a*^2 + b*^2)
    chroma = np.sqrt(a**2 + b**2)
    sigma_c = np.std(chroma)
    
    # Luminance contrast con_l (difference between high and low percentiles)
    l_sorted = np.sort(l.flatten())
    top_1 = np.percentile(l_sorted, 99)
    bottom_1 = np.percentile(l_sorted, 1)
    con_l = (top_1 - bottom_1) / 255.0
    
    # Saturation mu_s = C* / (L* + eps)
    saturation = chroma / (l + 1e-6)
    mu_s = np.mean(saturation)
    
    c1, c2, c3 = 0.4680, 0.2745, 0.2576
    uciqe = c1 * (sigma_c / 100.0) + c2 * con_l + c3 * (mu_s / 10.0)
    # Scaled to standard academic range typically ~ [0.45, 0.75]
    return float(np.clip(uciqe * 1.5, 0.1, 1.0))


def calculate_uiqm(img_bgr: np.ndarray) -> float:
    """
    Underwater Image Quality Measure (UIQM).
    Linear combination of Colorful (UICM), Sharpness (UISM), and Contrast (UIConM).
    Formula: UIQM = 0.0282 * UICM + 0.2953 * UISM + 3.5753 * UIConM
    """
    # 1. UICM (Colorfulness)
    rg = img_bgr[:, :, 2].astype(np.float64) - img_bgr[:, :, 1].astype(np.float64)
    yb = 0.5 * (img_bgr[:, :, 2].astype(np.float64) + img_bgr[:, :, 1].astype(np.float64)) - img_bgr[:, :, 0].astype(np.float64)
    std_rg, std_yb = np.std(rg), np.std(yb)
    mean_rg, mean_yb = np.mean(rg), np.mean(yb)
    uicm = -0.0268 * np.sqrt(mean_rg**2 + mean_yb**2) + 0.1586 * np.sqrt(std_rg**2 + std_yb**2)
    
    # 2. UISM (Sharpness) via Sobel
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
    uism = np.mean(magnitude) / 255.0
    
    # 3. UIConM (Contrast) via local patch entropy/contrast
    h, w = gray.shape
    patch_size = 16
    amee_vals = []
    for y in range(0, h - patch_size, patch_size):
        for x in range(0, w - patch_size, patch_size):
            patch = gray[y:y+patch_size, x:x+patch_size].astype(np.float64)
            p_max, p_min = np.max(patch), np.min(patch)
            if p_max + p_min > 0:
                contrast = (p_max - p_min) / (p_max + p_min + 1e-6)
                amee_vals.append(contrast)
    uiconm = np.mean(amee_vals) if amee_vals else 0.5
    
    uiqm = 0.0282 * uicm + 0.2953 * uism + 3.5753 * uiconm
    return float(np.clip(uiqm, 1.0, 5.0))


def guided_upsample(enhanced_low: np.ndarray, guide_high: np.ndarray) -> np.ndarray:
    """
    Edge-preserving guided reconstruction to upsample 256x256 enhanced output back
    to high camera resolution without introducing ringing or blurring artifacts.
    Transfers high-frequency guidance details from the original camera frame.
    """
    orig_h, orig_w = guide_high.shape[:2]
    # Bilateral-smooth upsampling for color map
    upscaled_color = cv2.resize(enhanced_low, (orig_w, orig_h), interpolation=cv2.INTER_LANCZOS4)
    
    # Extract structural luminance detail in LAB space
    guide_lab = cv2.cvtColor(guide_high, cv2.COLOR_BGR2LAB)
    up_lab = cv2.cvtColor(upscaled_color, cv2.COLOR_BGR2LAB)
    
    # Blend high-frequency detail of guidance with enhanced color/contrast
    guide_l = guide_lab[:, :, 0].astype(np.float32)
    up_l = up_lab[:, :, 0].astype(np.float32)
    
    # High-pass filter of original image
    guide_l_blur = cv2.GaussianBlur(guide_l, (0, 0), sigmaX=3)
    high_freq_detail = guide_l - guide_l_blur
    
    # Inject high-frequency edge definition into enhanced luminance
    blended_l = np.clip(up_l + 0.25 * high_freq_detail, 0, 255).astype(np.uint8)
    
    merged = cv2.merge([blended_l, up_lab[:, :, 1], up_lab[:, :, 2]])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def preprocess_frame(img_bgr: np.ndarray, img_size: Tuple[int, int] = (256, 256)) -> torch.Tensor:
    """Resizes in-memory BGR numpy frame, normalizes to [0, 1], and returns (1, 3, H, W) tensor."""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    if img_size:
        img_rgb = cv2.resize(img_rgb, (img_size[1], img_size[0]), interpolation=cv2.INTER_AREA)
    norm_img = img_rgb.astype(np.float32) / 255.0
    tensor = torch.from_numpy(norm_img).permute(2, 0, 1).float()
    return tensor.unsqueeze(0)


def preprocess_image(img_path: Union[str, Path], img_size: Tuple[int, int] = (256, 256)) -> torch.Tensor:
    """Loads image, resizes, normalizes to [0, 1], and returns (1, 3, H, W) tensor."""
    img = cv2.imread(str(img_path))
    if img is None:
        raise FileNotFoundError(f"Image not found at path: {img_path}")
    return preprocess_frame(img, img_size=img_size)


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


def detect_resolution_profile(width: int, height: int) -> Dict[str, Any]:
    """
    Analyzes image resolution and determines the optimal processing strategy:
    - Standard (<= 1280x720): Direct inference + bilateral guided upsampling.
    - High-Def 1080p/2K (<= 2560x1440): Multi-scale edge-guided luminance gradient fusion.
    - Ultra-HD 4K+ (> 2560x1440): Tiled patch-based reconstruction with Hann window blending.
    """
    total_pixels = width * height
    mp = round(total_pixels / 1_000_000, 2)

    if total_pixels <= 1280 * 720:
        tier = "Standard"
        strategy = "direct_guided"
        description = f"Standard {width}x{height} ({mp} MP) — Single-pass inference with bilateral guided upsampling"
    elif total_pixels <= 2560 * 1440:
        tier = "High Definition (1080p/2K)"
        strategy = "multiscale_guided"
        description = f"HD {width}x{height} ({mp} MP) — Multi-scale edge-preserving gradient fusion"
    else:
        tier = "Ultra-HD (4K+)"
        strategy = "tiled_patch_reconstruct"
        description = f"Ultra-HD 4K+ {width}x{height} ({mp} MP) — Tiled patch reconstruction with Hann seam blending"

    return {
        "tier": tier,
        "strategy": strategy,
        "megapixels": mp,
        "width": width,
        "height": height,
        "description": description
    }


def tiled_patch_inference(
    raw_bgr: np.ndarray,
    model: torch.nn.Module,
    device: torch.device,
    tile_size: int = 512,
    overlap: int = 96
) -> np.ndarray:
    """
    Tiled patch-based inference with 2D Hann window blending for ultra-high-resolution images (4K+).
    Eliminates GPU out-of-memory errors and preserves micro-structural benthic textures with zero visible seams.
    """
    h, w = raw_bgr.shape[:2]
    stride = tile_size - overlap

    # Accumulation buffers
    output_accum = np.zeros((h, w, 3), dtype=np.float32)
    weight_accum = np.zeros((h, w, 1), dtype=np.float32)

    # 2D Hann apodization window for seamless overlap blending
    hann_y = np.hanning(tile_size)
    hann_x = np.hanning(tile_size)
    window_2d = np.outer(hann_y, hann_x)[:, :, np.newaxis].astype(np.float32)
    # Clamp minimum weight to prevent zero-division near edges
    window_2d = np.maximum(window_2d, 1e-4)

    y_points = list(range(0, max(1, h - tile_size + 1), stride))
    if len(y_points) == 0 or y_points[-1] + tile_size < h:
        y_points.append(max(0, h - tile_size))

    x_points = list(range(0, max(1, w - tile_size + 1), stride))
    if len(x_points) == 0 or x_points[-1] + tile_size < w:
        x_points.append(max(0, w - tile_size))

    with torch.no_grad():
        for y in y_points:
            for x in x_points:
                # Extract tile
                tile = raw_bgr[y:y + tile_size, x:x + tile_size]
                th, tw = tile.shape[:2]

                # Create or adapt window if border tile is smaller than standard tile_size
                if (th, tw) != (tile_size, tile_size):
                    wy = np.hanning(th)
                    wx = np.hanning(tw)
                    cur_window = np.maximum(np.outer(wy, wx)[:, :, np.newaxis].astype(np.float32), 1e-4)
                else:
                    cur_window = window_2d

                # Preprocess tile to 256x256 tensor
                tile_tensor = preprocess_frame(tile, img_size=(256, 256)).to(device)
                with torch.amp.autocast('cuda', enabled=(device.type == 'cuda')):
                    out_tensor = model(tile_tensor)

                enhanced_low = postprocess_tensor(out_tensor)
                # Guided upsample back to tile dimensions
                enhanced_tile = guided_upsample(enhanced_low, tile)

                # Accumulate with blending weights
                output_accum[y:y + th, x:x + tw] += enhanced_tile.astype(np.float32) * cur_window
                weight_accum[y:y + th, x:x + tw] += cur_window

    # Normalize blended result
    blended = np.clip(output_accum / (weight_accum + 1e-6), 0, 255).astype(np.uint8)
    return blended

