import sys
import tempfile
from pathlib import Path
import cv2
import numpy as np
import pytest

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))


@pytest.fixture(scope="session")
def sample_bgr_image():
    """Generates a synthetic 256x256 BGR image with simulated underwater color cast."""
    h, w = 256, 256
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Simulate underwater bluish-green cast: B > G > R
    img[:, :, 0] = np.linspace(120, 220, w, dtype=np.uint8)  # Blue
    img[:, :, 1] = np.linspace(80, 180, h, dtype=np.uint8)[:, None]  # Green
    img[:, :, 2] = np.linspace(20, 70, w, dtype=np.uint8)  # Red (attenuated)
    # Add high-contrast feature in center
    cv2.circle(img, (128, 128), 40, (180, 140, 50), -1)
    return img


@pytest.fixture(scope="session")
def sample_image_path(sample_bgr_image):
    """Writes a temporary PNG sample image for testing file-based pipelines."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        temp_path = Path(f.name)
    cv2.imwrite(str(temp_path), sample_bgr_image)
    yield temp_path
    if temp_path.exists():
        temp_path.unlink()
