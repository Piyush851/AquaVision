import time
import cv2
import numpy as np
import torch
from pathlib import Path
from typing import Union, Dict, Any, Optional

from app.model.model import AquaVisionNet
from app.utils.image_processing import (
    preprocess_image,
    preprocess_frame,
    postprocess_tensor,
    apply_clahe,
    apply_white_balance,
    classical_enhancement,
    calculate_psnr,
    calculate_uiqm,
    calculate_uciqe,
    guided_upsample,
    detect_resolution_profile,
    tiled_patch_inference
)


class EnhancerInference:
    """
    Singleton inference engine with model checkpoint loader and automatic classical fallback.
    Supports guided upsampling and non-reference optical quality evaluation (UIQM, UCIQE).
    """
    _instance: Optional["EnhancerInference"] = None

    def __init__(self, weights_path: Optional[str] = None, device_str: str = "auto"):
        backend_root = Path(__file__).resolve().parent.parent.parent
        if not weights_path:
            combined_ckpt = backend_root / "weights" / "model_combined.pth"
            target_path = str(combined_ckpt) if combined_ckpt.exists() else "weights/model.pth"
        else:
            target_path = weights_path
            
        candidate = Path(target_path)
        
        # If relative and not found in cwd, resolve relative to backend_root
        if not candidate.is_absolute() and not candidate.exists():
            backend_candidate = backend_root / candidate
            if backend_candidate.exists():
                candidate = backend_candidate
            else:
                alt_candidate = backend_root / "weights" / candidate.name
                if alt_candidate.exists():
                    candidate = alt_candidate

        self.weights_path = candidate
        
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
    def get_instance(cls, weights_path: Optional[str] = None) -> "EnhancerInference":
        if cls._instance is None:
            cls._instance = cls(weights_path=weights_path)
        return cls._instance

    def reload_weights(self, weights_path: str) -> bool:
        """Dynamically reloads weights from a new checkpoint file."""
        backend_root = Path(__file__).resolve().parent.parent.parent
        candidate = Path(weights_path)
        if not candidate.is_absolute() and not candidate.exists():
            backend_candidate = backend_root / candidate
            if backend_candidate.exists():
                candidate = backend_candidate
            else:
                alt = backend_root / "weights" / candidate.name
                if alt.exists():
                    candidate = alt
        self.weights_path = candidate
        self._load_model()
        return not self.use_fallback

    @torch.no_grad()
    def enhance_frame(
        self,
        raw_bgr: np.ndarray,
        guided_upsample_flag: bool = True,
        return_metrics: bool = True,
        force_classical: bool = False
    ) -> Dict[str, Any]:
        """
        Enhances an in-memory BGR frame with GPU acceleration, optional guided upsampling,
        and real-time optical quality metrology (UIQM, UCIQE, estimated PSNR).
        """
        orig_h, orig_w = raw_bgr.shape[:2]
        res_profile = detect_resolution_profile(orig_w, orig_h)
        start_time = time.time()

        if not force_classical and not self.use_fallback and self.model is not None:
            try:
                if res_profile["strategy"] == "tiled_patch_reconstruct":
                    # Ultra-HD 4K+ adaptive tiled reconstruction
                    enhanced_bgr = tiled_patch_inference(
                        raw_bgr,
                        model=self.model,
                        device=self.device,
                        tile_size=512,
                        overlap=96
                    )
                    mode = "deep-learning (4K tiled patch)"
                else:
                    # Standard or HD multi-scale guided upsampling
                    tensor = preprocess_frame(raw_bgr, img_size=(256, 256)).to(self.device)
                    out_tensor = self.model(tensor)
                    enhanced_low = postprocess_tensor(out_tensor)

                    if guided_upsample_flag and (orig_h, orig_w) != (256, 256):
                        enhanced_bgr = guided_upsample(enhanced_low, raw_bgr)
                    elif (orig_h, orig_w) != (256, 256):
                        enhanced_bgr = cv2.resize(enhanced_low, (orig_w, orig_h), interpolation=cv2.INTER_LANCZOS4)
                    else:
                        enhanced_bgr = enhanced_low

                    mode = "deep-learning (adaptive guided)"
            except Exception as e:
                print(f"[Inference Error] Neural network inference failed ({e}), falling back to classical CV.")
                wb = apply_white_balance(raw_bgr)
                enhanced_bgr = apply_clahe(wb)
                mode = "fallback-classical-cv"
        else:
            wb = apply_white_balance(raw_bgr)
            enhanced_bgr = apply_clahe(wb)
            mode = "forced-classical-cv" if force_classical else "fallback-classical-cv"

        elapsed_sec = round(time.time() - start_time, 4)

        result: Dict[str, Any] = {
            "enhanced_image": enhanced_bgr,
            "inference_mode": mode,
            "device": str(self.device),
            "processing_time_seconds": elapsed_sec,
            "original_dimensions": f"{orig_w}x{orig_h}",
            "resolution_profile": res_profile
        }

        if return_metrics:
            result["uiqm"] = round(calculate_uiqm(enhanced_bgr), 2)
            result["uciqe"] = round(calculate_uciqe(enhanced_bgr), 2)
            result["estimated_psnr"] = round(calculate_psnr(raw_bgr, enhanced_bgr), 2)
            result["raw_uiqm"] = round(calculate_uiqm(raw_bgr), 2)
            result["raw_uciqe"] = round(calculate_uciqe(raw_bgr), 2)

        return result

    @torch.no_grad()
    def enhance(
        self,
        image_path: Union[str, Path],
        output_path: Union[str, Path],
        force_classical: bool = False
    ) -> Dict[str, Any]:
        """
        Enhances an underwater image and writes result to output_path.
        Applies edge-guided upsampling and computes real-time optical metrics (UIQM, UCIQE).
        """
        image_path = Path(image_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        raw_bgr = cv2.imread(str(image_path))
        if raw_bgr is None:
            raise FileNotFoundError(f"Image not found or unreadable: {image_path}")
            
        frame_res = self.enhance_frame(
            raw_bgr,
            guided_upsample_flag=True,
            return_metrics=True,
            force_classical=force_classical
        )
        
        cv2.imwrite(str(output_path), frame_res["enhanced_image"])
        
        return {
            "inference_mode": frame_res["inference_mode"],
            "device": frame_res["device"],
            "processing_time_seconds": frame_res["processing_time_seconds"],
            "estimated_psnr": frame_res["estimated_psnr"],
            "uiqm": frame_res["uiqm"],
            "uciqe": frame_res["uciqe"],
            "raw_uiqm": frame_res.get("raw_uiqm", 0.0),
            "raw_uciqe": frame_res.get("raw_uciqe", 0.0),
            "input_path": str(image_path),
            "output_path": str(output_path),
            "original_dimensions": frame_res["original_dimensions"],
            "resolution_profile": frame_res.get("resolution_profile")
        }
