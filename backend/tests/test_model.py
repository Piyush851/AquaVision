import sys
import unittest
from pathlib import Path
import torch

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.model.model import AquaVisionNet


class TestAquaVisionNet(unittest.TestCase):
    """Test suite for AquaVisionNet Residual Attention U-Net architecture."""

    def setUp(self):
        self.model = AquaVisionNet(in_channels=3, out_channels=3, base_channels=32)
        self.model.eval()

    def test_model_instantiation_and_parameter_count(self):
        total_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
        self.assertGreater(total_params, 1_000_000, "Model should have over 1M parameters")

    def test_forward_pass_shape(self):
        dummy_input = torch.randn(2, 3, 256, 256)
        with torch.no_grad():
            output = self.model(dummy_input)
        self.assertEqual(output.shape, (2, 3, 256, 256))

    def test_output_bounds(self):
        dummy_input = torch.randn(1, 3, 256, 256)
        with torch.no_grad():
            output = self.model(dummy_input)
        self.assertGreaterEqual(output.min().item(), 0.0)
        self.assertLessEqual(output.max().item(), 1.0)

    def test_backward_gradient_flow(self):
        self.model.train()
        dummy_input = torch.randn(1, 3, 128, 128, requires_grad=True)
        output = self.model(dummy_input)
        target = torch.rand(1, 3, 128, 128)
        loss = torch.nn.functional.l1_loss(output, target)
        loss.backward()

        has_grad = any(p.grad is not None and torch.sum(torch.abs(p.grad)) > 0 for p in self.model.parameters())
        self.assertTrue(has_grad, "Model parameters must receive gradients during backpropagation")


if __name__ == "__main__":
    unittest.main()
