from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_user
from database import UserRow, PolicyPresetRow, get_db
from simulation.policies import build_policy_fn

router = APIRouter(prefix="/policy-presets", tags=["policy-presets"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


class PolicyPresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    policy_type: str
    config: dict


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


@router.get("")
def list_presets(
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(PolicyPresetRow)
        .filter(PolicyPresetRow.user_id == user.id)
        .order_by(PolicyPresetRow.updated_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "name": r.name,
            "policy_type": r.policy_type,
            "config": r.config,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.post("")
def save_preset(
    body: PolicyPresetCreate,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = _normalize_name(body.name)
    if not name:
        raise HTTPException(400, "Name is required")

    try:
        build_policy_fn(body.policy_type, body.config)
    except Exception as e:
        raise HTTPException(400, f"Invalid policy configuration: {e}")

    existing = (
        db.query(PolicyPresetRow)
        .filter(PolicyPresetRow.user_id == user.id, PolicyPresetRow.name == name)
        .first()
    )
    if existing:
        existing.policy_type = body.policy_type
        existing.config = body.config
        existing.updated_at = _now()
        db.commit()
        db.refresh(existing)
        return {"message": "Preset updated", "id": existing.id}

    row = PolicyPresetRow(
        user_id=user.id,
        name=name,
        policy_type=body.policy_type,
        config=body.config,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"message": "Preset saved", "id": row.id}


@router.delete("/{preset_id}")
def delete_preset(
    preset_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(PolicyPresetRow).filter(PolicyPresetRow.id == preset_id).first()
    if not row or row.user_id != user.id:
        raise HTTPException(404, "Preset not found")
    db.delete(row)
    db.commit()
    return {"message": "Deleted"}
