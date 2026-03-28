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


class RoomRow(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    invite_code = Column(String, unique=True, nullable=False, index=True)
    professor_id = Column(String, ForeignKey("users.id"), nullable=False)
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


class RoundRow(Base):
    __tablename__ = "rounds"

    id = Column(String, primary_key=True, default=_uuid)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False)
    historical_data = Column(JsonColumn, nullable=False)  # list of day dicts
    actual_data = Column(JsonColumn, nullable=False)       # list of day dicts (hidden until scored)
    costs = Column(JsonColumn, nullable=False)
    starting_inventory = Column(Integer, nullable=False, default=100)
    deadline = Column(DateTime, nullable=False)
    status = Column(String, nullable=False, default="active")  # "active" | "scored"
    created_at = Column(DateTime, default=_now)

    room = relationship("RoomRow", back_populates="rounds")
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
