from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    ContractUpdateSignalRow,
    PolicyRow,
    RoomMemberRow,
    RoundRow,
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


@router.put("")
def save_policy(
    body: SavePolicyRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == body.round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")
    if rnd.status != "active":
        raise HTTPException(400, "Round is no longer accepting submissions")

    # Verify user is a member of this room
    member = (
        db.query(RoomMemberRow)
        .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == rnd.room_id)
        .first()
    )
    if not member:
        raise HTTPException(403, "Not a member of this room")

    # Season rounds past round 1 require a signal from the previous round.
    if rnd.season_id and rnd.round_number > 1:
        signal = (
            db.query(ContractUpdateSignalRow)
            .filter(
                ContractUpdateSignalRow.user_id == user.id,
                ContractUpdateSignalRow.target_round_id == rnd.id,
            )
            .first()
        )
        if not signal:
            raise HTTPException(
                403,
                "Policy locked. Signal a contract update during the previous round to edit this one.",
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


@router.post("/backtest")
def backtest_policy(
    body: BacktestRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == body.round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")

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
