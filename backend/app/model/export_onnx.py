import os
from pathlib import Path
import torch
from app.model.model import AquaVisionNet


def export_to_onnx(
    weights_path: str,
    output_onnx_path: str,
    opset_version: int = 17,
    device_str: str = "cpu"
) -> str:
    """
    Exports AquaVisionNet PyTorch weights to optimized ONNX format with dynamic batching.
    Facilitates high-speed edge inference and cross-platform runtime deployment.
    """
    device = torch.device(device_str)
    model = AquaVisionNet().to(device)

    w_path = Path(weights_path)
    if not w_path.exists():
        raise FileNotFoundError(f"Checkpoint weights not found: {weights_path}")

    state_dict = torch.load(str(w_path), map_location=device)
    model.load_state_dict(state_dict)
    model.eval()

    out_path = Path(output_onnx_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    dummy_input = torch.randn(1, 3, 256, 256, device=device)

    torch.onnx.export(
        model,
        dummy_input,
        str(out_path),
        export_params=True,
        opset_version=opset_version,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["enhanced_output"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "enhanced_output": {0: "batch_size"}
        }
    )

    print(f"Successfully exported ONNX model to: {out_path}")
    return str(out_path)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Export AquaVisionNet to ONNX")
    parser.add_argument("--weights", type=str, default="backend/weights/model.pth", help="Path to .pth checkpoint")
    parser.add_argument("--output", type=str, default="backend/weights/model.onnx", help="Path for .onnx output")
    args = parser.parse_args()

    export_to_onnx(args.weights, args.output)
