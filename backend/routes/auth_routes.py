from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import create_token, hash_password, normalize_email, verify_password
from database import UserRow, get_db

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
