from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import not_
from sqlalchemy.orm import Session

from auth import get_current_user
from database import PolicyRow, RoomMemberRow, RoomRow, SeasonRow, UserRow, get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/onboarding-status")
def get_onboarding_status(
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    has_policy_submission = (
        db.query(PolicyRow).filter(PolicyRow.user_id == user.id).first() is not None
    )

    has_solo_season = (
        db.query(SeasonRow)
        .filter(
            SeasonRow.owner_user_id == user.id,
            (SeasonRow.season_scope == "sandbox")
            | (SeasonRow.is_practice_run == True)  # noqa: E712
            | (SeasonRow.source_template_id.isnot(None)),
        )
        .first()
        is not None
    )

    memberships = db.query(RoomMemberRow).filter(RoomMemberRow.user_id == user.id).all()
    room_ids = [m.room_id for m in memberships]
    has_class_room = False
    if room_ids:
        has_class_room = (
            db.query(RoomRow)
            .filter(
                RoomRow.id.in_(room_ids),
                not_(RoomRow.name.like("\\_\\_sandbox\\_\\_%", escape="\\")),
            )
            .first()
            is not None
        )

    prof_room_ids = [
        r.id for r in db.query(RoomRow).filter(RoomRow.professor_id == user.id).all()
    ]
    has_teaching_room = bool(prof_room_ids)
    has_season = False
    if prof_room_ids:
        has_season = (
            db.query(SeasonRow).filter(SeasonRow.room_id.in_(prof_room_ids)).first() is not None
        )

    return {
        "has_policy_submission": has_policy_submission,
        "has_solo_season": has_solo_season,
        "has_class_room": has_class_room,
        "has_teaching_room": has_teaching_room,
        "has_season": has_season,
    }
