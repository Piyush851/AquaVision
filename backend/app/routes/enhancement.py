import os
import uuid
import time
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

from app.model.inference import EnhancerInference

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
    metrics: Dict[str, Any]


@router.post("/upload", response_model=EnhancementResponse)
async def upload_and_enhance(file: UploadFile = File(...)):
    """
    Accepts an underwater image file, runs neural network enhancement,
    saves the raw and enhanced files, and returns accessible URLs and performance metrics.
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
        metrics = enhancer.enhance(raw_path, enhanced_path)
        
        return EnhancementResponse(
            id=file_id,
            filename=file.filename or raw_name,
            original_url=f"/uploads/{raw_name}",
            enhanced_url=f"/outputs/{enhanced_name}",
            metrics=metrics
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {str(e)}")


@router.get("/history", response_model=List[Dict[str, Any]])
async def get_history():
    """Returns a list of recently processed enhanced outputs."""
    records = []
    for out_file in OUTPUT_DIR.glob("*_enhanced.png"):
        file_id = out_file.stem.replace("_enhanced", "")
        # Look for corresponding raw file in uploads
        raw_matches = list(UPLOAD_DIR.glob(f"{file_id}_raw.*"))
        raw_url = f"/uploads/{raw_matches[0].name}" if raw_matches else None
        
        records.append({
            "id": file_id,
            "enhanced_file": out_file.name,
            "enhanced_url": f"/outputs/{out_file.name}",
            "original_url": raw_url,
            "created_at": out_file.stat().st_mtime
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
