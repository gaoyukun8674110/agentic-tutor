import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.question import DifficultyLevel, Question, QuestionSkill, QuestionType
from app.models.student import Student, StudentMastery
from app.services.student_model import StudentModelService


class StudentModelSkillTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def _create_student(self, db):
        now = datetime(2026, 10, 6, 9, 0).isoformat()
        student = Student(user_id="alice", username="Alice", created_at=now, updated_at=now)
        db.add(student)
        db.commit()
        db.refresh(student)
        return student

    def test_updates_two_skills_for_correct_answer(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            result = StudentModelService(db).update_mastery_for_skills(
                student.id,
                [
                    {"skill_id": "algebra", "skill_name": "Algebra"},
                    {"skill_id": "geometry", "skill_name": "Geometry"},
                ],
                is_correct=True,
            )

            self.assertEqual(len(result["updated_skills"]), 2)
            self.assertEqual(db.query(StudentMastery).count(), 2)
            algebra = db.query(StudentMastery).filter(StudentMastery.skill_id == "algebra").one()
            self.assertEqual(algebra.total_attempts, 1)
            self.assertEqual(algebra.total_correct, 1)
            self.assertAlmostEqual(algebra.bkt_p_known, 0.648, places=3)
            self.assertIsNotNone(algebra.last_practiced_at)
        finally:
            db.close()

    def test_updates_skill_for_incorrect_answer(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            StudentModelService(db).update_mastery_for_skills(
                student.id,
                [{"skill_id": "algebra", "skill_name": "Algebra"}],
                is_correct=False,
            )

            algebra = db.query(StudentMastery).filter(StudentMastery.skill_id == "algebra").one()
            self.assertEqual(algebra.total_correct, 0)
            self.assertAlmostEqual(algebra.bkt_p_known, 0.1552, places=3)
        finally:
            db.close()

    def test_two_attempts_on_same_skill(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)
            service = StudentModelService(db)
            skills = [{"skill_id": "algebra", "skill_name": "Algebra"}]

            service.update_mastery_for_skills(student.id, skills, is_correct=True)
            service.update_mastery_for_skills(student.id, skills, is_correct=False)

            algebra = db.query(StudentMastery).filter(StudentMastery.skill_id == "algebra").one()
            self.assertEqual(algebra.total_attempts, 2)
            self.assertEqual(algebra.total_correct, 1)
            self.assertGreater(algebra.bkt_p_known, 0.0)
            self.assertLess(algebra.bkt_p_known, 1.0)
        finally:
            db.close()

    def test_empty_skills_do_not_write(self):
        db = self.SessionLocal()
        try:
            student = self._create_student(db)

            result = StudentModelService(db).update_mastery_for_skills(student.id, [], is_correct=True)

            self.assertEqual(result, {"updated_skills": []})
            self.assertEqual(db.query(StudentMastery).count(), 0)
        finally:
            db.close()

    def test_update_from_answer_delegates_to_skill_update(self):
        db = self.SessionLocal()
        try:
            now = datetime(2026, 10, 6, 9, 0).isoformat()
            student = self._create_student(db)
            question = Question(
                content="q",
                correct_answer="1",
                standard_solution="s",
                question_type=QuestionType.CHOICE,
                difficulty=DifficultyLevel.EASY,
                created_at=now,
                updated_at=now,
            )
            db.add(question)
            db.flush()
            db.add(QuestionSkill(question_id=question.id, skill_id="algebra", skill_name="Algebra", weight=1.0))
            db.commit()

            result = StudentModelService(db).update_mastery_from_answer(student.id, question.id, True, 12.0, 0)

            self.assertEqual(result["updated_skills"][0]["skill_id"], "algebra")
            algebra = db.query(StudentMastery).filter(StudentMastery.skill_id == "algebra").one()
            self.assertEqual(algebra.average_time, 12.0)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
