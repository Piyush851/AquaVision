import os
import torch
import numpy as np
import logging
from pathlib import Path
from typing import Tuple, Union, Optional
from PIL import Image

from app.model.model import AquaVisionNet
from app.utils.image_processing import (
    preprocess_image_tensor,
    postprocess_tensor_image,
    algorithmic_underwater_enhance,
    calculate_psnr
)

logger = logging.getLogger("aquavision.inference")

class EnhancerInference:
    """
    Inference Manager for AquaVision model.
    Handles device configuration, checkpoint weight loading, and forward pass processing.
    """
    def __init__(self, weights_path: str = "weights/model.pth", device_str: str = "auto"):
        self.weights_path = Path(weights_path)
        self.device = self._select_device(device_str)
        self.model = None
        self.is_loaded = False
        
        self.initialize_model()

    def _select_device(self, device_str: str) -> torch.device:
        if device_str == "cuda" and torch.cuda.is_available():
            return torch.device("cuda")
        elif device_str == "cpu":
            return torch.device("cpu")
        else:
            return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def initialize_model(self):
        """Loads model structure and weights if checkpoint exists."""
        try:
            self.model = AquaVisionNet().to(self.device)
            if self.weights_path.exists() and self.weights_path.stat().st_size > 0:
                logger.info(f"Loading checkpoint from {self.weights_path} to {self.device}")
                state_dict = torch.load(self.weights_path, map_location=self.device)
                self.model.load_state_dict(state_dict)
                self.model.eval()
                self.is_loaded = True
            else:
                logger.warning(
                    f"Weight file '{self.weights_path}' not found or empty. "
                    "Inference will run with algorithmic hybrid fallback mode."
                )
                self.model.eval()
                self.is_loaded = False
        except Exception as e:
            logger.error(f"Error initializing model weights: {e}")
            self.is_loaded = False

    @torch.no_grad()
    def enhance_image(
        self,
        image_input: Union[np.ndarray, Image.Image],
        target_size: Optional[Tuple[int, int]] = (256, 256)
    ) -> Tuple[np.ndarray, dict]:
        """
        Enhances raw underwater image. Returns (enhanced_bgr_image, metadata).
        """
        if isinstance(image_input, Image.Image):
            import cv2
            img_np = np.array(image_input)
            raw_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
        else:
            raw_bgr = image_input

        orig_shape = raw_bgr.shape[:2]

        if self.is_loaded and self.model is not None:
            # Deep learning inference route
            input_tensor, _ = preprocess_image_tensor(raw_bgr, target_size=target_size)
            input_tensor = input_tensor.to(self.device)
            
            output_tensor = self.model(input_tensor)
            enhanced_bgr = postprocess_tensor_image(output_tensor, original_size=orig_shape)
            method_used = "AquaVision Deep Learning Neural Network"
        else:
            # Algorithmic computer vision fallback route
            enhanced_bgr = algorithmic_underwater_enhance(raw_bgr)
            method_used = "AquaVision Classical CV Pipeline (White Balance + CLAHE)"

        psnr_val = calculate_psnr(raw_bgr, enhanced_bgr)

        metadata = {
            "method": method_used,
            "device": str(self.device),
            "original_resolution": f"{orig_shape[1]}x{orig_shape[0]}",
            "estimated_psnr": round(psnr_val, 2),
            "model_checkpoint_active": self.is_loaded
        }

        return enhanced_bgr, metadata


# Global singleton engine instance
_enhancer_instance: Optional[EnhancerInference] = None

def get_enhancer(weights_path: str = "weights/model.pth") -> EnhancerInference:
    global _enhancer_instance
    if _enhancer_instance is None:
        _enhancer_instance = EnhancerInference(weights_path=weights_path)
    return _enhancer_instance
