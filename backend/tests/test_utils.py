import sys
import unittest
from pathlib import Path
import cv2
import numpy as np
import torch

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.utils.image_processing import (
    apply_white_balance,
    apply_clahe,
    calculate_psnr,
    preprocess_image,
    postprocess_tensor,
    classical_enhancement,
)
from tests.test_helpers import create_synthetic_underwater_image, create_temp_image_file


class TestImageProcessingUtils(unittest.TestCase):
    """Test suite for optical image processing utilities and classical enhancement."""

    @classmethod
    def setUpClass(cls):
        cls.img_bgr = create_synthetic_underwater_image(256, 256)
        cls.temp_file = create_temp_image_file()

    @classmethod
    def tearDownClass(cls):
        if cls.temp_file.exists():
            cls.temp_file.unlink()

    def test_apply_white_balance(self):
        wb = apply_white_balance(self.img_bgr)
        self.assertIsInstance(wb, np.ndarray)
        self.assertEqual(wb.dtype, np.uint8)
        self.assertEqual(wb.shape, self.img_bgr.shape)

    def test_apply_clahe(self):
        clahe = apply_clahe(self.img_bgr)
        self.assertIsInstance(clahe, np.ndarray)
        self.assertEqual(clahe.dtype, np.uint8)
        self.assertEqual(clahe.shape, self.img_bgr.shape)

    def test_calculate_psnr_identical(self):
        psnr_self = calculate_psnr(self.img_bgr, self.img_bgr)
        self.assertEqual(psnr_self, 100.0)

    def test_calculate_psnr_different(self):
        modified = cv2.GaussianBlur(self.img_bgr, (5, 5), 0)
        psnr = calculate_psnr(self.img_bgr, modified)
        self.assertIsInstance(psnr, float)
        self.assertGreater(psnr, 0.0)
        self.assertLess(psnr, 100.0)

    def test_preprocess_image(self):
        tensor = preprocess_image(self.temp_file, img_size=(256, 256))
        self.assertIsInstance(tensor, torch.Tensor)
        self.assertEqual(tensor.shape, (1, 3, 256, 256))
        self.assertGreaterEqual(tensor.min().item(), 0.0)
        self.assertLessEqual(tensor.max().item(), 1.0)

    def test_postprocess_tensor(self):
        tensor = torch.rand(1, 3, 128, 128)
        restored = postprocess_tensor(tensor)
        self.assertIsInstance(restored, np.ndarray)
        self.assertEqual(restored.shape, (128, 128, 3))
        self.assertEqual(restored.dtype, np.uint8)

    def test_classical_enhancement_pipeline(self):
        enhanced = classical_enhancement(self.img_bgr)
        self.assertIsInstance(enhanced, np.ndarray)
        self.assertEqual(enhanced.shape, self.img_bgr.shape)
        self.assertEqual(enhanced.dtype, np.uint8)


if __name__ == "__main__":
    unittest.main()
