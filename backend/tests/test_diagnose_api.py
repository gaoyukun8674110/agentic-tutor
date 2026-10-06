import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.api.llm import get_llm_service
from app.api.llm import router as llm_router
from app.database import Base, get_db
from app.models.question import Question
from app.models.student import Student, StudentMastery
from app.models.user import User
from app.services.llm_credential_resolver import ResolvedProvider


class FakeLLM:
    def __init__(self, reply: str):
        self.reply = reply
        self.calls: list[dict] = []
        self.agent_prompts = {"diagnosis": "sys-diagnosis"}
        self.math_tools = SimpleNamespace(verify_answer=lambda student, correct: {"result": student == correct})

    def complete_chat(self, **kwargs):
        self.calls.append(kwargs)
        if self.reply == "__ERROR__":
            return {"error": "boom"}
        return {"message": {"role": "assistant", "content": self.reply}}


JSON_REPLY = (
    "你把判别式算成了负数，这是概念理解错误。\n"
    "```json\n"
    '{"is_correct": false, "error_type": "concept_error", "reference_answer": "x=3", '
    '"skills": [{"skill_id": "Quadratic Equation", "skill_name": "一元二次方程"}], '
    '"diagnosis": "判别式概念错误"}\n'
    "```"
)
RESOLVED = ResolvedProvider(
    provider_id="fake",
    api_key="k",
    base_url="http://127.0.0.1/fake",
    default_model="m",
    source="local",
)


def fake_user() -> User:
    return User(id=1, username="alice", email=None, is_active=True, created_at="now", updated_at="now")


class DiagnoseApiTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        self.db = self.SessionLocal()
        self.db.add(User(id=1, username="alice", password_hash="x", is_active=True, created_at="now", updated_at="now"))
        self.db.commit()
        self.fake_llm = FakeLLM(JSON_REPLY)

        app = FastAPI()
        app.dependency_overrides[get_current_user] = fake_user
        app.dependency_overrides[get_llm_service] = lambda: self.fake_llm

        def override_db():
            try:
                yield self.db
            finally:
                pass

        app.dependency_overrides[get_db] = override_db
        app.include_router(llm_router)
        self.client = TestClient(app)

    def tearDown(self):
        self.db.close()

    def _post_diagnose(self):
        with patch("app.api.llm._resolve_provider_or_raise", return_value=RESOLVED):
            return self.client.post(
                "/api/llm/diagnose",
                json={
                    "question_content": "x²-5x+6=0 的较大根",
                    "student_answer": "x=2",
                    "correct_answer": "x=3",
                    "standard_solution": "因式分解 (x-2)(x-3)=0",
                },
            )

    def test_diagnose_writes_back_mastery(self):
        response = self._post_diagnose()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["error_type"], "concept_error")
        self.assertIs(payload["is_correct"], False)
        self.assertEqual(payload["agent_type"], "diagnostician")
        self.assertIsInstance(payload["question_id"], int)
        self.assertEqual(payload["skills_updated"][0]["skill_id"], "quadratic_equation")
        self.assertEqual(payload["math_verification"], {"result": False})
        self.assertNotIn("```", payload["diagnosis"])
        self.assertEqual(self.db.query(StudentMastery).count(), 1)
        question = self.db.query(Question).one()
        self.assertEqual(question.owner_user_id, "alice")

    def test_llm_failure_returns_502_without_writes(self):
        self.fake_llm = FakeLLM("__ERROR__")

        response = self._post_diagnose()

        self.assertEqual(response.status_code, 502)
        self.assertEqual(self.db.query(StudentMastery).count(), 0)
        self.assertEqual(self.db.query(Question).count(), 0)

    def test_success_creates_student_automatically(self):
        self.assertEqual(self.db.query(Student).count(), 0)

        response = self._post_diagnose()

        self.assertEqual(response.status_code, 200)
        student = self.db.query(Student).one()
        self.assertEqual(student.user_id, "alice")


if __name__ == "__main__":
    unittest.main()
