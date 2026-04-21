from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Boolean,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./decision_arena.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite doesn't have JSONB - use JSON fallback
if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import JSON as JsonColumn
else:
    JsonColumn = JSONB

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class UserRow(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="student")  # "student" | "professor"
    created_at = Column(DateTime, default=_now)

    policies = relationship("PolicyRow", back_populates="user")
    policy_presets = relationship("PolicyPresetRow", back_populates="user")


class RoomRow(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    invite_code = Column(String, unique=True, nullable=False, index=True)
    professor_id = Column(String, ForeignKey("users.id"), nullable=False)
    completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=_now)

    professor = relationship("UserRow")
    members = relationship("RoomMemberRow", back_populates="room")
    rounds = relationship("RoundRow", back_populates="room", order_by="RoundRow.round_number")


class RoomMemberRow(Base):
    __tablename__ = "room_members"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    room_id = Column(String, ForeignKey("rooms.id"), primary_key=True)
    joined_at = Column(DateTime, default=_now)

    user = relationship("UserRow")
    room = relationship("RoomRow", back_populates="members")


class SeasonRow(Base):
    """A Season is a container beneath a Room that auto-generates N rounds from a
    shared scenario plan. Rooms can host multiple seasons. Existing standalone
    rounds remain supported (season_id is nullable on RoundRow)."""

    __tablename__ = "seasons"

    id = Column(String, primary_key=True, default=_uuid)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    total_rounds = Column(Integer, nullable=False, default=20)
    contract_updates_allowed = Column(Integer, nullable=False, default=3)
    scenario_preset = Column(String, nullable=False)
    scenario_config = Column(JsonColumn, nullable=False, default=dict)
    costs = Column(JsonColumn, nullable=False)
    starting_inventory = Column(Integer, nullable=False, default=100)
    round_duration_days = Column(Integer, nullable=False, default=30)
    historical_leadin_days = Column(Integer, nullable=False, default=60)
    status = Column(String, nullable=False, default="draft")  # "draft" | "active" | "completed"
    created_at = Column(DateTime, default=_now)

    room = relationship("RoomRow")
    rounds = relationship(
        "RoundRow", back_populates="season", order_by="RoundRow.round_number"
    )


class SeasonMemberStateRow(Base):
    """Per-student season counters (contract update tokens)."""

    __tablename__ = "season_member_state"
    __table_args__ = (
        UniqueConstraint("season_id", "user_id", name="uq_season_member_state"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    contract_updates_used = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=_now)


class ContractUpdateSignalRow(Base):
    """Signal by a student during round N that they intend to update their policy
    for round N+1. Consumes one of SeasonRow.contract_updates_allowed tokens and
    unlocks PUT /policies for the target round."""

    __tablename__ = "contract_update_signals"
    __table_args__ = (
        UniqueConstraint("user_id", "target_round_id", name="uq_contract_signal"),
    )

    id = Column(String, primary_key=True, default=_uuid)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    source_round_id = Column(String, ForeignKey("rounds.id"), nullable=False)
    target_round_id = Column(String, ForeignKey("rounds.id"), nullable=False, index=True)
    signaled_at = Column(DateTime, default=_now)


class RoundRow(Base):
    __tablename__ = "rounds"

    id = Column(String, primary_key=True, default=_uuid)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    season_id = Column(String, ForeignKey("seasons.id"), nullable=True, index=True)
    round_number = Column(Integer, nullable=False)
    historical_data = Column(JsonColumn, nullable=False)  # list of day dicts
    actual_data = Column(JsonColumn, nullable=False)       # list of day dicts (hidden until scored)
    costs = Column(JsonColumn, nullable=False)
    starting_inventory = Column(Integer, nullable=False, default=100)
    deadline = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default="active")  # "draft" | "active" | "scored"
    # For season rounds > 1: students must signal during the previous round to unlock editing.
    locked_for_updates = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=_now)

    room = relationship("RoomRow", back_populates="rounds")
    season = relationship("SeasonRow", back_populates="rounds")
    results = relationship("ResultRow", back_populates="round")


class PolicyRow(Base):
    __tablename__ = "policies"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    round_id = Column(String, ForeignKey("rounds.id"), nullable=False, index=True)
    policy_type = Column(String, nullable=False)  # "order_up_to" | "service_level" | "reorder_point"
    config = Column(JsonColumn, nullable=False)
    submitted_at = Column(DateTime, default=_now)

    user = relationship("UserRow", back_populates="policies")
    round = relationship("RoundRow")


class PolicyPresetRow(Base):
    """User-saved policy configuration for reuse across rounds."""

    __tablename__ = "policy_presets"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_policy_preset_user_name"),)

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    policy_type = Column(String, nullable=False)
    config = Column(JsonColumn, nullable=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("UserRow", back_populates="policy_presets")


class LessonProgressRow(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "lesson_slug", name="uq_lesson_progress_user_slug"),)

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    lesson_slug = Column(String, nullable=False)
    completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("UserRow")


class ResultRow(Base):
    __tablename__ = "results"

    id = Column(String, primary_key=True, default=_uuid)
    policy_id = Column(String, ForeignKey("policies.id"), nullable=False, index=True)
    round_id = Column(String, ForeignKey("rounds.id"), nullable=False, index=True)
    total_profit = Column(Float, nullable=False)
    service_level = Column(Float, nullable=False)
    stockout_days = Column(Integer, nullable=False)
    insurance_spend = Column(Float, nullable=False, default=0)
    black_swan_hits = Column(Integer, nullable=False, default=0)
    black_swan_total_cost = Column(Float, nullable=False, default=0)
    daily_log = Column(JsonColumn, nullable=False)
    highlights = Column(JsonColumn, nullable=False, default=list)
    computed_at = Column(DateTime, default=_now)

    policy = relationship("PolicyRow")
    round = relationship("RoundRow", back_populates="results")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_schema()


def _migrate_schema():
    """Add columns missing from older SQLite/Postgres DBs."""
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    is_sqlite = DATABASE_URL.startswith("sqlite")

    if insp.has_table("rooms"):
        room_cols = {c["name"] for c in insp.get_columns("rooms")}
        if "completed" not in room_cols:
            with engine.begin() as conn:
                if is_sqlite:
                    conn.execute(
                        text("ALTER TABLE rooms ADD COLUMN completed BOOLEAN NOT NULL DEFAULT 0")
                    )
                else:
                    conn.execute(
                        text(
                            "ALTER TABLE rooms ADD COLUMN completed BOOLEAN NOT NULL DEFAULT FALSE"
                        )
                    )

    if insp.has_table("rounds"):
        # Refresh inspector to see current columns.
        insp = inspect(engine)
        round_cols = {c["name"] for c in insp.get_columns("rounds")}
        alters = []
        if "season_id" not in round_cols:
            alters.append("ALTER TABLE rounds ADD COLUMN season_id VARCHAR")
        if "locked_for_updates" not in round_cols:
            if is_sqlite:
                alters.append(
                    "ALTER TABLE rounds ADD COLUMN locked_for_updates BOOLEAN NOT NULL DEFAULT 0"
                )
            else:
                alters.append(
                    "ALTER TABLE rounds ADD COLUMN locked_for_updates BOOLEAN NOT NULL DEFAULT FALSE"
                )
        if alters:
            with engine.begin() as conn:
                for stmt in alters:
                    conn.execute(text(stmt))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
