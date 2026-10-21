# AquaVision Backend 🌊

The backend API and deep learning engine for **AquaVision**, built using **FastAPI**, **PyTorch**, and **OpenCV**.

---

## 📁 Directory Structure

```
backend/
├── app/
│   ├── main.py                    # FastAPI server entrypoint & CORS middleware
│   ├── routes/
│   │   └── enhancement.py          # REST API endpoints (upload, history, info)
│   ├── model/
│   │   ├── model.py                # AquaVisionNet PyTorch Residual Attention U-Net
│   │   └── inference.py            # Model loader & real-time inference manager
│   └── utils/
│       └── image_processing.py     # Gray-World White Balance, CLAHE, PSNR, UIQM calculation
│
├── dataset/                        # Dataset folder layout
│   ├── train/                      # Paired training set (raw/ & reference/)
│   ├── val/                        # Paired validation set (raw/ & reference/)
│   └── test/                       # Test set (raw/ & reference/)
│
├── weights/
│   └── model.pth                   # Trained PyTorch neural network checkpoint
│
├── uploads/                        # Ephemeral raw image storage
├── outputs/                        # Storage for enhanced output images
├── training/
│   └── train.py                    # PyTorch model training and validation pipeline
├── requirements.txt                # Python package dependencies
├── .env.example                    # Environment variable configuration template
└── README.md                       # Backend documentation
```

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- Python 3.9+
- CUDA GPU (optional, auto-fallback to CPU)

### 2. Environment Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Copy example environment configuration
cp .env.example .env
```

### 3. Run FastAPI Server

```bash
python app/main.py
```

- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **OpenAPI ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 📊 Supported Datasets

AquaVision supports multi-dataset training across three benchmark corpora:
- **UIEB (Underwater Image Enhancement Benchmark)**: 890 real-world paired underwater images located in `dataset/train/`, `dataset/val/`, `dataset/test/`.
- **LSUI (Large-Scale Underwater Image Dataset)**: 4,279 paired high-resolution images in `dataset/lsui/` (`input/` and `GT/`).
- **EUVP (Enhancement of Underwater Visual Perception)**: Over 11,400 paired images in `dataset/euvp/Paired/` (`underwater_scenes`, `underwater_dark`, `underwater_imagenet`).

> Note: All raw and reference dataset images are ignored from git version control via `.gitignore`.

---

## 🧠 Model Architecture & Training

`AquaVisionNet` is a **Residual Attention U-Net**:
- **Channel Attention (SE Blocks)**: Recalibrates channel feature maps to counter red light attenuation.
- **Multi-Level Skip Connections**: Preserves fine boundary and textural details.
- **Hybrid Loss**: Combination of L1 pixel loss, MSE loss, and SSIM structural similarity.

### Training the Model
```bash
# 1. Train on UIEB (Default) -> outputs weights/model.pth
python training/train.py --dataset uieb --epochs 25 --batch-size 8 --lr 0.0001

# 2. Train on LSUI (4,279 pairs) -> outputs weights/model_lsui.pth
python training/train.py --dataset lsui --epochs 20 --batch-size 8 --lr 0.0001

# 3. Train on EUVP (11,400+ pairs) -> outputs weights/model_euvp.pth
python training/train.py --dataset euvp --epochs 20 --batch-size 8 --lr 0.0001

# 4. Train Combined Super-Corpus (UIEB + LSUI + EUVP) -> outputs weights/model_combined.pth
python training/train.py --dataset all --epochs 30 --batch-size 16 --lr 0.0001
```

Checkpoints are saved automatically to `weights/`.

---

## 🔌 API Endpoints

### 1. Upload & Enhance
`POST /api/v1/enhance/upload`
- Accepts multipart form data with image file (`file`).
- Returns raw image URL, enhanced image URL, and performance/quality metadata.

### 2. Enhancement History
`GET /api/v1/enhance/history`
- Returns recent image pairs processed in the current session.

### 3. System & Model Info
`GET /api/v1/enhance/info`
- Returns hardware acceleration status, GPU memory, and model checkpoint state.
