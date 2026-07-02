from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    PolicyRow,
    RoundEditUnlockRow,
    RoomMemberRow,
    RoundRow,
    SeasonRow,
    UserRow,
    get_db,
)
from simulation.engine import run_simulation
from simulation.policies import build_policy_fn

router = APIRouter(prefix="/policies", tags=["policies"])


class SavePolicyRequest(BaseModel):
    round_id: str
    policy_type: str   # "order_up_to" | "service_level" | "reorder_point"
    config: dict


class BacktestRequest(BaseModel):
    round_id: str
    policy_type: str
    config: dict


def _can_edit_season_round(db: Session, user: UserRow, rnd: RoundRow) -> bool:
    if not rnd.season_id or rnd.round_number <= 1 or not bool(rnd.locked_for_updates):
        return True
    unlock = (
        db.query(RoundEditUnlockRow)
        .filter(RoundEditUnlockRow.user_id == user.id, RoundEditUnlockRow.round_id == rnd.id)
        .first()
    )
    return unlock is not None


@router.put("")
def save_policy(
    body: SavePolicyRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == body.round_id).first()
    if not rnd:
        raise HTTPException(404, "Month not found")
    if rnd.status != "active":
        raise HTTPException(400, "Month is no longer accepting submissions")

    # Verify user is a member of this room
    if rnd.room_id:
        member = (
            db.query(RoomMemberRow)
            .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == rnd.room_id)
            .first()
        )
        if not member:
            raise HTTPException(403, "Not a member of this classroom")
    elif rnd.season_id:
        season = db.query(SeasonRow).filter(SeasonRow.id == rnd.season_id).first()
        if not season or season.owner_user_id != user.id:
            raise HTTPException(403, "Not your season")

    if not _can_edit_season_round(db, user, rnd):
        raise HTTPException(
            403,
            "Policy locked. Spend a policy review in this month to unlock editing.",
        )

    # Validate the policy compiles
    try:
        build_policy_fn(body.policy_type, body.config)
    except Exception as e:
        raise HTTPException(400, f"Invalid policy configuration: {e}")

    # Upsert: one policy per user per round
    existing = (
        db.query(PolicyRow)
        .filter(PolicyRow.user_id == user.id, PolicyRow.round_id == body.round_id)
        .first()
    )
    if existing:
        existing.policy_type = body.policy_type
        existing.config = body.config
        db.commit()
        db.refresh(existing)
        return {"message": "Policy updated", "policy_id": existing.id}
    else:
        policy = PolicyRow(
            user_id=user.id,
            round_id=body.round_id,
            policy_type=body.policy_type,
            config=body.config,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
        return {"message": "Policy submitted", "policy_id": policy.id}


@router.get("/{round_id}")
def get_my_policy(
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    policy = (
        db.query(PolicyRow)
        .filter(PolicyRow.user_id == user.id, PolicyRow.round_id == round_id)
        .first()
    )
    if not policy:
        return None

    return {
        "id": policy.id,
        "policy_type": policy.policy_type,
        "config": policy.config,
        "submitted_at": policy.submitted_at.isoformat() if policy.submitted_at else None,
    }


@router.delete("/{round_id}")
def delete_my_policy(
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Month not found")
    if rnd.status != "active":
        raise HTTPException(400, "Month is no longer accepting submissions")

    # Verify user is a member of this room / owner of private sandbox season.
    if rnd.room_id:
        member = (
            db.query(RoomMemberRow)
            .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == rnd.room_id)
            .first()
        )
        if not member:
            raise HTTPException(403, "Not a member of this classroom")
    elif rnd.season_id:
        season = db.query(SeasonRow).filter(SeasonRow.id == rnd.season_id).first()
        if not season or season.owner_user_id != user.id:
            raise HTTPException(403, "Not your season")

    if not _can_edit_season_round(db, user, rnd):
        raise HTTPException(
            403,
            "Policy locked. Spend a policy review in this month to unlock editing.",
        )

    policy = (
        db.query(PolicyRow)
        .filter(PolicyRow.user_id == user.id, PolicyRow.round_id == round_id)
        .first()
    )
    if not policy:
        raise HTTPException(404, "No submitted policy to undo for this round")

    db.delete(policy)
    db.commit()
    return {"message": "Policy submission undone"}


@router.post("/backtest")
def backtest_policy(
    body: BacktestRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == body.round_id).first()
    if not rnd:
        raise HTTPException(404, "Month not found")

    try:
        policy_fn = build_policy_fn(body.policy_type, body.config)
    except Exception as e:
        raise HTTPException(400, f"Invalid policy: {e}")

    # Run against historical data (the training set)
    result = run_simulation(
        policy_fn=policy_fn,
        scenario_days=rnd.historical_data,
        costs=rnd.costs,
        starting_inventory=rnd.starting_inventory,
    )

    return result.to_dict()
