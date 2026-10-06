import unittest
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.student import router as student_router
from app.database import Base, get_db
from app.models.student import StudentMastery
from app.models.user import User


def fake_user() -> User:
    return User(id=1, username="alice", email=None, is_active=True, created_at="now", updated_at="now")


class StudentApiTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        self.db = self.SessionLocal()
        now = datetime.now()
        self.db.add(User(username="alice", password_hash="x", is_active=True, created_at="now", updated_at="now"))
        self.db.add(User(username="bob", password_hash="x", is_active=True, created_at="now", updated_at="now"))
        self.db.commit()
        self.db.add(
            StudentMastery(
                student_id=1,
                skill_id="decayed",
                skill_name="Decayed",
                mastery_score=0.9,
                bkt_p_known=0.9,
                bkt_half_life=3.0,
                last_practiced_at=(now - timedelta(days=30)).isoformat(),
                created_at=(now - timedelta(days=30)).isoformat(),
                updated_at=(now - timedelta(days=30)).isoformat(),
            )
        )
        self.db.commit()

        app = FastAPI()
        app.dependency_overrides[get_current_user] = fake_user

        def override_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_db
        app.include_router(student_router)
        self.client = TestClient(app)

    def tearDown(self):
        self.db.close()

    def test_today_plan_returns_due_review(self):
        response = self.client.get("/api/student/alice/today-plan")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["user_id"], "alice")
        self.assertEqual(payload["items"][0]["skill_id"], "decayed")
        self.assertEqual(payload["items"][0]["reason"], "due_review")
        self.assertIsNone(payload["empty_reason"])

    def test_today_plan_forbidden_for_other_user(self):
        response = self.client.get("/api/student/bob/today-plan")

        self.assertEqual(response.status_code, 403)

    def test_today_plan_empty_state(self):
        self.db.query(StudentMastery).delete()
        self.db.commit()

        response = self.client.get("/api/student/alice/today-plan")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["items"], [])
        self.assertEqual(payload["empty_reason"], "no_skills")


if __name__ == "__main__":
    unittest.main()
