from __future__ import annotations

import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_professor
from database import UserRow, RoomRow, RoomMemberRow, RoundRow, get_db

router = APIRouter(prefix="/rooms", tags=["rooms"])


class CreateRoomRequest(BaseModel):
    name: str


class JoinRoomRequest(BaseModel):
    invite_code: str


class RoomResponse(BaseModel):
    id: str
    name: str
    invite_code: str
    professor_id: str
    professor_name: str
    member_count: int
    completed: bool
    round_display: str

    class Config:
        from_attributes = True


def _round_display(room: RoomRow, db: Session) -> str:
    """Label for home list: active round number or status phrase."""
    if getattr(room, "completed", False):
        return "Complete"
    rounds = (
        db.query(RoundRow)
        .filter(RoundRow.room_id == room.id)
        .order_by(RoundRow.round_number)
        .all()
    )
    if not rounds:
        return "Not started"
    active = next((r for r in rounds if r.status == "active"), None)
    if active:
        return f"Round {active.round_number}"
    if any(r.status == "scored" for r in rounds):
        return "Pending"
    return "Preparing"


def _room_response(room: RoomRow, db: Session) -> dict:
    count = db.query(RoomMemberRow).filter(RoomMemberRow.room_id == room.id).count()
    return {
        "id": room.id,
        "name": room.name,
        "invite_code": room.invite_code,
        "professor_id": room.professor_id,
        "professor_name": room.professor.display_name,
        "member_count": count,
        "completed": bool(getattr(room, "completed", False)),
        "round_display": _round_display(room, db),
    }


@router.post("", response_model=RoomResponse)
def create_room(
    body: CreateRoomRequest,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    code = secrets.token_hex(4).upper()  # 8-char hex code
    room = RoomRow(name=body.name, invite_code=code, professor_id=user.id)
    db.add(room)
    # Professor is also a member
    db.flush()
    db.add(RoomMemberRow(user_id=user.id, room_id=room.id))
    db.commit()
    db.refresh(room)
    return _room_response(room, db)


@router.get("")
def list_rooms(
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    memberships = db.query(RoomMemberRow).filter(RoomMemberRow.user_id == user.id).all()
    room_ids = [m.room_id for m in memberships]
    rooms = db.query(RoomRow).filter(RoomRow.id.in_(room_ids)).all()
    return [_room_response(r, db) for r in rooms]


@router.post("/{room_id}/join")
def join_room(
    room_id: str,
    body: JoinRoomRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    room = db.query(RoomRow).filter(RoomRow.id == room_id).first()
    if not room:
        # Also try matching by invite code in case room_id is actually the code
        room = db.query(RoomRow).filter(RoomRow.invite_code == body.invite_code).first()
    if not room:
        raise HTTPException(404, "Room not found")
    if room.invite_code != body.invite_code:
        raise HTTPException(403, "Invalid invite code")

    existing = (
        db.query(RoomMemberRow)
        .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == room.id)
        .first()
    )
    if existing:
        return {"message": "Already a member", "room_id": room.id}

    db.add(RoomMemberRow(user_id=user.id, room_id=room.id))
    db.commit()
    return {"message": "Joined room", "room_id": room.id, "room_name": room.name}


@router.post("/{room_id}/complete")
def complete_room(
    room_id: str,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    room = db.query(RoomRow).filter(RoomRow.id == room_id).first()
    if not room or room.professor_id != user.id:
        raise HTTPException(403, "Not your room")
    if room.completed:
        raise HTTPException(400, "Room already completed")
    room.completed = True
    db.commit()
    db.refresh(room)
    return _room_response(room, db)
