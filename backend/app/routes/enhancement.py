import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.model.inference import EnhancerInference

logger = logging.getLogger("aquavision.api")
router = APIRouter(prefix="/api/v1/enhance", tags=["Enhancement"])

backend_root = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = backend_root / "uploads"
OUTPUT_DIR = backend_root / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class EnhancementResponse(BaseModel):
    id: str
    filename: str
    original_url: str
    enhanced_url: str
    annotated_url: str | None = None
    metrics: dict[str, Any]
    detections: list[dict[str, Any]] | None = None
    coral_health: dict[str, Any] | None = None


@router.post("/upload", response_model=EnhancementResponse)
async def upload_and_enhance(
    file: UploadFile = File(...),
    force_classical: bool = False,
    detect_marine: bool = True
):
    """
    Accepts an underwater image file, runs neural network enhancement,
    performs marine species detection & coral bleaching health assessment,
    saves output files, and returns accessible URLs and telemetry.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a valid image.")
        
    file_id = str(uuid.uuid4())[:8]
    ext = Path(file.filename).suffix.lower() or ".jpg"
    
    raw_name = f"{file_id}_raw{ext}"
    enhanced_name = f"{file_id}_enhanced.png"
    
    raw_path = UPLOAD_DIR / raw_name
    enhanced_path = OUTPUT_DIR / enhanced_name
    
    try:
        content = await file.read()
        with open(raw_path, "wb") as f:
            f.write(content)
            
        enhancer = EnhancerInference.get_instance()
        metrics = enhancer.enhance(raw_path, enhanced_path, force_classical=force_classical)
        
        # Marine Biological & Coral Health Intelligence (Milestone B)
        detections = []
        coral_health = None
        annotated_name = None
        if detect_marine and enhanced_path.exists():
            try:
                import cv2

                from app.model.coral_analyzer import CoralHealthAnalyzer
                from app.model.marine_detector import MarineDetector

                enhanced_img = cv2.imread(str(enhanced_path))
                if enhanced_img is not None:
                    # 1. Marine Species & Object Detection
                    detector = MarineDetector.get_instance()
                    detections = detector.detect(enhanced_img, conf_threshold=0.25)

                    # 2. Render Annotated Frame
                    annotated_img = detector.annotate_image(enhanced_img, detections)
                    annotated_name = f"{file_id}_annotated.png"
                    annotated_path = OUTPUT_DIR / annotated_name
                    cv2.imwrite(str(annotated_path), annotated_img)

                    # 3. Coral Health Assessment
                    analyzer = CoralHealthAnalyzer()
                    coral_health = analyzer.analyze_frame(enhanced_img)
            except (RuntimeError, ValueError, OSError) as det_err:
                logger.warning("Marine intelligence processing error: %s", det_err)

        # Persist execution metadata sidecar for history & scientific audit
        meta_data = {
            "id": file_id,
            "filename": file.filename or raw_name,
            "original_url": f"/uploads/{raw_name}",
            "enhanced_url": f"/outputs/{enhanced_name}",
            "annotated_url": f"/outputs/{annotated_name}" if annotated_name else None,
            "created_at": time.time(),
            "metrics": metrics,
            "detections": detections,
            "coral_health": coral_health
        }
        meta_path = OUTPUT_DIR / f"{file_id}_meta.json"
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta_data, f, indent=2)
        except OSError as e:
            logger.warning("Failed to write metadata sidecar: %s", e)

        return EnhancementResponse(
            id=file_id,
            filename=file.filename or raw_name,
            original_url=f"/uploads/{raw_name}",
            enhanced_url=f"/outputs/{enhanced_name}",
            annotated_url=f"/outputs/{annotated_name}" if annotated_name else None,
            metrics=metrics,
            detections=detections,
            coral_health=coral_health
        )
    except (RuntimeError, ValueError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {e!s}")


@router.post("/detect/{file_id}")
async def run_detection_on_existing(file_id: str):
    """Executes on-demand marine detection and coral health assessment on an existing enhanced image."""
    enhanced_path = OUTPUT_DIR / f"{file_id}_enhanced.png"
    if not enhanced_path.exists():
        raise HTTPException(status_code=404, detail=f"Enhanced image for ID {file_id} not found.")

    import cv2

    from app.model.coral_analyzer import CoralHealthAnalyzer
    from app.model.marine_detector import MarineDetector

    enhanced_img = cv2.imread(str(enhanced_path))
    if enhanced_img is None:
        raise HTTPException(status_code=500, detail="Failed to read enhanced image.")

    detector = MarineDetector.get_instance()
    detections = detector.detect(enhanced_img, conf_threshold=0.25)
    annotated_img = detector.annotate_image(enhanced_img, detections)
    
    annotated_name = f"{file_id}_annotated.png"
    cv2.imwrite(str(OUTPUT_DIR / annotated_name), annotated_img)

    analyzer = CoralHealthAnalyzer()
    coral_health = analyzer.analyze_frame(enhanced_img)

    # Update metadata sidecar
    meta_path = OUTPUT_DIR / f"{file_id}_meta.json"
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            meta["annotated_url"] = f"/outputs/{annotated_name}"
            meta["detections"] = detections
            meta["coral_health"] = coral_health
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, indent=2)
        except (OSError, json.JSONDecodeError) as err:
            logger.warning("Could not update metadata sidecar: %s", err)

    return {
        "id": file_id,
        "annotated_url": f"/outputs/{annotated_name}",
        "detections": detections,
        "coral_health": coral_health
    }


@router.get("/history", response_model=list[dict[str, Any]])
async def get_history():
    """Returns a list of recently processed enhanced outputs with real optical metrics."""
    records = []
    for out_file in OUTPUT_DIR.glob("*_enhanced.png"):
        file_id = out_file.stem.replace("_enhanced", "")
        # Look for corresponding raw file in uploads
        raw_matches = list(UPLOAD_DIR.glob(f"{file_id}_raw.*"))
        raw_url = f"/uploads/{raw_matches[0].name}" if raw_matches else None
        
        # Load persisted metrics sidecar if available
        meta_file = OUTPUT_DIR / f"{file_id}_meta.json"
        metrics = None
        orig_filename = None
        annotated_url = None
        detections = None
        coral_health = None
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta_json = json.load(f)
                    metrics = meta_json.get("metrics")
                    orig_filename = meta_json.get("filename")
                    annotated_url = meta_json.get("annotated_url")
                    detections = meta_json.get("detections")
                    coral_health = meta_json.get("coral_health")
            except (OSError, json.JSONDecodeError) as err:
                logger.warning("Could not read metadata sidecar for %s: %s", file_id, err)

        records.append({
            "id": file_id,
            "filename": orig_filename or out_file.name,
            "enhanced_file": out_file.name,
            "enhanced_url": f"/outputs/{out_file.name}",
            "original_url": raw_url,
            "annotated_url": annotated_url,
            "created_at": out_file.stat().st_mtime,
            "metrics": metrics,
            "detections": detections,
            "coral_health": coral_health
        })
        
    records.sort(key=lambda x: x["created_at"], reverse=True)
    return records


@router.get("/info")
async def get_system_info():
    """Returns runtime device and model status."""
    enhancer = EnhancerInference.get_instance()
    return {
        "status": "ready",
        "device": str(enhancer.device),
        "model_loaded": not enhancer.use_fallback,
        "weights_path": str(enhancer.weights_path)
    }


@router.get("/models")
async def list_available_models():
    """Lists available trained model checkpoints and active weights."""
    enhancer = EnhancerInference.get_instance()
    weights_dir = backend_root / "weights"
    available = []
    if weights_dir.exists():
        # Clean sort: model_combined.pth first, then lsui, euvp, uieb
        candidates = [p for p in weights_dir.glob("*.pth") if "backup" not in p.name.lower()]
        candidates.sort(key=lambda p: (
            0 if p.name == "model_combined.pth" else
            1 if p.name == "model_lsui.pth" else
            2 if p.name == "model_euvp.pth" else
            3 if p.name == "model.pth" else 4
        ))
        for p in candidates:
            available.append({
                "filename": p.name,
                "path": str(p),
                "size_mb": round(p.stat().st_size / (1024 * 1024), 2),
                "is_active": (p.name == enhancer.weights_path.name)
            })
    return {
        "active_weights": str(enhancer.weights_path),
        "active_model_name": enhancer.weights_path.name,
        "available_checkpoints": available
    }


class SwitchModelRequest(BaseModel):
    model_name: str


@router.post("/switch-model")
async def switch_model(payload: SwitchModelRequest):
    """Dynamically activates a specific model checkpoint (e.g., model_lsui.pth, model_euvp.pth)."""
    enhancer = EnhancerInference.get_instance()
    weights_candidate = backend_root / "weights" / payload.model_name
    if not weights_candidate.exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint {payload.model_name} not found.")

    success = enhancer.reload_weights(str(weights_candidate))
    return {
        "success": success,
        "active_model": enhancer.weights_path.name,
        "device": str(enhancer.device),
        "mode": "deep-learning" if not enhancer.use_fallback else "classical-fallback"
    }


@router.post("/report/{file_id}")
async def generate_report_endpoint(
    file_id: str,
    operator: str = "Piyush Saini (23EEAIT043)",
    supervisor: str = "Mrs. Bhanupriya Sharma (Engineering College Ajmer)",
    notes: str | None = None
):
    """
    Generates a formal Engineering Inspection Report PDF for a previously enhanced frame.
    Incorporates side-by-side evidence, metrology gains, and marine species/coral assessments.
    """
    from fastapi.responses import FileResponse

    from app.utils.report_generator import generate_inspection_pdf

    meta_file = OUTPUT_DIR / f"{file_id}_meta.json"
    if not meta_file.exists():
        raise HTTPException(status_code=404, detail=f"Inspection record {file_id} not found.")

    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    # Locate raw and enhanced paths
    raw_matches = list(UPLOAD_DIR.glob(f"{file_id}_raw.*"))
    if not raw_matches:
        raise HTTPException(status_code=404, detail="Raw frame file not found.")
    raw_path = raw_matches[0]
    enhanced_path = OUTPUT_DIR / f"{file_id}_enhanced.png"
    if not enhanced_path.exists():
        raise HTTPException(status_code=404, detail="Enhanced frame file not found.")

    annotated_match = OUTPUT_DIR / f"{file_id}_annotated.png"
    annotated_img_path = str(annotated_match) if annotated_match.exists() else None

    pdf_out = OUTPUT_DIR / f"{file_id}_report.pdf"
    generate_inspection_pdf(
        raw_img_path=str(raw_path),
        enhanced_img_path=str(enhanced_path),
        metrics=meta.get("metrics", {}),
        output_pdf_path=str(pdf_out),
        operator_name=operator,
        supervisor=supervisor,
        notes=notes,
        detections=meta.get("detections"),
        coral_health=meta.get("coral_health"),
        annotated_img_path=annotated_img_path
    )

    return FileResponse(
        str(pdf_out),
        media_type="application/pdf",
        filename=f"AquaVision_Inspection_{file_id}.pdf"
    )


class BatchZipRequest(BaseModel):
    file_ids: list[str] | None = None


@router.post("/batch")
async def process_batch_images(
    files: list[UploadFile] = File(...),
    force_classical: bool = False,
    detect_marine: bool = True
):
    """
    Asynchronously processes a batch of underwater images or a directory upload queue.
    Applies AquaVisionNet enhancement, optical quality metrology, and biological marine detection.
    """
    import cv2

    from app.model.coral_analyzer import CoralHealthAnalyzer
    from app.model.marine_detector import MarineDetector

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded in batch.")

    t0 = time.time()
    enhancer = EnhancerInference.get_instance()
    detector = MarineDetector.get_instance() if detect_marine else None
    coral_analyzer = CoralHealthAnalyzer() if detect_marine else None

    results = []
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            continue

        file_id = str(uuid.uuid4())[:8]
        ext = Path(file.filename or "").suffix.lower() or ".jpg"
        raw_name = f"{file_id}_raw{ext}"
        enhanced_name = f"{file_id}_enhanced.png"

        raw_path = UPLOAD_DIR / raw_name
        enhanced_path = OUTPUT_DIR / enhanced_name

        try:
            content = await file.read()
            with open(raw_path, "wb") as f:
                f.write(content)

            metrics = enhancer.enhance(raw_path, enhanced_path, force_classical=force_classical)

            detections = []
            coral_health = None
            annotated_name = None

            if detect_marine and enhanced_path.exists():
                try:
                    enhanced_img = cv2.imread(str(enhanced_path))
                    if enhanced_img is not None and detector:
                        detections = detector.detect(enhanced_img, conf_threshold=0.25)
                        annotated_img = detector.annotate_image(enhanced_img, detections)
                        annotated_name = f"{file_id}_annotated.png"
                        cv2.imwrite(str(OUTPUT_DIR / annotated_name), annotated_img)

                    if enhanced_img is not None and coral_analyzer:
                        coral_health = coral_analyzer.analyze_frame(enhanced_img)
                except (RuntimeError, ValueError, OSError) as de:
                    logger.warning("Batch detection error on %s: %s", file.filename, de)

            meta_data = {
                "id": file_id,
                "filename": file.filename or raw_name,
                "original_url": f"/uploads/{raw_name}",
                "enhanced_url": f"/outputs/{enhanced_name}",
                "annotated_url": f"/outputs/{annotated_name}" if annotated_name else None,
                "created_at": time.time(),
                "metrics": metrics,
                "detections": detections,
                "coral_health": coral_health
            }
            meta_path = OUTPUT_DIR / f"{file_id}_meta.json"
            try:
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, indent=2)
            except OSError as err:
                logger.warning("Could not write sidecar for %s: %s", file_id, err)

            results.append(meta_data)
        except (RuntimeError, ValueError, OSError) as e:
            logger.error("Failed to process %s: %s", file.filename, e)

    elapsed = round(time.time() - t0, 2)
    avg_fps = round(len(results) / elapsed, 1) if elapsed > 0 else 0.0

    return {
        "total_submitted": len(files),
        "total_processed": len(results),
        "elapsed_seconds": elapsed,
        "average_fps": avg_fps,
        "items": results
    }


@router.post("/batch/zip")
async def download_batch_zip(payload: BatchZipRequest | None = None):
    """
    Packages enhanced outputs, HUD annotated frames, and scientific metadata sidecars into a single downloadable ZIP.
    """
    import zipfile

    file_ids = payload.file_ids if (payload and payload.file_ids) else []

    # If no specific IDs provided, bundle recent enhanced images
    if not file_ids:
        for out_file in sorted(OUTPUT_DIR.glob("*_enhanced.png"), key=lambda p: p.stat().st_mtime, reverse=True)[:50]:
            file_ids.append(out_file.stem.replace("_enhanced", ""))

    if not file_ids:
        raise HTTPException(status_code=404, detail="No enhanced images found to package into ZIP.")

    zip_filename = f"AquaVision_Batch_{int(time.time())}.zip"
    zip_path = OUTPUT_DIR / zip_filename

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        manifest = []
        for fid in file_ids:
            enh_p = OUTPUT_DIR / f"{fid}_enhanced.png"
            ann_p = OUTPUT_DIR / f"{fid}_annotated.png"
            meta_p = OUTPUT_DIR / f"{fid}_meta.json"

            if enh_p.exists():
                zf.write(enh_p, arcname=f"enhanced/{fid}_enhanced.png")
            if ann_p.exists():
                zf.write(ann_p, arcname=f"annotated/{fid}_annotated.png")
            if meta_p.exists():
                zf.write(meta_p, arcname=f"metadata/{fid}_meta.json")
                try:
                    with open(meta_p, "r", encoding="utf-8") as f:
                        manifest.append(json.load(f))
                except (OSError, json.JSONDecodeError) as err:
                    logger.warning("Could not load sidecar %s into manifest: %s", meta_p, err)

        manifest_data = json.dumps(manifest, indent=2)
        zf.writestr("manifest.json", manifest_data)

    return FileResponse(
        path=str(zip_path),
        filename=zip_filename,
        media_type="application/zip"
    )


@router.post("/batch/report")
async def generate_batch_survey_report(
    payload: BatchZipRequest | None = None,
    operator: str = "Piyush Saini (23EEAIT043)",
    supervisor: str = "Mrs. Bhanupriya Sharma (Engineering College Ajmer)",
    mission_title: str = "Subsea Inspection Survey Mission"
):
    """
    Generates an official multi-image Marine Survey PDF Inspection Report for a batch of images.
    """
    from app.utils.report_generator import generate_batch_survey_pdf

    file_ids = payload.file_ids if (payload and payload.file_ids) else []
    records = []

    if not file_ids:
        for meta_file in sorted(OUTPUT_DIR.glob("*_meta.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:25]:
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    records.append(json.load(f))
            except (OSError, json.JSONDecodeError) as err:
                logger.warning("Could not load report record from %s: %s", meta_file, err)
    else:
        for fid in file_ids:
            meta_file = OUTPUT_DIR / f"{fid}_meta.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        records.append(json.load(f))
                except (OSError, json.JSONDecodeError) as err:
                    logger.warning("Could not load report record from %s: %s", meta_file, err)

    if not records:
        raise HTTPException(status_code=404, detail="No inspection records found for batch report.")

    report_pdf_name = f"AquaVision_Batch_Survey_{int(time.time())}.pdf"
    report_pdf_path = OUTPUT_DIR / report_pdf_name

    generate_batch_survey_pdf(
        batch_records=records,
        output_pdf_path=str(report_pdf_path),
        operator_name=operator,
        supervisor=supervisor,
        survey_name=mission_title
    )

    return FileResponse(
        path=str(report_pdf_path),
        filename=report_pdf_name,
        media_type="application/pdf"
    )


MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}


@router.post("/video")
async def enhance_video_endpoint(
    file: UploadFile = File(...),
    side_by_side: bool = True,
    max_frames: int | None = 300
):
    """
    Upload and enhance an underwater video with GPU batch inference and anti-flicker temporal smoothing.
    Enforces a strict 50 MB upload size limit and supported video container verification.
    """
    from app.utils.video_processor import VideoEnhancer

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}"
        )

    file_id = str(uuid.uuid4())[:8]
    raw_video_path = UPLOAD_DIR / f"{file_id}_video_raw{ext}"
    out_video_name = f"{file_id}_video_enhanced.mp4"
    out_video_path = OUTPUT_DIR / out_video_name

    # Enforce stream size limit of 50 MB without loading entire huge files in RAM
    total_size = 0
    with open(raw_video_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            total_size += len(chunk)
            if total_size > MAX_VIDEO_SIZE_BYTES:
                f.close()
                if raw_video_path.exists():
                    raw_video_path.unlink()
                raise HTTPException(
                    status_code=413,
                    detail=f"Video file exceeds maximum allowable size of 50 MB (uploaded {round(total_size / (1024*1024), 1)} MB)."
                )
            f.write(chunk)

    enhancer = EnhancerInference.get_instance()
    processor = VideoEnhancer(inference_engine=enhancer, temporal_blend=0.25)

    try:
        stats = processor.process_video(
            input_video_path=str(raw_video_path),
            output_video_path=str(out_video_path),
            side_by_side=side_by_side,
            max_frames=max_frames
        )
        return {
            "id": file_id,
            "filename": file.filename,
            "enhanced_video_url": f"/outputs/{out_video_name}",
            "raw_video_url": f"/uploads/{raw_video_path.name}",
            "stats": stats
        }
    except (RuntimeError, ValueError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Video enhancement failed: {e!s}")


@router.get("/benchmark")
async def get_benchmark_results(recalculate: bool = False):
    """
    Returns quantitative metrology benchmark results comparing all models and datasets.
    Includes UIQM, UCIQE, PSNR, SSIM, Latency, and Throughput (FPS).
    """
    from training.benchmark import BENCHMARK_JSON, run_benchmark

    try:
        if not recalculate and BENCHMARK_JSON.exists():
            with open(BENCHMARK_JSON, "r", encoding="utf-8") as f:
                return json.load(f)
        
        # Compute or reload
        data = run_benchmark(max_samples_per_domain=8, use_cached=(not recalculate))
        return data
    except (RuntimeError, ValueError, OSError) as e:
        raise HTTPException(status_code=500, detail=f"Benchmark generation failed: {e!s}")


@router.get("/benchmark/export/{export_format}")
async def export_benchmark(export_format: str):
    """Exports benchmark metrology data as raw CSV or LaTeX table for academic presentations."""
    from training.benchmark import BENCHMARK_CSV, BENCHMARK_TEX, run_benchmark

    if not BENCHMARK_CSV.exists() or not BENCHMARK_TEX.exists():
        run_benchmark(max_samples_per_domain=6, use_cached=False)

    if export_format.lower() == "csv":
        if not BENCHMARK_CSV.exists():
            raise HTTPException(status_code=404, detail="CSV benchmark report not found.")
        return FileResponse(
            path=str(BENCHMARK_CSV),
            filename="aquavision_benchmark_results.csv",
            media_type="text/csv"
        )
    elif export_format.lower() in ("tex", "latex"):
        if not BENCHMARK_TEX.exists():
            raise HTTPException(status_code=404, detail="LaTeX benchmark table not found.")
        with open(BENCHMARK_TEX, "r", encoding="utf-8") as f:
            content = f.read()
        return {"latex": content}
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported: 'csv', 'latex'.")

