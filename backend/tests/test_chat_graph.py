import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app.agents.graph as graph_module
from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.agents.graph import build_chat_graph, classify_intent, run_chat_graph


class FakeTutor(BaseAgent):
    name = "tutor"

    def __init__(self):
        self.last_payload = None

    def run(self, ctx, payload):
        self.last_payload = payload
        return AgentResult(
            content="ok",
            agent_type="tutor",
            used_tools=["learner_store"],
            raw={"message": {"role": "assistant", "content": "ok"}},
        )


class FakeDiagnostician(BaseAgent):
    name = "diagnostician"

    def __init__(self, *, raise_error=False, return_error=False):
        self.raise_error = raise_error
        self.return_error = return_error
        self.calls = []

    def run(self, ctx, payload):
        self.calls.append(payload)
        if self.raise_error:
            raise RuntimeError("boom")
        if self.return_error:
            return AgentResult(agent_type="diagnostician", state_updates={"error": "llm_down"})
        return AgentResult(
            content="诊断",
            agent_type="diagnostician",
            state_updates={
                "error_type": "concept_error",
                "is_correct": False,
                "diagnosis": "概念错误",
                "skills": [{"skill_id": "algebra", "skill_name": "Algebra"}],
                "skills_updated": [
                    {
                        "skill_id": "algebra",
                        "skill_name": "Algebra",
                        "mastery_score": 0.1552,
                        "mastery_before": None,
                    }
                ],
                "question_id": 9,
            },
        )


class FakePlanner(BaseAgent):
    name = "planner"

    def run(self, ctx, payload):
        return AgentResult(
            agent_type="planner",
            state_updates={
                "today_plan": {
                    "items": [
                        {
                            "skill_id": "algebra",
                            "skill_name": "Algebra",
                            "reason": "due_review",
                            "effective_mastery": 0.41,
                        }
                    ],
                    "empty_reason": None,
                }
            },
        )


CTX = AgentContext(user_id="alice", student_id=7)


def payload(text):
    return {
        "messages": [{"role": "user", "content": text}],
        "prompt_profile": "three_stage",
        "tutor_context": {},
        "resolved": SimpleNamespace(provider_id="fake"),
    }


class ChatGraphTests(unittest.TestCase):
    def test_classify_intent(self):
        self.assertEqual(
            classify_intent("这题我算出 x=3 对吗", prompt_profile="three_stage", tutor_context={}),
            "has_answer",
        )
        self.assertEqual(classify_intent("什么是导数", prompt_profile="three_stage", tutor_context={}), "default")
        self.assertEqual(
            classify_intent("今天练什么", prompt_profile="three_stage", tutor_context={}),
            "asks_plan",
        )
        self.assertEqual(classify_intent("随便聊聊", prompt_profile="diagnose", tutor_context={}), "has_answer")
        self.assertEqual(
            classify_intent("随便聊聊", prompt_profile="three_stage", tutor_context={"mode": "diagnose"}),
            "has_answer",
        )
        self.assertEqual(classify_intent("", prompt_profile="three_stage", tutor_context={}), "default")

    def test_diagnosis_switch_off_disables_diagnosis_intent(self):
        with patch.object(graph_module.settings, "CHAT_DIAGNOSIS_ENABLED", False):
            self.assertEqual(classify_intent("x=3 对吗", prompt_profile="diagnose", tutor_context={}), "default")

    def test_answer_check_runs_diagnosis_path(self):
        tutor = FakeTutor()
        diagnostician = FakeDiagnostician()
        graph = build_chat_graph(tutor=tutor, diagnostician=diagnostician, planner=None)

        result = run_chat_graph(graph, ctx=CTX, payload=payload("x²-5x+6=0 我算出 x=2 对吗"))

        self.assertEqual(result["agent_path"], ["classify", "diagnostician", "tutor"])
        self.assertEqual(result["diagnosis"]["error_type"], "concept_error")
        self.assertEqual(result["diagnosis"]["question_id"], 9)
        self.assertEqual(tutor.last_payload["tutor_context"]["error_type"], "concept_error")
        self.assertEqual(tutor.last_payload["tutor_context"]["diagnosed_skills"], ["Algebra"])
        self.assertEqual(diagnostician.calls[0]["student_answer"], "x²-5x+6=0 我算出 x=2 对吗")
        self.assertIs(diagnostician.calls[0]["write_mastery"], True)
        self.assertEqual(result["node_errors"], [])

    def test_default_question_runs_only_tutor(self):
        tutor = FakeTutor()
        graph = build_chat_graph(tutor=tutor, diagnostician=FakeDiagnostician(), planner=None)

        result = run_chat_graph(graph, ctx=CTX, payload=payload("什么是导数"))

        self.assertEqual(result["agent_path"], ["classify", "tutor"])
        self.assertIsNone(result["diagnosis"])
        self.assertEqual(result["message"]["content"], "ok")

    def test_diagnosis_exception_degrades_to_tutor(self):
        tutor = FakeTutor()
        graph = build_chat_graph(tutor=tutor, diagnostician=FakeDiagnostician(raise_error=True), planner=None)

        result = run_chat_graph(graph, ctx=CTX, payload=payload("x=2 对吗"))

        self.assertEqual(result["agent_path"], ["classify", "diagnostician:error", "tutor"])
        self.assertNotIn("error", result)
        self.assertEqual(len(result["node_errors"]), 1)
        self.assertIn("boom", result["node_errors"][0])

    def test_diagnosis_error_result_degrades_to_tutor(self):
        tutor = FakeTutor()
        graph = build_chat_graph(tutor=tutor, diagnostician=FakeDiagnostician(return_error=True), planner=None)

        result = run_chat_graph(graph, ctx=CTX, payload=payload("x=2 对吗"))

        self.assertEqual(result["agent_path"], ["classify", "diagnostician:error", "tutor"])
        self.assertIn("llm_down", result["node_errors"][0])
        self.assertNotIn("error_type", tutor.last_payload["tutor_context"])

    def test_plan_path_skips_or_injects_summary(self):
        tutor = FakeTutor()
        graph = build_chat_graph(tutor=tutor, diagnostician=None, planner=None)
        result = run_chat_graph(graph, ctx=CTX, payload=payload("今天练什么"))
        self.assertEqual(result["agent_path"], ["classify", "planner:skipped", "tutor"])

        tutor = FakeTutor()
        graph = build_chat_graph(tutor=tutor, diagnostician=None, planner=FakePlanner())
        result = run_chat_graph(graph, ctx=CTX, payload=payload("今天练什么"))

        self.assertEqual(result["agent_path"], ["classify", "planner", "tutor"])
        self.assertEqual(result["today_plan"]["items"][0]["skill_id"], "algebra")
        self.assertEqual(
            tutor.last_payload["tutor_context"]["today_plan_summary"], "1. Algebra（due_review，掌握度 0.41）"
        )

    def test_graph_shape_is_locked(self):
        graph = build_chat_graph(tutor=FakeTutor(), diagnostician=None, planner=None)
        graph_repr = graph.get_graph()

        self.assertEqual(
            sorted(node for node in graph_repr.nodes if not node.startswith("__")),
            ["classify", "diagnose", "plan", "tutor"],
        )
        self.assertEqual(
            sorted((edge.source, edge.target) for edge in graph_repr.edges),
            [
                ("__start__", "classify"),
                ("classify", "diagnose"),
                ("classify", "plan"),
                ("classify", "tutor"),
                ("diagnose", "tutor"),
                ("plan", "tutor"),
                ("tutor", "__end__"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
