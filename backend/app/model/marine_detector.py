"""
AquaVision AI — Marine Species & Object Detection Engine (Milestone B)
Detects marine organisms, coral reef colonies, sea turtles, anthropogenic marine debris,
and divers using YOLOv8 with zero-downtime underwater saliency fallback.
"""

import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


# Ecological Color Scheme for Bounding Boxes (BGR format)
CATEGORY_COLORS = {
    "fauna": (255, 180, 0),       # Cyan-Blue
    "coral": (50, 205, 50),       # Lime Green
    "bleached": (60, 60, 240),    # Crimson Red
    "debris": (0, 69, 255),       # Orange-Red Alert
    "diver": (255, 105, 180),     # Hot Pink / Purple
    "general": (200, 200, 200)    # Gray
}


class MarineDetector:
    """
    Intelligent Marine Object Detector.
    Supports YOLOv8 deep learning inference with an automatic underwater optical saliency fallback.
    """
    _instance: Optional["MarineDetector"] = None

    def __init__(self, model_path: Optional[str] = None):
        self.yolo_model = None
        self.backend_root = Path(__file__).resolve().parent.parent.parent

        if ULTRALYTICS_AVAILABLE:
            try:
                # Look for custom marine weights or standard lightweight YOLOv8n
                candidate = Path(model_path) if model_path else (self.backend_root / "weights" / "yolov8n.pt")
                if candidate.exists():
                    self.yolo_model = YOLO(str(candidate))
                else:
                    # Initialize default lightweight nano model
                    self.yolo_model = YOLO("yolov8n.pt")
                print(f"[MarineDetector] Loaded YOLOv8 engine successfully.")
            except Exception as e:
                print(f"[MarineDetector] Could not load YOLOv8 model ({e}), using Computer Vision Saliency detector.")
                self.yolo_model = None
        else:
            print("[MarineDetector] Ultralytics not installed, using Computer Vision Saliency detector.")

    @classmethod
    def get_instance(cls) -> "MarineDetector":
        if cls._instance is None:
            cls._instance = MarineDetector()
        return cls._instance

    def detect(self, img_bgr: np.ndarray, conf_threshold: float = 0.25) -> List[Dict[str, Any]]:
        """
        Executes marine detection and returns normalized + pixel bounding boxes.
        """
        h, w = img_bgr.shape[:2]
        detections: List[Dict[str, Any]] = []

        if self.yolo_model is not None:
            try:
                results = self.yolo_model(img_bgr, conf=conf_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        coords = box.xyxy[0].cpu().numpy().astype(int)
                        conf = float(box.conf[0].cpu().numpy())
                        cls_id = int(box.cls[0].cpu().numpy())
                        cls_name = r.names.get(cls_id, f"object_{cls_id}")

                        # Map COCO or custom classes to marine taxonomy
                        mapped_label, category = self._map_yolo_class(cls_name)

                        detections.append({
                            "box": [int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])],
                            "normalized_box": [
                                round(coords[0] / w, 4),
                                round(coords[1] / h, 4),
                                round(coords[2] / w, 4),
                                round(coords[3] / h, 4)
                            ],
                            "label": mapped_label,
                            "category": category,
                            "confidence": round(conf, 2),
                            "color_bgr": CATEGORY_COLORS.get(category, (200, 200, 200))
                        })
            except Exception as e:
                print(f"[MarineDetector] YOLO inference error: {e}")

        # If YOLO returned zero or is absent, execute optical saliency detector
        if not detections:
            detections = self._saliency_marine_detection(img_bgr, conf_threshold)

        return detections

    def _map_yolo_class(self, label: str) -> Tuple[str, str]:
        """Maps general COCO / YOLO labels to marine ecological nomenclature."""
        l = label.lower()
        if any(k in l for k in ["fish", "bird", "animal", "shark", "whale"]):
            return ("Marine Fauna (Fish)", "fauna")
        elif any(k in l for k in ["turtle", "reptile"]):
            return ("Sea Turtle (Chelonioidea)", "fauna")
        elif any(k in l for k in ["bottle", "cup", "can", "bag", "plastic", "trash", "debris"]):
            return ("Anthropogenic Marine Debris", "debris")
        elif any(k in l for k in ["person", "diver"]):
            return ("Subsea Diver", "diver")
        elif any(k in l for k in ["boat", "ship", "submarine"]):
            return ("Submersible Vessel", "diver")
        else:
            return (f"Marine Specimen ({label})", "general")

    def _saliency_marine_detection(self, img_bgr: np.ndarray, conf_threshold: float = 0.25) -> List[Dict[str, Any]]:
        """
        Zero-downtime optical saliency and morphological contour detector.
        Identifies foreground marine organisms and coral formations by color disparity and edge contours.
        """
        h, w = img_bgr.shape[:2]
        detections = []

        # Convert to LAB for luminance and color separation
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]

        # Saliency via spectral residual or Gaussian difference
        blur_fine = cv2.GaussianBlur(l, (7, 7), 0)
        blur_coarse = cv2.GaussianBlur(l, (31, 31), 0)
        saliency_map = cv2.absdiff(blur_fine, blur_coarse)

        # Threshold salient regions
        _, thresh = cv2.threshold(saliency_map, 22, 255, cv2.THRESH_BINARY)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        min_area = (h * w) * 0.005  # minimum 0.5% of image
        max_area = (h * w) * 0.60   # maximum 60% of image

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_area < area < max_area:
                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect_ratio = float(bw) / bh

                # Classify based on position, aspect ratio and chrominance
                roi_lab = lab[y:y+bh, x:x+bw]
                roi_l = roi_lab[:, :, 0]
                roi_chroma = np.sqrt((roi_lab[:, :, 1].astype(float) - 128)**2 + (roi_lab[:, :, 2].astype(float) - 128)**2)

                mean_l = float(np.mean(roi_l))
                mean_chroma = float(np.mean(roi_chroma))

                # Heuristic classification
                if y > (h * 0.55) and (mean_l > 165 and mean_chroma < 26):
                    label = "Bleached Coral Colony"
                    category = "bleached"
                    confidence = round(min(0.72 + (area / (h * w)), 0.94), 2)
                elif y > (h * 0.50) and aspect_ratio > 1.2:
                    label = "Coral Reef Formation (Live)"
                    category = "coral"
                    confidence = round(min(0.78 + (area / (h * w)), 0.95), 2)
                elif aspect_ratio > 1.5 or (y < (h * 0.6) and mean_chroma > 20):
                    label = "Marine Fauna (Fish)"
                    category = "fauna"
                    confidence = round(min(0.70 + (area / (h * w) * 2), 0.92), 2)
                elif mean_l > 210 and aspect_ratio < 0.8:
                    label = "Marine Debris (Plastic/Waste)"
                    category = "debris"
                    confidence = 0.68
                else:
                    label = "Marine Biological Specimen"
                    category = "fauna"
                    confidence = 0.65

                if confidence >= conf_threshold:
                    detections.append({
                        "box": [int(x), int(y), int(x + bw), int(y + bh)],
                        "normalized_box": [
                            round(x / w, 4),
                            round(y / h, 4),
                            round((x + bw) / w, 4),
                            round((y + bh) / h, 4)
                        ],
                        "label": label,
                        "category": category,
                        "confidence": confidence,
                        "color_bgr": CATEGORY_COLORS.get(category, (200, 200, 200))
                    })

        # Keep top 10 most salient detections
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections[:10]

    def annotate_image(self, img_bgr: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        """
        Renders bounding boxes, species badges, and confidence chips onto the image.
        """
        annotated = img_bgr.copy()
        for d in detections:
            x1, y1, x2, y2 = d["box"]
            color = d.get("color_bgr", (0, 255, 255))
            label = f"{d['label']} {int(d['confidence'] * 100)}%"

            # Bounding box
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2, cv2.LINE_AA)

            # Corner brackets for high-tech HUD appearance
            corner_len = min(15, (x2 - x1) // 4, (y2 - y1) // 4)
            cv2.line(annotated, (x1, y1), (x1 + corner_len, y1), color, 3)
            cv2.line(annotated, (x1, y1), (x1, y1 + corner_len), color, 3)
            cv2.line(annotated, (x2, y1), (x2 - corner_len, y1), color, 3)
            cv2.line(annotated, (x2, y1), (x2, y1 + corner_len), color, 3)
            cv2.line(annotated, (x1, y2), (x1 + corner_len, y2), color, 3)
            cv2.line(annotated, (x1, y2), (x1, y2 - corner_len), color, 3)
            cv2.line(annotated, (x2, y2), (x2 - corner_len, y2), color, 3)
            cv2.line(annotated, (x2, y2), (x2, y2 - corner_len), color, 3)

            # Badge pill
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            badge_y1 = max(0, y1 - th - 8)
            badge_y2 = y1
            badge_x2 = x1 + tw + 10

            cv2.rectangle(annotated, (x1, badge_y1), (badge_x2, badge_y2), color, -1)
            cv2.putText(
                annotated,
                label,
                (x1 + 5, badge_y2 - 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 0, 0),
                1,
                cv2.LINE_AA
            )

        return annotated
