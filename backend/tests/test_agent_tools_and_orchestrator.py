import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.agents.orchestrator as orchestrator_module
from app.agents.orchestrator import Orchestrator
from app.agents.tools import MathTool, RetrieverTool, ToolRegistry, WebSearchTool
from app.agents.tools.web_search import fallback_web_chunk
from app.database import Base
from app.models.student import Student, StudentMastery


class FakeMaterialService:
    def search_materials(self, **kwargs):
        return [{"content": kwargs["query"], "source_label": "fake", "score": 0.9}]


class FakeLearnerStore:
    def snapshot(self, student_id):
        return {
            "student_id": student_id,
            "weak_skills": [{"skill_id": "algebra", "skill_name": "Algebra", "effective_mastery": 0.3}],
            "learning_style": {"pace": "slow"},
        }


class FakeWebProvider:
    def search(self, query, *, max_results, timeout):
        return [fallback_web_chunk()]


class FakeLLM:
    def __init__(self):
        self.math_tools = SimpleNamespace(verify_answer=lambda student, correct: {"result": student == correct})
        self.last_context = None

    def complete_chat(self, **kwargs):
        self.last_context = kwargs["tutor_context"]
        return {
            "message": {"role": "assistant", "content": "ok"},
            "provider": kwargs["resolved"].provider_id,
            "model": "fake",
            "prompt_profile": kwargs["prompt_profile"],
        }


class AgentToolsAndOrchestratorTests(unittest.TestCase):
    def test_registry_contains_and_invokes_tools(self):
        registry = ToolRegistry()
        registry.register("retriever", RetrieverTool(db=None, material_service=FakeMaterialService()))
        registry.register("math", MathTool(SimpleNamespace(verify_answer=lambda student, correct: {"ok": True})))
        registry.register("learner_store", FakeLearnerStore())
        registry.register("web_search", WebSearchTool(provider=FakeWebProvider()))

        self.assertTrue(registry.has("retriever"))
        self.assertTrue(registry.has("math"))
        self.assertTrue(registry.has("learner_store"))
        self.assertTrue(registry.has("web_search"))
        self.assertEqual(registry.get("retriever").search("hello", user_id="alice")[0]["content"], "hello")
        self.assertEqual(registry.get("math").verify("1", "1"), {"ok": True})

    def test_orchestrator_injects_learner_snapshot_into_tutor_context(self):
        llm = FakeLLM()
        registry = ToolRegistry({"learner_store": FakeLearnerStore()})
        orchestrator = Orchestrator(llm, tools=registry)
        resolved = SimpleNamespace(provider_id="fake")

        result = orchestrator.run_chat(
            resolved=resolved,
            model=None,
            messages=[{"role": "user", "content": "help"}],
            prompt_profile="auto",
            system_prompt_override=None,
            tutor_context={},
            agent_type="tutor_chat:auto:fake",
            user_id="alice",
            student_id=7,
            session_id=None,
            analytics=None,
        )

        self.assertEqual(result["learner_snapshot"]["student_id"], 7)
        self.assertIn("learner_store", result["used_tools"])
        self.assertEqual(llm.last_context["learner_snapshot"]["weak_skills"][0]["skill_id"], "algebra")

    def test_run_chat_langgraph_engine_adds_agent_path(self):
        llm = FakeLLM()
        registry = ToolRegistry({"learner_store": FakeLearnerStore()})
        orchestrator = Orchestrator(llm, tools=registry)
        resolved = SimpleNamespace(provider_id="fake")

        with patch.object(orchestrator_module.settings, "AGENT_GRAPH_ENGINE", "langgraph"):
            result = orchestrator.run_chat(
                resolved=resolved,
                model=None,
                messages=[{"role": "user", "content": "help"}],
                prompt_profile="auto",
                system_prompt_override=None,
                tutor_context={},
                agent_type="tutor_chat:auto:fake",
                user_id="alice",
                student_id=7,
                session_id=None,
                analytics=None,
            )

        self.assertEqual(result["agent_path"], ["classify", "tutor"])
        self.assertIsNone(result["diagnosis"])
        self.assertEqual(result["learner_snapshot"]["student_id"], 7)

    def test_run_chat_legacy_engine_has_no_agent_path(self):
        llm = FakeLLM()
        registry = ToolRegistry({"learner_store": FakeLearnerStore()})
        orchestrator = Orchestrator(llm, tools=registry)
        resolved = SimpleNamespace(provider_id="fake")

        with patch.object(orchestrator_module.settings, "AGENT_GRAPH_ENGINE", "legacy"):
            result = orchestrator.run_chat(
                resolved=resolved,
                model=None,
                messages=[{"role": "user", "content": "help"}],
                prompt_profile="auto",
                system_prompt_override=None,
                tutor_context={},
                agent_type="tutor_chat:auto:fake",
                user_id="alice",
                student_id=7,
                session_id=None,
                analytics=None,
            )

        self.assertNotIn("agent_path", result)
        self.assertEqual(result["learner_snapshot"]["student_id"], 7)

    def test_run_chat_plan_intent_injects_today_plan_summary(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        try:
            now = datetime.now()
            student = Student(
                user_id="alice",
                username="Alice",
                created_at=now.isoformat(),
                updated_at=now.isoformat(),
            )
            db.add(student)
            db.flush()
            db.add(
                StudentMastery(
                    student_id=student.id,
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
            db.commit()
            llm = FakeLLM()
            orchestrator = Orchestrator(llm, tools=ToolRegistry({"learner_store": FakeLearnerStore()}), db=db)
            resolved = SimpleNamespace(provider_id="fake")

            result = orchestrator.run_chat(
                resolved=resolved,
                model=None,
                messages=[{"role": "user", "content": "今天练什么"}],
                prompt_profile="auto",
                system_prompt_override=None,
                tutor_context={},
                agent_type="tutor_chat:auto:fake",
                user_id="alice",
                student_id=student.id,
                session_id=None,
                analytics=None,
            )

            self.assertEqual(result["agent_path"], ["classify", "planner", "tutor"])
            self.assertEqual(result["today_plan"]["items"][0]["skill_id"], "decayed")
            self.assertTrue(llm.last_context["today_plan_summary"].startswith("1. Decayed（due_review"))
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
