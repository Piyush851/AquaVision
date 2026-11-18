import io
import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.main import app
from tests.test_helpers import create_synthetic_underwater_image
import cv2


class TestFastAPIRoutes(unittest.TestCase):
    """Test suite for FastAPI REST API endpoints."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Prepare in-memory sample image bytes
        img = create_synthetic_underwater_image(256, 256)
        success, encoded = cv2.imencode(".png", img)
        assert success, "Failed to encode test image"
        cls.image_bytes = encoded.tobytes()

    def test_root_endpoint(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("project", data)
        self.assertEqual(data["status"], "online")

    def test_health_check_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})

    def test_info_endpoint(self):
        response = self.client.get("/api/v1/enhance/info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("device", data)
        self.assertIn("model_loaded", data)

    def test_models_endpoint(self):
        response = self.client.get("/api/v1/enhance/models")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("available_checkpoints", data)
        self.assertIn("active_weights", data)

    def test_upload_and_enhance_endpoint(self):
        response = self.client.post(
            "/api/v1/enhance/upload",
            files={"file": ("test_synthetic.png", io.BytesIO(self.image_bytes), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("id", data)
        self.assertIn("original_url", data)
        self.assertIn("enhanced_url", data)
        self.assertIn("metrics", data)

        # Verify static file retrieval
        res_file = self.client.get(data["enhanced_url"])
        self.assertEqual(res_file.status_code, 200)
        self.assertGreater(len(res_file.content), 0)

    def test_history_endpoint(self):
        response = self.client.get("/api/v1/enhance/history")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)


if __name__ == "__main__":
    unittest.main()
