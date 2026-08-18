from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import UserRow, get_db

router = APIRouter(prefix="/auth", tags=["auth"])

LEGACY_AUTH_DISABLED_DETAIL = (
    "Local credential authentication has been removed. Use ZITADEL sign-in instead."
)


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@router.post("/register")
def register_disabled():
    raise HTTPException(status_code=410, detail=LEGACY_AUTH_DISABLED_DETAIL)


@router.post("/login")
def login_disabled():
    raise HTTPException(status_code=410, detail=LEGACY_AUTH_DISABLED_DETAIL)


@router.post("/admin-reset-password")
def admin_reset_password_disabled():
    raise HTTPException(
        status_code=410,
        detail="Password reset is managed by ZITADEL, not by the application.",
    )


@router.get("/users")
def list_users_disabled():
    raise HTTPException(
        status_code=410,
        detail="Local password-management user listing has been removed.",
    )


@router.put("/profile")
def update_profile(
    body: UpdateProfileRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.current_password is not None or body.new_password is not None:
        raise HTTPException(
            status_code=410,
            detail="Password changes are managed by ZITADEL, not by the application.",
        )

    if body.display_name is not None:
        name = body.display_name.strip()
        if not name:
            raise HTTPException(400, "Display name cannot be empty")
        user.display_name = name
        db.commit()
        db.refresh(user)

    return {
        "user_id": user.id,
        "display_name": user.display_name,
        "role": user.role,
    }
