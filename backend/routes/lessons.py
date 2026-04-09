from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from database import UserRow, LessonProgressRow, get_db

router = APIRouter(prefix="/lessons", tags=["lessons"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/progress")
def get_progress(
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(LessonProgressRow)
        .filter(LessonProgressRow.user_id == user.id)
        .all()
    )
    return [
        {
            "lesson_slug": r.lesson_slug,
            "completed": r.completed,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in rows
    ]


@router.post("/{slug}/complete")
def complete_lesson(
    slug: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(LessonProgressRow)
        .filter(
            LessonProgressRow.user_id == user.id,
            LessonProgressRow.lesson_slug == slug,
        )
        .first()
    )
    if existing:
        existing.completed = True
        existing.completed_at = _now()
        db.commit()
        return {"message": "Lesson marked complete", "lesson_slug": slug}

    row = LessonProgressRow(
        user_id=user.id,
        lesson_slug=slug,
        completed=True,
        completed_at=_now(),
    )
    db.add(row)
    db.commit()
    return {"message": "Lesson marked complete", "lesson_slug": slug}


@router.post("/{slug}/reset")
def reset_lesson(
    slug: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(LessonProgressRow)
        .filter(
            LessonProgressRow.user_id == user.id,
            LessonProgressRow.lesson_slug == slug,
        )
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
    return {"message": "Lesson progress reset", "lesson_slug": slug}
