import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend root is in sys.path when running `python app/main.py` directly
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes.enhancement import router as enhancement_router

app = FastAPI(
    title="AquaVision Backend API",
    description="Underwater Image Enhancement (UWIE) REST API powered by PyTorch and FastAPI.",
    version="1.0.0"
)

# CORS middleware allowing all origins for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file storage directories
backend_root = Path(__file__).resolve().parent.parent
UPLOAD_DIR = backend_root / "uploads"
OUTPUT_DIR = backend_root / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Mount static directories
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")

# Include routes
app.include_router(enhancement_router)


@app.get("/")
async def root():
    return {
        "project": "AquaVision",
        "service": "Underwater Image Enhancement Backend",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
