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

## 📊 Dataset: Underwater Image Enhancement Benchmark (UIEB)

AquaVision is trained on the standard **UIEB** dataset:
- **Total Paired Samples**: 890 real-world underwater images with paired reference ground-truths.
- **Degradation Profiles**: Green/blue color casts, severe turbidity, haze, and low-light backscatter.

### Dataset Directory Setup
```
backend/dataset/
├── train/
│   ├── raw/           # Place raw input training images here
│   └── reference/     # Place corresponding ground truth images here
├── val/
│   ├── raw/
│   └── reference/
└── test/
    ├── raw/
    └── reference/
```

---

## 🧠 Model Architecture & Training

`AquaVisionNet` is a **Residual Attention U-Net**:
- **Channel Attention (SE Blocks)**: Recalibrates channel feature maps to counter red light attenuation.
- **Multi-Level Skip Connections**: Preserves fine boundary and textural details.
- **Hybrid Loss**: Combination of L1 pixel loss, MSE loss, and SSIM structural similarity.

### Training the Model
```bash
python training/train.py --dataset dataset/train --val dataset/val --epochs 25 --batch-size 8 --lr 0.0001
```

Checkpoints are saved automatically to `weights/model.pth`.

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
