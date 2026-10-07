import time
import cv2
import numpy as np
import torch
from pathlib import Path
from typing import Union, Dict, Any, Optional

from app.model.model import AquaVisionNet
from app.utils.image_processing import (
    preprocess_image,
    postprocess_tensor,
    apply_clahe,
    apply_white_balance,
    classical_enhancement,
    calculate_psnr
)


class EnhancerInference:
    """
    Singleton inference engine with model checkpoint loader and automatic classical fallback.
    """
    _instance: Optional["EnhancerInference"] = None

    def __init__(self, weights_path: str = "weights/model.pth", device_str: str = "auto"):
        self.weights_path = Path(weights_path)
        
        # Configure execution device
        if device_str == "cuda" and torch.cuda.is_available():
            self.device = torch.device("cuda")
        elif device_str == "cpu":
            self.device = torch.device("cpu")
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            
        self.model: Optional[AquaVisionNet] = None
        self.use_fallback: bool = False
        self._load_model()

    def _load_model(self):
        """Loads neural network weights or falls back to classical CV."""
        try:
            if not self.weights_path.exists():
                print(f"[Warning] Checkpoint {self.weights_path} not found. Using classical CV fallback.")
                self.use_fallback = True
                return

            model = AquaVisionNet().to(self.device)
            state_dict = torch.load(self.weights_path, map_location=self.device)
            model.load_state_dict(state_dict)
            model.eval()
            self.model = model
            self.use_fallback = False
            print(f"Loaded AquaVisionNet weights from {self.weights_path} to {self.device}")
        except Exception as e:
            print(f"[Error] Failed to load model weights: {e}. Switching to fallback mode.")
            self.model = None
            self.use_fallback = True

    @classmethod
    def get_instance(cls, weights_path: str = "weights/model.pth") -> "EnhancerInference":
        if cls._instance is None:
            cls._instance = cls(weights_path=weights_path)
        return cls._instance

    @torch.no_grad()
    def enhance(
        self,
        image_path: Union[str, Path],
        output_path: Union[str, Path],
        force_classical: bool = False
    ) -> Dict[str, Any]:
        """
        Enhances an underwater image and writes result to output_path.
        Supports force_classical presentation mode and auto-fallback on error.
        """
        image_path = Path(image_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        raw_bgr = cv2.imread(str(image_path))
        if raw_bgr is None:
            raise FileNotFoundError(f"Image not found or unreadable: {image_path}")
            
        orig_h, orig_w = raw_bgr.shape[:2]
        start_time = time.time()
        
        if not force_classical and not self.use_fallback and self.model is not None:
            try:
                # Preprocess to tensor [1, 3, 256, 256]
                tensor = preprocess_image(image_path, img_size=(256, 256)).to(self.device)
                
                # Model forward pass
                out_tensor = self.model(tensor)
                
                # Postprocess back to BGR image
                enhanced_bgr = postprocess_tensor(out_tensor)
                
                # Resize to original resolution
                if (orig_h, orig_w) != (256, 256):
                    enhanced_bgr = cv2.resize(enhanced_bgr, (orig_w, orig_h), interpolation=cv2.INTER_CUBIC)
                    
                mode = "deep-learning"
            except Exception as e:
                print(f"[Inference Error] Neural network inference failed ({e}), falling back to classical CV.")
                wb = apply_white_balance(raw_bgr)
                enhanced_bgr = apply_clahe(wb)
                mode = "fallback-classical-cv"
        else:
            wb = apply_white_balance(raw_bgr)
            enhanced_bgr = apply_clahe(wb)
            mode = "forced-classical-cv" if force_classical else "fallback-classical-cv"
            
        # Save output image
        cv2.imwrite(str(output_path), enhanced_bgr)
        elapsed_sec = round(time.time() - start_time, 4)
        
        psnr_val = round(calculate_psnr(raw_bgr, enhanced_bgr), 2)
        
        return {
            "inference_mode": mode,
            "device": str(self.device),
            "processing_time_seconds": elapsed_sec,
            "estimated_psnr": psnr_val,
            "input_path": str(image_path),
            "output_path": str(output_path),
            "original_dimensions": f"{orig_w}x{orig_h}"
        }
