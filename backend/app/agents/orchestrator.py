"""Deterministic orchestrator for the Tutor agent graph."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import AgentContext
from app.agents.diagnostician import DiagnosticianAgent
from app.agents.graph import build_chat_graph, run_chat_graph
from app.agents.planner import PlannerAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.tools import ToolRegistry
from app.agents.tutor import TutorAgent
from app.config import settings


class Orchestrator:
    """Route work to specialist agents without changing the public API contract."""

    def __init__(self, llm: Any, tools: ToolRegistry | None = None, db: Session | None = None):
        self.llm = llm
        self.tools = tools or ToolRegistry()
        self.db = db
        self.tutor = TutorAgent(llm)
        self.diagnostician = DiagnosticianAgent(llm, db=db)
        self.planner = PlannerAgent(db)
        self.reviewer = ReviewerAgent(llm)
        self._graph: Any | None = None

    def _get_graph(self) -> Any:
        if self._graph is None:
            self._graph = build_chat_graph(
                tutor=self.tutor,
                diagnostician=self.diagnostician if self.db is not None else None,
                planner=self.planner if self.db is not None else None,
            )
        return self._graph

    def run_chat(
        self,
        *,
        resolved: Any,
        model: str | None,
        messages: list[dict[str, Any]],
        prompt_profile: str,
        system_prompt_override: str | None,
        tutor_context: dict[str, Any],
        agent_type: str | None,
        user_id: str,
        student_id: int | None,
        session_id: int | None,
        analytics: Any,
    ) -> dict[str, Any]:
        ctx = AgentContext(
            user_id=user_id,
            student_id=student_id,
            session_id=session_id,
            material_ids=(
                tutor_context.get("material_ids") if isinstance(tutor_context.get("material_ids"), list) else None
            ),
            learner_snapshot=dict(tutor_context.get("learner_snapshot") or {}),
            signals=dict(tutor_context.get("signals") or {}),
            tools=self.tools,
        )
        payload = {
            "resolved": resolved,
            "model": model,
            "messages": messages,
            "prompt_profile": prompt_profile,
            "system_prompt_override": system_prompt_override,
            "tutor_context": tutor_context,
            "agent_type": agent_type,
            "analytics": analytics,
        }

        if str(getattr(settings, "AGENT_GRAPH_ENGINE", "langgraph")).lower() == "langgraph":
            return run_chat_graph(self._get_graph(), ctx=ctx, payload=payload)

        agent_result = self.tutor.run(ctx, payload)
        result = dict(agent_result.raw)
        if "error" not in result:
            result.setdefault("agent_type", agent_result.agent_type)
            result.setdefault("used_tools", agent_result.used_tools)
        return result
