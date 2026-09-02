# AquaVision 🌊
> **Underwater Image Enhancement (UWIE) System**

AquaVision is a full-stack deep learning application designed to restore optical distortions, color casts (green/blue tint), and haze in underwater photography.

---

## 🛠️ Repository Architecture

- **`backend/`**: FastAPI REST server, PyTorch `AquaVisionNet` model (Residual Attention U-Net architecture), image preprocessing (Gray-World White Balance, CLAHE), training loop, and model inference engine.
- **`frontend/`**: Web user interface for image upload and real-time enhancement comparison.

---

## 🚀 Quick Setup & Run

### Backend

```bash
cd backend
pip install -r requirements.txt
python app/main.py
```

FastAPI Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

For detailed backend documentation, see [backend/README.md](file:///d:/Projects/UWIE/code/AquaVision/backend/README.md).

---

## 📄 License
MIT License
