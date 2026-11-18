"""
AquaVision AI — Coral Reef Health & Bleaching Metrology Engine
Analyzes benthic coral reefs in CIELAB/HSV color space to assess:
- Coral Bleaching Index (thermal stress degradation)
- Live Pigmented Coral Coverage
- Algal Turf Overgrowth
- Ecological Health Classification & Scientific Survey Alerts
"""

from typing import Any

import cv2
import numpy as np


class CoralHealthAnalyzer:
    """
    Automated non-invasive optical coral reef health classifier.
    Detects expulsion of zooxanthellae photosynthetic pigments via luminance-chroma disparity.
    """

    def __init__(self, high_luminance_threshold: int = 170, low_chroma_threshold: float = 28.0):
        self.lum_thresh = high_luminance_threshold
        self.chroma_thresh = low_chroma_threshold

    def analyze_frame(self, img_bgr: np.ndarray) -> dict[str, Any]:
        """
        Processes an enhanced underwater image and returns quantitative coral health metrology.
        """
        h, w = img_bgr.shape[:2]
        total_pixels = h * w

        # 1. Transform to CIELAB space
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l_chan = lab[:, :, 0]
        a_chan = lab[:, :, 1].astype(np.float32) - 128.0
        b_chan = lab[:, :, 2].astype(np.float32) - 128.0
        chroma = np.sqrt(a_chan**2 + b_chan**2)

        # 2. Transform to HSV space for algal turf overgrowth
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        h_chan = hsv[:, :, 0]
        s_chan = hsv[:, :, 1]
        v_chan = hsv[:, :, 2]

        # 3. Detect benthic structural texture (Sobel edge energy)
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
        edge_energy = cv2.magnitude(grad_x, grad_y)
        texture_mask = edge_energy > 25.0

        # 4. Coral segmentation heuristic:
        # Benthic substrate with notable texture and non-abyssal dark values
        benthic_mask = (v_chan > 40) & (texture_mask | (s_chan > 30))

        total_benthic_pixels = int(np.count_nonzero(benthic_mask))
        if total_benthic_pixels < (total_pixels * 0.05):
            # Very sparse benthic structure (likely open pelagic blue water)
            return {
                "coral_detected": False,
                "coverage_pct": round((total_benthic_pixels / total_pixels) * 100, 1),
                "bleaching_index": 0.0,
                "health_status": "Pelagic / Water Column (No Benthos)",
                "health_color": "#64748b",
                "healthy_coral_pct": 0.0,
                "bleached_coral_pct": 0.0,
                "algae_overgrowth_pct": 0.0,
                "recommendation": "Scene dominated by pelagic water column. Insufficient coral reef structure detected."
            }

        # 5. Bleached Coral identification:
        # High luminance (stark white calcium carbonate skeleton) with low chroma
        bleached_mask = benthic_mask & (l_chan > self.lum_thresh) & (chroma < self.chroma_thresh)
        bleached_pixels = int(np.count_nonzero(bleached_mask))

        # 6. Algal Turf Overgrowth:
        # Dark greenish hue (H: 35-85, V: 40-180, moderate S)
        algae_mask = benthic_mask & (h_chan >= 35) & (h_chan <= 85) & (s_chan > 40) & (v_chan < 180)
        algae_pixels = int(np.count_nonzero(algae_mask))

        # 7. Live / Healthy pigmented coral:
        # Remaining benthic structure with rich saturation and non-bleached appearance
        healthy_mask = benthic_mask & (~bleached_mask) & (~algae_mask)
        healthy_pixels = int(np.count_nonzero(healthy_mask))

        # Calculate indices
        bleaching_ratio = bleached_pixels / max(total_benthic_pixels, 1)
        algae_ratio = algae_pixels / max(total_benthic_pixels, 1)
        healthy_ratio = healthy_pixels / max(total_benthic_pixels, 1)

        coverage_pct = round((total_benthic_pixels / total_pixels) * 100, 1)
        bleached_pct = round(bleaching_ratio * 100, 1)
        healthy_pct = round(healthy_ratio * 100, 1)
        algae_pct = round(algae_ratio * 100, 1)

        # Health classification
        if bleaching_ratio < 0.12:
            health_status = "Optimal / Healthy Pigmented Reef"
            health_color = "#10b981"  # Emerald
            recommendation = "Normal coral symbiont density observed. No anomalous thermal bleaching signatures detected."
        elif bleaching_ratio < 0.30:
            health_status = "Marginal Thermal Stress Warning"
            health_color = "#f59e0b"  # Amber
            recommendation = "Partial bleaching detected on exposed upper colony branches. Recommend temporal monitoring."
        else:
            health_status = "Severe Coral Bleaching Alert"
            health_color = "#ef4444"  # Rose/Red
            recommendation = "Extensive coral skeleton exposure (>30%). High vulnerability to macroalgae takeover and colony mortality."

        return {
            "coral_detected": True,
            "coverage_pct": coverage_pct,
            "bleaching_index": round(bleaching_ratio, 3),
            "health_status": health_status,
            "health_color": health_color,
            "healthy_coral_pct": healthy_pct,
            "bleached_coral_pct": bleached_pct,
            "algae_overgrowth_pct": algae_pct,
            "recommendation": recommendation
        }

    def generate_health_overlay(self, img_bgr: np.ndarray) -> np.ndarray:
        """
        Generates an annotated visual inspection map highlighting bleached zones in red/white
        and healthy pigmented zones in emerald green.
        """
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l_chan = lab[:, :, 0]
        a_chan = lab[:, :, 1].astype(np.float32) - 128.0
        b_chan = lab[:, :, 2].astype(np.float32) - 128.0
        chroma = np.sqrt(a_chan**2 + b_chan**2)

        bleached_mask = (l_chan > self.lum_thresh) & (chroma < self.chroma_thresh)

        overlay = img_bgr.copy()
        # Highlight bleached zones with semi-transparent crimson/white contour
        overlay[bleached_mask] = cv2.addWeighted(
            img_bgr[bleached_mask], 0.4,
            np.full_like(img_bgr[bleached_mask], (40, 40, 240)), 0.6, 0
        )
        return overlay
