import io
import sys
import unittest
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

import cv2
from app.database.cache import (
    get_guest_enhancement_count,
    increment_guest_enhancement_count,
    set_guest_enhancement_count,
)
from app.database.connection import SessionLocal, init_db
from app.database.models import EnhancementRecord
from app.main import app

from tests.test_helpers import create_synthetic_underwater_image


class TestAuthAndGuestSystem(unittest.TestCase):
    """Test suite for user authentication, 24h session caching, guest quota, and DB cataloging."""

    @classmethod
    def setUpClass(cls):
        init_db()
        cls.client = TestClient(app)
        img = create_synthetic_underwater_image(256, 256)
        success, encoded = cv2.imencode(".png", img)
        assert success, "Failed to encode test image"
        cls.image_bytes = encoded.tobytes()

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_signup_creates_user_and_auto_logs_in(self):
        """Tests that sign up creates a user and immediately returns a 24-hour token (no second login)."""
        unique_email = f"marine_lead_{uuid.uuid4().hex[:6]}@ecajmer.ac.in"
        payload = {
            "name": "Piyush Saini",
            "email": unique_email,
            "password": "SecurePassword123!"
        }
        response = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["expires_in_hours"], 24)
        self.assertEqual(data["user"]["name"], "Piyush Saini")
        self.assertEqual(data["user"]["email"], unique_email)

        # Verify profile can be fetched immediately with returned token
        me_resp = self.client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {data['token']}"}
        )
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["email"], unique_email)

    def test_signup_duplicate_email_fails(self):
        """Tests that registering with an existing email returns 400 Bad Request."""
        email = f"dup_{uuid.uuid4().hex[:6]}@example.com"
        payload = {"name": "Test User", "email": email, "password": "Password123!"}
        res1 = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(res1.status_code, 201)

        res2 = self.client.post("/api/v1/auth/signup", json=payload)
        self.assertEqual(res2.status_code, 400)
        self.assertIn("already exists", res2.json()["detail"])

    def test_login_success_and_failure(self):
        """Tests login credentials verification."""
        email = f"login_test_{uuid.uuid4().hex[:6]}@test.com"
        self.client.post("/api/v1/auth/signup", json={"name": "Alice", "email": email, "password": "Password123!"})

        # Correct password
        res_ok = self.client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        self.assertEqual(res_ok.status_code, 200)
        self.assertIn("token", res_ok.json())

        # Wrong password
        res_fail = self.client.post("/api/v1/auth/login", json={"email": email, "password": "WrongPassword"})
        self.assertEqual(res_fail.status_code, 401)

    def test_guest_quota_enforcement(self):
        """Tests that a guest cannot exceed 5 image enhancements."""
        test_guest_id = f"test_guest_{uuid.uuid4().hex[:8]}"
        set_guest_enhancement_count(test_guest_id, 0)

        # Check initial quota
        status_resp = self.client.get("/api/v1/auth/guest-status", headers={"X-Guest-ID": test_guest_id})
        self.assertEqual(status_resp.status_code, 200)
        self.assertEqual(status_resp.json()["remaining"], 5)

        # Simulate 5 enhancements
        for _ in range(5):
            increment_guest_enhancement_count(test_guest_id)

        self.assertEqual(get_guest_enhancement_count(test_guest_id), 5)

        # 6th upload attempt must be rejected with HTTP 403
        upload_resp = self.client.post(
            "/api/v1/enhance/upload",
            params={"detect_marine": False},
            files={"file": ("quota_test.png", io.BytesIO(self.image_bytes), "image/png")},
            headers={"X-Guest-ID": test_guest_id}
        )
        self.assertEqual(upload_resp.status_code, 403)
        self.assertIn("quota reached", upload_resp.json()["detail"])

    def test_enhancement_catalogs_to_db_for_training(self):
        """Tests that every image enhancement is cataloged in the DB for training (Requirement 10)."""
        unique_guest = f"guest_db_{uuid.uuid4().hex[:8]}"
        set_guest_enhancement_count(unique_guest, 0)

        upload_resp = self.client.post(
            "/api/v1/enhance/upload",
            params={"detect_marine": False},
            files={"file": ("catalog_test.png", io.BytesIO(self.image_bytes), "image/png")},
            headers={"X-Guest-ID": unique_guest}
        )
        self.assertEqual(upload_resp.status_code, 200)
        file_id = upload_resp.json()["id"]

        # Query database to confirm record was stored
        record = self.db.query(EnhancementRecord).filter(EnhancementRecord.id == file_id).first()
        self.assertIsNotNone(record, "Enhancement record must be cataloged in DB")
        self.assertTrue(record.is_flagged_for_training)
        self.assertEqual(record.guest_session_id, unique_guest)
        self.assertIsNotNone(record.enhanced_image_path)


if __name__ == "__main__":
    unittest.main()
