# AquaVision Backend

**AquaVision** is a high-performance **Underwater Image Enhancement (UWIE)** API and deep learning system built using **FastAPI**, **PyTorch**, and **OpenCV**.

---

## 📁 File & Directory Structure

```
backend/
│
├── app/
│   ├── main.py                    # FastAPI web server entrypoint & middleware configuration
│   │
│   ├── routes/
│   │   └── enhancement.py          # REST API endpoints for uploading & enhancing images
│   │
│   ├── model/
│   │   ├── model.py                # AquaVisionNet PyTorch deep learning network
│   │   └── inference.py            # Model loader & real-time inference manager
│   │
│   └── utils/
│       └── image_processing.py     # Image preprocessing, Gray-World White Balance & CLAHE
│
├── dataset/
│   ├── train/                      # Training underwater image dataset
│   ├── val/                        # Validation dataset
│   └── test/                       # Test image samples
│
├── weights/
│   └── model.pth                   # Trained PyTorch neural network checkpoint
│
├── uploads/                        # Temporary store for raw user uploaded images
├── outputs/                        # Storage location for enhanced output images
│
├── training/
│   └── train.py                    # Complete PyTorch model training script
│
├── .env                            # Active environment configuration
├── .env.example                    # Environment template
├── .gitignore                      # Git exclusion patterns
├── requirements.txt                # Python package dependencies
└── README.md                       # Backend documentation & setup guide
```

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- Python 3.9+ installed
- CUDA-compatible GPU (optional, automatically uses CPU if unavailable)

### 2. Install Dependencies

```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment (optional)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install required packages
pip install -r requirements.txt
```

---

## 🚀 Running the API Server

Start the FastAPI application server using `uvicorn`:

```bash
python app/main.py
```
Or directly with uvicorn CLI:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Interactive API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative OpenAPI Docs (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🔌 API Endpoints

### 1. Upload & Enhance Image
`POST /api/v1/enhance/upload`

**Request Body:** `multipart/form-data`
- `file`: Underwater image file (JPEG, PNG, WEBP)

**Response Example:**
```json
{
  "id": "a1b2c3d4",
  "filename": "underwater_sample.jpg",
  "raw_url": "/uploads/a1b2c3d4_raw.jpg",
  "enhanced_url": "/outputs/a1b2c3d4_enhanced.png",
  "timestamp": 1725281234.56,
  "metadata": {
    "method": "AquaVision Deep Learning Neural Network",
    "device": "cuda",
    "original_resolution": "1920x1080",
    "estimated_psnr": 28.45,
    "model_checkpoint_active": true,
    "processing_time_seconds": 0.124
  }
}
```

### 2. View History
`GET /api/v1/enhance/history`

Returns a list of recently processed image pairs.

### 3. Model & System Info
`GET /api/v1/enhance/info`

Returns device state, GPU availability, and model weights status.

---

## 🧠 Model Architecture & Training

`AquaVisionNet` is a multi-scale **Residual U-Net** featuring:
- **Channel Attention Blocks (Squeeze-and-Excitation)** to compensate for wavelength-dependent light attenuation (red light absorption underwater).
- **Multi-level Skip Connections** to retain fine textural details.
- **Hybrid L1 + MSE + SSIM Loss** for color fidelity and structural preservation.

### Train Model

To train the network on custom underwater datasets (e.g. UIEB, EUVP):

```bash
python training/train.py --dataset dataset/train --val dataset/val --epochs 25 --batch-size 8 --lr 0.0001
```

Training checkpoints will be automatically saved to `weights/model.pth`.
