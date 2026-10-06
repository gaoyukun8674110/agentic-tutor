import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.agents.diagnostician as diagnostician_module
from app.agents.base import AgentContext
from app.agents.diagnostician import DiagnosticianAgent
from app.database import Base
from app.models.question import Question, QuestionSkill, Skill
from app.models.student import Student, StudentAnswer, StudentMastery


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


RESOLVED = SimpleNamespace(provider_id="fake")
JSON_REPLY = (
    "你把判别式算成了负数，这是概念理解错误。\n"
    "```json\n"
    '{"is_correct": false, "error_type": "concept_error", "reference_answer": "x=3", '
    '"skills": [{"skill_id": "Quadratic Equation", "skill_name": "一元二次方程"}], '
    '"diagnosis": "判别式概念错误"}\n'
    "```"
)


class DiagnosticianTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def _create_student(self, db):
        student = Student(
            user_id="alice",
            username="Alice",
            created_at="2026-10-06T09:00:00",
            updated_at="2026-10-06T09:00:00",
        )
        db.add(student)
        db.commit()
        db.refresh(student)
        return student

    def _run_agent(self, db, llm, student, payload=None):
        default_payload = {
            "question_content": "",
            "student_answer": "x²-5x+6=0 较大根我算出 x=2 对吗",
            "resolved": RESOLVED,
        }
        default_payload.update(payload or {})
        return DiagnosticianAgent(llm, db=db).run(
            AgentContext(user_id="alice", student_id=student.id),
            default_payload,
        )

    def test_json_reply_persists_full_diagnosis(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            llm = FakeLLM(JSON_REPLY)

            result = self._run_agent(db, llm, student)

            self.assertEqual(result.agent_type, "diagnostician")
            self.assertEqual(result.state_updates["error_type"], "concept_error")
            self.assertIs(result.state_updates["is_correct"], False)
            self.assertEqual(
                result.state_updates["skills"],
                [{"skill_id": "quadratic_equation", "skill_name": "一元二次方程"}],
            )
            self.assertNotIn("```", result.content or "")
            skill = db.query(Skill).filter(Skill.skill_id == "quadratic_equation").one()
            self.assertEqual(skill.owner_user_id, "alice")
            question = db.query(Question).one()
            self.assertEqual(question.source, "chat")
            self.assertEqual(question.owner_user_id, "alice")
            self.assertEqual(question.correct_answer, "x=3")
            self.assertEqual(db.query(QuestionSkill).count(), 1)
            answer = db.query(StudentAnswer).one()
            self.assertIs(answer.is_correct, False)
            self.assertEqual(answer.error_reason, "concept_error")
            self.assertIsNone(answer.session_id)
            mastery = db.query(StudentMastery).one()
            self.assertEqual(mastery.total_attempts, 1)
            self.assertAlmostEqual(mastery.bkt_p_known, 0.1552, places=3)
            self.assertIsNone(result.state_updates["skills_updated"][0]["mastery_before"])
            self.assertEqual(llm.calls[0]["prompt_profile"], "custom")
            self.assertEqual(llm.calls[0]["system_prompt_override"], "sys-diagnosis")
            self.assertIs(llm.calls[0]["resolved"], RESOLVED)
        finally:
            db.close()

    def test_non_json_reply_uses_fallback_and_still_persists_trace(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            llm = FakeLLM("这是一个计算错误，第二步运算有误。")

            result = self._run_agent(db, llm, student)

            self.assertEqual(result.state_updates["error_type"], "calculation_error")
            self.assertEqual(result.state_updates["skills"], [])
            self.assertEqual(result.state_updates["skills_updated"], [])
            self.assertEqual(db.query(StudentMastery).count(), 0)
            self.assertEqual(db.query(Question).count(), 1)
            self.assertEqual(db.query(StudentAnswer).count(), 1)
        finally:
            db.close()

    def test_write_mastery_false_does_not_persist(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            llm = FakeLLM(JSON_REPLY)

            result = self._run_agent(db, llm, student, {"write_mastery": False})

            self.assertEqual(result.state_updates["error_type"], "concept_error")
            self.assertEqual(db.query(Skill).count(), 0)
            self.assertEqual(db.query(Question).count(), 0)
            self.assertEqual(db.query(StudentAnswer).count(), 0)
            self.assertEqual(db.query(StudentMastery).count(), 0)
        finally:
            db.close()

    def test_llm_error_does_not_persist(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            llm = FakeLLM("__ERROR__")

            result = self._run_agent(db, llm, student)

            self.assertIn("error", result.state_updates)
            self.assertIsNone(result.content)
            self.assertEqual(db.query(Skill).count(), 0)
            self.assertEqual(db.query(Question).count(), 0)
            self.assertEqual(db.query(StudentAnswer).count(), 0)
            self.assertEqual(db.query(StudentMastery).count(), 0)
        finally:
            db.close()

    def test_correct_answer_runs_math_verification(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            llm = FakeLLM(JSON_REPLY)

            result = self._run_agent(db, llm, student, {"correct_answer": "x=3"})

            self.assertIn("math", result.used_tools)
            self.assertIn("数学工具验证结果", llm.calls[0]["messages"][0]["content"])
        finally:
            db.close()

    def test_e2e_mock_does_not_call_llm(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            llm = FakeLLM(JSON_REPLY)

            with patch.object(diagnostician_module.settings, "E2E_MOCK_LLM", True):
                self._run_agent(db, llm, student)

            self.assertEqual(llm.calls, [])
            self.assertIsNotNone(db.query(Skill).filter(Skill.skill_id == "mock_skill").one_or_none())
            self.assertEqual(db.query(StudentMastery).count(), 1)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
