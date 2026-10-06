"""LangGraph chat orchestration: classify -> (diagnose | plan) -> tutor.

Nodes are thin functions over the existing specialist agents. The LLM gateway stays
``LLMService``; no LangChain chat models are used here.
"""

from __future__ import annotations

import logging
from typing import Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.base import AgentContext, BaseAgent
from app.config import settings

logger = logging.getLogger(__name__)

ANSWER_CHECK_KEYWORDS: tuple[str, ...] = (
    "错了",
    "做错",
    "哪里错",
    "对不对",
    "对吗",
    "对么",
    "是否正确",
    "帮我看看",
    "我的答案",
    "我算出",
    "我算的",
    "我选",
    "我觉得答案",
    "我得到",
)
PLAN_KEYWORDS: tuple[str, ...] = (
    "今天练什么",
    "今天学什么",
    "该复习什么",
    "下一步学什么",
    "学习计划",
    "复习计划",
    "练什么",
    "帮我安排",
    "怎么安排",
)

Intent = Literal["has_answer", "asks_plan", "default"]


class ChatGraphState(TypedDict, total=False):
    ctx: AgentContext
    payload: dict[str, Any]
    intent: str
    agent_path: list[str]
    diagnosis: dict[str, Any] | None
    today_plan: dict[str, Any] | None
    node_errors: list[str]
    result: dict[str, Any]


def last_user_message(messages: list[dict[str, Any]]) -> str:
    for message in reversed(messages):
        if isinstance(message, dict) and message.get("role") == "user":
            return str(message.get("content") or "")
    return ""


def classify_intent(text: str | None, *, prompt_profile: str, tutor_context: dict[str, Any]) -> Intent:
    normalized = (text or "").strip().lower()
    diagnosis_enabled = bool(settings.CHAT_DIAGNOSIS_ENABLED)
    if diagnosis_enabled and (prompt_profile == "diagnose" or tutor_context.get("mode") == "diagnose"):
        return "has_answer"
    if diagnosis_enabled and any(keyword in normalized for keyword in ANSWER_CHECK_KEYWORDS):
        return "has_answer"
    if any(keyword in normalized for keyword in PLAN_KEYWORDS):
        return "asks_plan"
    return "default"


def summarize_today_plan(plan: dict[str, Any]) -> str:
    items = list(plan.get("items") or [])
    if not items:
        return "暂无可练习的知识点"
    parts = []
    for index, item in enumerate(items, 1):
        mastery = float(item.get("effective_mastery") or 0.0)
        parts.append(f"{index}. {item.get('skill_name')}（{item.get('reason')}，掌握度 {mastery:.2f}）")
    return "；".join(parts)


