import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.model.inference import EnhancerInference


class VideoEnhancer:
    """
    Subsea Video Enhancement Engine with Temporal Consistency Stabilization.
    Processes underwater video streams (ROV footage, benthic surveys, diving clips)
    with GPU batch inference and anti-flicker temporal smoothing.
    """

    def __init__(
        self,
        inference_engine: EnhancerInference | None = None,
        temporal_blend: float = 0.25,
        target_fps: int | None = None
    ):
        self.engine = inference_engine or EnhancerInference()
        self.temporal_blend = max(0.0, min(temporal_blend, 0.8))  # EMA factor for flicker reduction
        self.target_fps = target_fps

    def process_video(
        self,
        input_video_path: str,
        output_video_path: str,
        side_by_side: bool = False,
        guided_upsample: bool = True,
        max_frames: int | None = None,
        force_classical: bool = False,
        progress_callback: Callable[[int, int, float], None] | None = None
    ) -> dict[str, Any]:
        """
        Enhances an entire video file from input_video_path to output_video_path.
        
        Args:
            input_video_path: Path to source video.
            output_video_path: Path to write output MP4.
            side_by_side: If True, writes [Raw | Enhanced] split video.
            guided_upsample: If True, uses bilateral guided filtering on output.
            max_frames: Optional cap on frames for quick processing.
            force_classical: If True, uses zero-downtime classical CV equalization instead of neural net.
            progress_callback: Optional callback(current_frame, total_frames, fps).
        """
        cap = cv2.VideoCapture(str(input_video_path))
        if not cap.isOpened():
            raise ValueError(f"Could not open input video: {input_video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        orig_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        out_fps = self.target_fps if self.target_fps else orig_fps

        if max_frames and max_frames < total_frames:
            total_frames = max_frames

        out_width = width * 2 if side_by_side else width
        out_height = height

        out_path = Path(output_video_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        use_imageio = False
        writer = None
        try:
            import imageio
            writer = imageio.get_writer(
                str(out_path),
                fps=out_fps,
                codec='libx264',
                pixelformat='yuv420p',
                macro_block_size=None
            )
            use_imageio = True
        except (ImportError, OSError, ValueError, RuntimeError):
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(out_path), fourcc, out_fps, (out_width, out_height))
            if not writer.isOpened():
                for c in ['avc1', 'XVID', 'MJPG']:
                    fourcc = cv2.VideoWriter_fourcc(*c)
                    writer = cv2.VideoWriter(str(out_path), fourcc, out_fps, (out_width, out_height))
                    if writer.isOpened():
                        break

        prev_enhanced = None
        frame_idx = 0
        start_time = time.time()

        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret or (max_frames and frame_idx >= max_frames):
                    break

                # Inference on single frame
                result = self.engine.enhance_frame(
                    frame,
                    guided_upsample_flag=guided_upsample,
                    return_metrics=False,
                    force_classical=force_classical
                )
                curr_enhanced = result["enhanced_image"]

                # Ensure dimensions match expected output
                if curr_enhanced.shape[:2] != (height, width):
                    curr_enhanced = cv2.resize(curr_enhanced, (width, height))

                # Temporal anti-flicker blending
                if self.temporal_blend > 0 and prev_enhanced is not None:
                    curr_enhanced = cv2.addWeighted(
                        curr_enhanced, 1.0 - self.temporal_blend,
                        prev_enhanced, self.temporal_blend,
                        0.0
                    )
                prev_enhanced = curr_enhanced.copy()

                # Assemble output frame
                if side_by_side:
                    # Overlay visual labels
                    cv2.putText(frame, "RAW CAPTURE", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                    cv2.putText(curr_enhanced, "AQUAVISION ENHANCED", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
                    composite = np.hstack((frame, curr_enhanced))
                    output_frame = composite
                else:
                    output_frame = curr_enhanced

                if use_imageio and writer is not None:
                    rgb_frame = cv2.cvtColor(output_frame, cv2.COLOR_BGR2RGB)
                    writer.append_data(rgb_frame)
                elif writer is not None:
                    writer.write(output_frame)

                frame_idx += 1
                elapsed = time.time() - start_time
                curr_fps = frame_idx / (elapsed + 1e-6)

                if progress_callback:
                    progress_callback(frame_idx, total_frames, curr_fps)

        finally:
            cap.release()
            if use_imageio and writer is not None:
                writer.close()
            elif writer is not None:
                writer.release()

        total_time = time.time() - start_time
        avg_fps = frame_idx / (total_time + 1e-6)

        return {
            "output_path": str(out_path),
            "frames_processed": frame_idx,
            "total_frames": total_frames,
            "average_fps": round(avg_fps, 2),
            "elapsed_seconds": round(total_time, 2),
            "side_by_side": side_by_side
        }
