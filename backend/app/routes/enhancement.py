import os
import uuid
import time
import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from app.model.inference import get_enhancer
from app.utils.image_processing import calculate_psnr

router = APIRouter(prefix="/api/v1/enhance", tags=["Image Enhancement"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "outputs"))

# Ensure storage directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class EnhancementResponse(BaseModel):
    id: str
    filename: str
    raw_url: str
    enhanced_url: str
    timestamp: float
    metadata: Dict[str, Any]


@router.post("/upload", response_model=EnhancementResponse)
async def upload_and_enhance(
    file: UploadFile = File(...)
):
    """
    Accepts an uploaded underwater image file (JPG, PNG, WEBP), performs enhancement,
    and returns metadata along with static file access URLs.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File uploaded must be an image (JPEG, PNG, WEBP).")

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        raw_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if raw_bgr is None:
            raise HTTPException(status_code=400, detail="Could not decode uploaded image file.")

        # Generate unique task ID
        file_id = str(uuid.uuid4())[:8]
        extension = Path(file.filename).suffix or ".jpg"
        raw_filename = f"{file_id}_raw{extension}"
        enhanced_filename = f"{file_id}_enhanced.png"

        raw_path = UPLOAD_DIR / raw_filename
        enhanced_path = OUTPUT_DIR / enhanced_filename

        # Save raw image
        cv2.imwrite(str(raw_path), raw_bgr)

        # Execute enhancement pipeline
        enhancer = get_enhancer()
        start_time = time.time()
        enhanced_bgr, meta = enhancer.enhance_image(raw_bgr)
        proc_time = round(time.time() - start_time, 3)

        # Save enhanced output
        cv2.imwrite(str(enhanced_path), enhanced_bgr)

        meta["processing_time_seconds"] = proc_time

        return EnhancementResponse(
            id=file_id,
            filename=file.filename,
            raw_url=f"/uploads/{raw_filename}",
            enhanced_url=f"/outputs/{enhanced_filename}",
            timestamp=time.time(),
            metadata=meta
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enhancement processing failed: {str(e)}")


@router.get("/history", response_model=List[Dict[str, Any]])
async def get_enhancement_history():
    """
    Returns list of recently processed enhanced outputs.
    """
    results = []
    for file_path in OUTPUT_DIR.glob("*_enhanced.png"):
        file_id = file_path.stem.split("_")[0]
        results.append({
            "id": file_id,
            "enhanced_file": file_path.name,
            "enhanced_url": f"/outputs/{file_path.name}",
            "created_at": file_path.stat().st_mtime
        })
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return results


@router.get("/info")
async def get_model_info():
    """
    Returns model status, device info, and backend health.
    """
    enhancer = get_enhancer()
    return {
        "status": "ready",
        "device": str(enhancer.device),
        "model_loaded": enhancer.is_loaded,
        "weights_path": str(enhancer.weights_path)
    }
