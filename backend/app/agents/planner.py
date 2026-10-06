"""Planner specialist: builds today's practice plan from the learner model."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.agents.base import AgentContext, AgentResult, BaseAgent
from app.config import settings
from app.models.question import Skill, SkillEdge
from app.services.knowledge_tracing import KnowledgeTracingService
from app.services.student_model import StudentModelService

MASTERED_THRESHOLD = 0.7
ZPD_UPPER = 0.7
SUGGESTED_MINUTES = {"due_review": 15, "zpd": 20, "unlocked": 15}
GROUP_ORDER = {"due_review": 0, "zpd": 1, "unlocked": 2}


class PlannerAgent(BaseAgent):
    name = "planner"
    allowed_tools = ["learner_store"]

    def __init__(self, db: Session | None = None) -> None:
        self.db = db
        self.knowledge_tracing = KnowledgeTracingService()

    def run(self, ctx: AgentContext, payload: dict[str, Any]) -> AgentResult:
        if self.db is None or not ctx.student_id:
            mastery_info = dict(payload.get("mastery_info") or {})
            target_skills = list(mastery_info.get("recommended_skills") or [])
            return AgentResult(
                state_updates={"target_skills": target_skills, "today_plan": None},
                used_tools=[],
                agent_type="planner",
            )

        plan = self.build_today_plan(
            student_id=ctx.student_id,
            user_id=ctx.user_id,
            limit=int(payload.get("limit") or 3),
            target_skills=payload.get("target_skills"),
        )
        target_skills = [item["skill_id"] for item in plan["items"] if item["action"]["type"] == "training"]
        return AgentResult(
            state_updates={"today_plan": plan, "target_skills": target_skills},
            used_tools=["learner_store"],
            agent_type="planner",
        )

    def _effective(self, mastery: Any) -> float:
        if mastery.bkt_p_known is None:
            return float(mastery.mastery_score or 0.0)
        return self.knowledge_tracing.apply_decay(
            float(mastery.bkt_p_known),
            last_practiced_at=mastery.last_practiced_at,
            half_life_days=mastery.bkt_half_life,
        )

    @staticmethod
    def _days_since(last_practiced_at: str | None, now: datetime) -> int | None:
        if not last_practiced_at:
            return None
        try:
            return (now - datetime.fromisoformat(last_practiced_at)).days
        except ValueError:
            return None

    @staticmethod
    def _item(
        *,
        skill_id: str,
        skill_name: str,
        reason: str,
        effective: float,
        days_since_practice: int | None,
        blocked_by: str | None,
        sort_key: tuple[int, float],
    ) -> dict[str, Any]:
        ready = blocked_by is None
        action: dict[str, Any]
        if reason == "unlocked":
            action = {"type": "feynman", "skill_id": skill_id}
        else:
            action = {"type": "training", "target_skills": [skill_id]}
        return {
            "skill_id": skill_id,
            "skill_name": skill_name,
            "reason": reason if ready else f"{reason}_blocked_by:{blocked_by}",
            "effective_mastery": round(effective, 4),
            "days_since_practice": days_since_practice,
            "prerequisites_ready": ready,
            "suggested_minutes": SUGGESTED_MINUTES[reason],
            "action": action,
            "_sort": sort_key,
        }

    def build_today_plan(
        self,
        *,
        student_id: int,
        user_id: str,
        limit: int = 3,
        target_skills: list[str] | None = None,
    ) -> dict[str, Any]:
        assert self.db is not None
        db = self.db
        now = datetime.now()
        threshold = float(settings.REVIEW_MASTERY_THRESHOLD)

        masteries = StudentModelService(db).get_all_masteries(student_id)
        effective = {str(m.skill_id): self._effective(m) for m in masteries}

        edges = db.query(SkillEdge).filter(SkillEdge.relation == "prerequisite").all()
        prerequisites: dict[str, list[str]] = {}
        for edge in edges:
            prerequisites.setdefault(str(edge.to_skill_id), []).append(str(edge.from_skill_id))

        visible_skills = (
            db.query(Skill)
            .filter((Skill.owner_user_id == user_id) | (Skill.owner_user_id.is_(None)))
            .order_by(Skill.skill_id)
            .all()
        )

        def blocked_by(skill_id: str) -> str | None:
            for prerequisite in prerequisites.get(skill_id, []):
                if effective.get(prerequisite, 0.0) < MASTERED_THRESHOLD:
                    return prerequisite
            return None

        candidates: list[dict[str, Any]] = []
        for mastery in masteries:
            skill_id = str(mastery.skill_id)
            last_practiced_at = str(mastery.last_practiced_at) if mastery.last_practiced_at else None
            score = effective[skill_id]
            days = self._days_since(last_practiced_at, now)
            if last_practiced_at and score < threshold:
                prior = float(mastery.bkt_p_known if mastery.bkt_p_known is not None else mastery.mastery_score or 0.0)
                reason = "due_review"
                sort_key: tuple[int, float] = (GROUP_ORDER[reason], -(prior - score))
            elif threshold <= score < ZPD_UPPER:
                reason = "zpd"
                sort_key = (GROUP_ORDER[reason], score)
            else:
                continue
            candidates.append(
                self._item(
                    skill_id=skill_id,
                    skill_name=str(mastery.skill_name),
                    reason=reason,
                    effective=score,
                    days_since_practice=days,
                    blocked_by=blocked_by(skill_id),
                    sort_key=sort_key,
                )
            )

        for skill in visible_skills:
            skill_id = str(skill.skill_id)
            if skill_id in effective:
                continue
            if not prerequisites.get(skill_id) or blocked_by(skill_id) is not None:
                continue
            candidates.append(
                self._item(
                    skill_id=skill_id,
                    skill_name=str(skill.name),
                    reason="unlocked",
                    effective=0.0,
                    days_since_practice=None,
                    blocked_by=None,
                    sort_key=(GROUP_ORDER["unlocked"], 0.0),
                )
            )
            break

        if target_skills:
            wanted = set(target_skills)
            candidates = [item for item in candidates if item["skill_id"] in wanted]

        candidates.sort(key=lambda item: (0 if item["prerequisites_ready"] else 1, item["_sort"]))
        items = [{key: value for key, value in item.items() if key != "_sort"} for item in candidates[:limit]]

        empty_reason: str | None = None
        if not items:
            empty_reason = "no_skills" if not masteries and not visible_skills else "all_mastered"

        return {"generated_at": now.isoformat(), "items": items, "empty_reason": empty_reason}
