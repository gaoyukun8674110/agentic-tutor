import unittest
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.agents.base import AgentContext
from app.agents.planner import PlannerAgent
from app.database import Base
from app.models.question import Skill, SkillEdge
from app.models.student import Student, StudentMastery


class PlannerAgentTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        self.db = self.SessionLocal()
        now = datetime.now()

        def iso(days_ago: int) -> str:
            return (now - timedelta(days=days_ago)).isoformat()

        def mastery(
            student_id: int,
            skill_id: str,
            p: float,
            half_life: float,
            days_ago: int,
        ) -> StudentMastery:
            return StudentMastery(
                student_id=student_id,
                skill_id=skill_id,
                skill_name=skill_id.replace("_", " ").title(),
                mastery_score=p,
                bkt_p_known=p,
                bkt_half_life=half_life,
                last_practiced_at=iso(days_ago),
                created_at=iso(days_ago),
                updated_at=iso(days_ago),
            )

        self.alice = Student(user_id="alice", username="Alice", created_at=iso(0), updated_at=iso(0))
        self.bob = Student(user_id="bob", username="Bob", created_at=iso(0), updated_at=iso(0))
        self.carol = Student(user_id="carol", username="Carol", created_at=iso(0), updated_at=iso(0))
        self.db.add_all([self.alice, self.bob, self.carol])
        self.db.flush()
        self.db.add_all(
            [
                mastery(self.alice.id, "decayed", 0.9, 3.0, 30),
                mastery(self.alice.id, "low", 0.2, 3.0, 0),
                mastery(self.alice.id, "mid", 0.6, 30.0, 0),
                mastery(self.alice.id, "fresh_high", 0.9, 30.0, 0),
                mastery(self.carol.id, "fresh_high", 0.9, 30.0, 0),
            ]
        )
        for skill_id in ["decayed", "low", "mid", "fresh_high", "advanced", "blocked_topic"]:
            self.db.add(
                Skill(
                    skill_id=skill_id,
                    name=skill_id.title(),
                    owner_user_id="alice",
                    created_at=iso(0),
                )
            )
        self.db.add_all(
            [
                SkillEdge(from_skill_id="fresh_high", to_skill_id="advanced", relation="prerequisite"),
                SkillEdge(from_skill_id="low", to_skill_id="blocked_topic", relation="prerequisite"),
                SkillEdge(from_skill_id="low", to_skill_id="mid", relation="prerequisite"),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def run_alice(self, limit: int, target: list[str] | None = None):
        return PlannerAgent(self.db).run(
            AgentContext(user_id="alice", student_id=self.alice.id),
            {"limit": limit, "target_skills": target},
        )

    def test_limit_three_orders_due_review_then_unlocked(self):
        result = self.run_alice(3)
        items = result.state_updates["today_plan"]["items"]

        self.assertEqual([item["skill_id"] for item in items], ["decayed", "low", "advanced"])
        self.assertEqual(items[0]["reason"], "due_review")
        self.assertLess(items[0]["effective_mastery"], 0.01)
        self.assertEqual(items[0]["days_since_practice"], 30)
        self.assertEqual(items[0]["action"], {"type": "training", "target_skills": ["decayed"]})
        self.assertEqual(items[1]["reason"], "due_review")
        self.assertAlmostEqual(items[1]["effective_mastery"], 0.2, places=2)
        self.assertEqual(items[2]["reason"], "unlocked")
        self.assertEqual(items[2]["action"], {"type": "feynman", "skill_id": "advanced"})
        self.assertIs(items[2]["prerequisites_ready"], True)

    def test_limit_four_includes_blocked_zpd_item(self):
        result = self.run_alice(4)
        items = result.state_updates["today_plan"]["items"]

        self.assertEqual(items[3]["skill_id"], "mid")
        self.assertEqual(items[3]["reason"], "zpd_blocked_by:low")
        self.assertIs(items[3]["prerequisites_ready"], False)
        self.assertAlmostEqual(items[3]["effective_mastery"], 0.6, places=2)

    def test_mastered_and_blocked_unseen_skills_are_excluded(self):
        result = self.run_alice(10)
        skill_ids = [item["skill_id"] for item in result.state_updates["today_plan"]["items"]]

        self.assertNotIn("fresh_high", skill_ids)
        self.assertNotIn("blocked_topic", skill_ids)

    def test_target_skills_filter(self):
        result = self.run_alice(3, ["low"])
        items = result.state_updates["today_plan"]["items"]

        self.assertEqual([item["skill_id"] for item in items], ["low"])

    def test_state_target_skills_only_include_training_items(self):
        result = self.run_alice(3)

        self.assertEqual(result.state_updates["target_skills"], ["decayed", "low"])

    def test_empty_states(self):
        bob_result = PlannerAgent(self.db).run(
            AgentContext(user_id="bob", student_id=self.bob.id),
            {"limit": 3},
        )
        carol_result = PlannerAgent(self.db).run(
            AgentContext(user_id="carol", student_id=self.carol.id),
            {"limit": 3},
        )

        self.assertEqual(bob_result.state_updates["today_plan"]["items"], [])
        self.assertEqual(bob_result.state_updates["today_plan"]["empty_reason"], "no_skills")
        self.assertEqual(carol_result.state_updates["today_plan"]["items"], [])
        self.assertEqual(carol_result.state_updates["today_plan"]["empty_reason"], "all_mastered")

    def test_no_db_keeps_legacy_behavior(self):
        result = PlannerAgent().run(
            AgentContext(user_id="", student_id=1),
            {"mastery_info": {"recommended_skills": ["a"]}},
        )

        self.assertEqual(result.state_updates, {"target_skills": ["a"], "today_plan": None})


if __name__ == "__main__":
    unittest.main()