def build_chat_graph(
    *,
    tutor: BaseAgent,
    diagnostician: BaseAgent | None,
    planner: BaseAgent | None,
) -> Any:
    def classify_node(state: ChatGraphState) -> dict[str, Any]:
        payload = state["payload"]
        intent = classify_intent(
            last_user_message(list(payload.get("messages") or [])),
            prompt_profile=str(payload.get("prompt_profile") or ""),
            tutor_context=dict(payload.get("tutor_context") or {}),
        )
        return {
            "intent": intent,
            "agent_path": [*state.get("agent_path", []), "classify"],
            "node_errors": list(state.get("node_errors", [])),
        }

    def diagnose_node(state: ChatGraphState) -> dict[str, Any]:
        path = [*state.get("agent_path", [])]
        errors = [*state.get("node_errors", [])]
        if diagnostician is None:
            return {"agent_path": [*path, "diagnostician:skipped"]}
        payload = dict(state["payload"])
        tutor_context = dict(payload.get("tutor_context") or {})
        try:
            material_context = tutor_context.get("material_context") or {}
            chunks = list(material_context.get("chunks") or []) if isinstance(material_context, dict) else []
            result = diagnostician.run(
                state["ctx"],
                {
                    "question_content": "",
                    "student_answer": last_user_message(list(payload.get("messages") or [])),
                    "correct_answer": None,
                    "standard_solution": None,
                    "material_chunks": chunks,
                    "resolved": payload.get("resolved"),
                    "analytics": payload.get("analytics"),
                    "model": payload.get("model"),
                    "write_mastery": True,
                },
            )
        except Exception as exc:  # noqa: BLE001 - node failures must never break chat
            logger.exception("diagnose node failed")
            errors.append(f"diagnostician: {exc}")
            return {"agent_path": [*path, "diagnostician:error"], "node_errors": errors}

        updates = result.state_updates
        if "error" in updates:
            errors.append(f"diagnostician: {updates['error']}")
            return {"agent_path": [*path, "diagnostician:error"], "node_errors": errors}

        tutor_context["error_type"] = updates.get("error_type")
        tutor_context["diagnosis"] = updates.get("diagnosis")
        tutor_context["diagnosed_skills"] = [skill["skill_name"] for skill in updates.get("skills") or []]
        payload["tutor_context"] = tutor_context
        diagnosis = {
            "error_type": updates.get("error_type"),
            "is_correct": updates.get("is_correct"),
            "skills_updated": list(updates.get("skills_updated") or []),
            "question_id": updates.get("question_id"),
        }
        return {
            "payload": payload,
            "diagnosis": diagnosis,
            "agent_path": [*path, "diagnostician"],
            "node_errors": errors,
        }

    def plan_node(state: ChatGraphState) -> dict[str, Any]:
        path = [*state.get("agent_path", [])]
        errors = [*state.get("node_errors", [])]
        if planner is None:
            return {"agent_path": [*path, "planner:skipped"]}
        payload = dict(state["payload"])
        tutor_context = dict(payload.get("tutor_context") or {})
        try:
            result = planner.run(state["ctx"], {"limit": 3})
        except Exception as exc:  # noqa: BLE001 - node failures must never break chat
            logger.exception("plan node failed")
            errors.append(f"planner: {exc}")
            return {"agent_path": [*path, "planner:error"], "node_errors": errors}

        today_plan = result.state_updates.get("today_plan")
        if not isinstance(today_plan, dict):
            return {"agent_path": [*path, "planner:skipped"], "node_errors": errors}
        tutor_context["today_plan_summary"] = summarize_today_plan(today_plan)
        payload["tutor_context"] = tutor_context
        return {
            "payload": payload,
            "today_plan": today_plan,
            "agent_path": [*path, "planner"],
            "node_errors": errors,
        }

    def tutor_node(state: ChatGraphState) -> dict[str, Any]:
        path = [*state.get("agent_path", []), "tutor"]
        agent_result = tutor.run(state["ctx"], state["payload"])
        result = dict(agent_result.raw)
        if "error" not in result:
            result.setdefault("agent_type", agent_result.agent_type)
            result.setdefault("used_tools", agent_result.used_tools)
            result["agent_path"] = path
            result["diagnosis"] = state.get("diagnosis")
            result["today_plan"] = state.get("today_plan")
            result["node_errors"] = list(state.get("node_errors", []))
        return {"result": result, "agent_path": path}

    def route(state: ChatGraphState) -> Literal["diagnose", "plan", "tutor"]:
        intent = state.get("intent")
        if intent == "has_answer":
            return "diagnose"
        if intent == "asks_plan":
            return "plan"
        return "tutor"

    graph = StateGraph(ChatGraphState)
    graph.add_node("classify", classify_node)
    graph.add_node("diagnose", diagnose_node)
    graph.add_node("plan", plan_node)
    graph.add_node("tutor", tutor_node)
    graph.add_edge(START, "classify")
    graph.add_conditional_edges("classify", route, {"diagnose": "diagnose", "plan": "plan", "tutor": "tutor"})
    graph.add_edge("diagnose", "tutor")
    graph.add_edge("plan", "tutor")
    graph.add_edge("tutor", END)
    return graph.compile()


def run_chat_graph(graph: Any, *, ctx: AgentContext, payload: dict[str, Any]) -> dict[str, Any]:
    final_state = graph.invoke({"ctx": ctx, "payload": payload, "agent_path": [], "node_errors": []})
    return dict(final_state.get("result") or {})
