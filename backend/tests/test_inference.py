import sys
import unittest
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.model.inference import EnhancerInference

from tests.test_helpers import create_temp_image_file


class TestEnhancerInference(unittest.TestCase):
    """Test suite for EnhancerInference engine, deep-learning pipeline, and classical fallback."""

    @classmethod
    def setUpClass(cls):
        cls.sample_image = create_temp_image_file(suffix=".png")
        cls.output_dir = backend_root / "outputs"
        cls.output_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        if cls.sample_image.exists():
            cls.sample_image.unlink()

    def test_inference_with_fallback_cv(self):
        """Tests that when non-existent weights are provided, classical CV fallback activates without crashing."""
        fallback_output = self.output_dir / "test_ci_fallback.png"
        enhancer = EnhancerInference(weights_path="weights/non_existent_weights.pth")
        metrics = enhancer.enhance(self.sample_image, fallback_output)

        self.assertTrue(fallback_output.exists(), "Fallback output image must be written")
        self.assertGreater(fallback_output.stat().st_size, 0)
        self.assertEqual(metrics["inference_mode"], "fallback-classical-cv")
        self.assertIn("processing_time_seconds", metrics)

        if fallback_output.exists():
            fallback_output.unlink()

    def test_force_classical_parameter(self):
        """Tests manual override to classical CV enhancement."""
        forced_output = self.output_dir / "test_ci_forced.png"
        enhancer = EnhancerInference()
        metrics = enhancer.enhance(self.sample_image, forced_output, force_classical=True)

        self.assertTrue(forced_output.exists())
        self.assertEqual(metrics["inference_mode"], "forced-classical-cv")

        if forced_output.exists():
            forced_output.unlink()

    def test_model_based_inference_if_checkpoint_exists(self):
        """Tests deep learning inference if model.pth is present."""
        weights_path = backend_root / "weights" / "model.pth"
        if not weights_path.exists():
            self.skipTest("Trained checkpoint model.pth not present, skipping deep-learning test")

        dl_output = self.output_dir / "test_ci_dl.png"
        enhancer = EnhancerInference(weights_path=str(weights_path))
        metrics = enhancer.enhance(self.sample_image, dl_output)

        self.assertTrue(dl_output.exists())
        self.assertIn("deep-learning", metrics["inference_mode"])
        self.assertIn("estimated_psnr", metrics)

        if dl_output.exists():
            dl_output.unlink()


if __name__ == "__main__":
    unittest.main()
