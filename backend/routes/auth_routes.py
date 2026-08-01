from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import (
    create_token,
    get_current_user,
    hash_password,
    normalize_email,
    require_professor,
    verify_password,
)
from database import RoomMemberRow, RoomRow, UserRow, get_db


def _get_professor_student_ids(professor_id: str, db: Session) -> set[str]:
    """Return the set of user IDs for students in rooms owned by this professor."""
    rows = (
        db.query(RoomMemberRow.user_id)
        .join(RoomRow, RoomMemberRow.room_id == RoomRow.id)
        .filter(RoomRow.professor_id == professor_id)
        .distinct()
        .all()
    )
    return {r[0] for r in rows}

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str
    role: str = "student"  # "student" | "professor"


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    display_name: str
    role: str


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class AdminResetPasswordRequest(BaseModel):
    user_id: str
    new_password: str


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if body.role not in ("student", "professor"):
        raise HTTPException(400, "Role must be 'student' or 'professor'")

    email_norm = normalize_email(body.email)
    existing = (
        db.query(UserRow).filter(func.lower(UserRow.email) == email_norm).first()
    )
    if existing:
        raise HTTPException(409, "Email already registered")

    user = UserRow(
        email=email_norm,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        display_name=user.display_name,
        role=user.role,
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email_norm = normalize_email(body.email)
    user = (
        db.query(UserRow).filter(func.lower(UserRow.email) == email_norm).first()
    )
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_token(user.id, user.role)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        display_name=user.display_name,
        role=user.role,
    )


# ------------------------------------------------------------------
# Self-service profile update (name and/or password)
# ------------------------------------------------------------------

@router.put("/profile")
def update_profile(
    body: UpdateProfileRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.display_name is not None:
        name = body.display_name.strip()
        if not name:
            raise HTTPException(400, "Display name cannot be empty")
        user.display_name = name

    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(400, "Current password is required to set a new password")
        if not verify_password(body.current_password, user.password_hash):
            raise HTTPException(403, "Current password is incorrect")
        if len(body.new_password) < 4:
            raise HTTPException(400, "New password must be at least 4 characters")
        user.password_hash = hash_password(body.new_password)

    db.commit()
    db.refresh(user)
    return {
        "user_id": user.id,
        "display_name": user.display_name,
        "role": user.role,
    }


# ------------------------------------------------------------------
# Professor-only password reset (scoped to their room members)
# ------------------------------------------------------------------

@router.post("/admin-reset-password")
def admin_reset_password(
    body: AdminResetPasswordRequest,
    professor: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    allowed_ids = _get_professor_student_ids(professor.id, db)
    if body.user_id not in allowed_ids:
        raise HTTPException(403, "You can only reset passwords for students in your classrooms")

    target = db.query(UserRow).filter(UserRow.id == body.user_id).first()
    if not target:
        raise HTTPException(404, "User not found")
    if len(body.new_password) < 4:
        raise HTTPException(400, "New password must be at least 4 characters")
    target.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": f"Password reset for {target.display_name}"}


# ------------------------------------------------------------------
# Professor-only: list students in their rooms (for the reset UI)
# ------------------------------------------------------------------

@router.get("/users")
def list_users(
    professor: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    student_ids = _get_professor_student_ids(professor.id, db)
    if not student_ids:
        return []

    users = (
        db.query(UserRow)
        .filter(UserRow.id.in_(student_ids))
        .order_by(UserRow.display_name)
        .all()
    )
    return [
        {
            "user_id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
        }
        for u in users
    ]
