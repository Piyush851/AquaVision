import tempfile
from pathlib import Path

import cv2
import numpy as np


def create_synthetic_underwater_image(width: int = 256, height: int = 256) -> np.ndarray:
    """Generates a synthetic BGR underwater image with characteristic cyan/green color cast."""
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:, :, 0] = np.linspace(120, 220, width, dtype=np.uint8)  # Blue
    img[:, :, 1] = np.linspace(80, 180, height, dtype=np.uint8)[:, None]  # Green
    img[:, :, 2] = np.linspace(20, 70, width, dtype=np.uint8)  # Red (attenuated)
    cv2.circle(img, (width // 2, height // 2), 40, (180, 140, 50), -1)
    return img

def create_temp_image_file(suffix: str = ".png") -> Path:
    """Creates a temporary synthetic image file on disk and returns its Path."""
    img = create_synthetic_underwater_image()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        temp_path = Path(f.name)
    cv2.imwrite(str(temp_path), img)
    return temp_path
