"""Add owner_user_id to skills and questions for the closed learning loop.

Revision ID: 20261006_01
Revises: 20260708_01
Create Date: 2026-10-06
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "20261006_01"
down_revision = "20260708_01"
branch_labels = None
depends_on = None


def _column_exists(connection, table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(connection)
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _table_exists(connection, table_name: str) -> bool:
    return table_name in sa.inspect(connection).get_table_names()


def _index_exists(connection, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(connection)
    if table_name not in inspector.get_table_names():
        return False
    return index_name in {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    connection = op.get_bind()
    # The base schema is created by the application's debug bootstrap on a
    # fresh database. There is nothing for this additive migration to alter
    # until those tables exist.
    if not _table_exists(connection, "skills") or not _table_exists(connection, "questions"):
        return
    if not _column_exists(connection, "skills", "owner_user_id"):
        op.add_column("skills", sa.Column("owner_user_id", sa.String(length=100), nullable=True))
    if not _index_exists(connection, "skills", "ix_skills_owner_user_id"):
        op.create_index("ix_skills_owner_user_id", "skills", ["owner_user_id"])
    if not _column_exists(connection, "skills", "created_at"):
        op.add_column("skills", sa.Column("created_at", sa.String(length=50), nullable=True))
    if not _column_exists(connection, "questions", "owner_user_id"):
        op.add_column("questions", sa.Column("owner_user_id", sa.String(length=100), nullable=True))
    if not _index_exists(connection, "questions", "ix_questions_owner_user_id"):
        op.create_index("ix_questions_owner_user_id", "questions", ["owner_user_id"])


def downgrade() -> None:
    connection = op.get_bind()
    if _index_exists(connection, "questions", "ix_questions_owner_user_id"):
        op.drop_index("ix_questions_owner_user_id", table_name="questions")
    if _column_exists(connection, "questions", "owner_user_id"):
        op.drop_column("questions", "owner_user_id")
    if _column_exists(connection, "skills", "created_at"):
        op.drop_column("skills", "created_at")
    if _index_exists(connection, "skills", "ix_skills_owner_user_id"):
        op.drop_index("ix_skills_owner_user_id", table_name="skills")
    if _column_exists(connection, "skills", "owner_user_id"):
        op.drop_column("skills", "owner_user_id")
