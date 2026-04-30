from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_professor
from database import (
    UserRow, RoomRow, RoomMemberRow, RoundRow,
    PolicyRow, ResultRow, SeasonRow, get_db,
)
from simulation.engine import run_simulation
from simulation.policies import build_policy_fn

router = APIRouter(prefix="/rounds", tags=["rounds"])


class CreateRoundRequest(BaseModel):
    room_id: str
    historical_data: list[dict]
    actual_data: list[dict]
    costs: dict
    starting_inventory: int = 100
    deadline: str  # ISO datetime string


class UpdateRoundRequest(BaseModel):
    historical_data: list[dict] | None = None
    actual_data: list[dict] | None = None
    costs: dict | None = None
    starting_inventory: int | None = None
    deadline: str | None = None


class RoundResponse(BaseModel):
    id: str
    room_id: str
    season_id: str | None
    round_number: int
    historical_data: list[dict]
    actual_data: list[dict] | None  # None until scored
    costs: dict
    starting_inventory: int
    deadline: str
    status: str
    locked_for_updates: bool = False


@router.post("", response_model=RoundResponse)
def create_round(
    body: CreateRoundRequest,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    room = db.query(RoomRow).filter(RoomRow.id == body.room_id).first()
    if not room or room.professor_id != user.id:
        raise HTTPException(403, "Not your room")
    if room.completed:
        raise HTTPException(400, "This class is completed; no more rounds can be created")

    existing_count = db.query(RoundRow).filter(RoundRow.room_id == body.room_id).count()
    deadline_dt = datetime.fromisoformat(body.deadline)

    rnd = RoundRow(
        room_id=body.room_id,
        round_number=existing_count + 1,
        historical_data=body.historical_data,
        actual_data=body.actual_data,
        costs=body.costs,
        starting_inventory=body.starting_inventory,
        deadline=deadline_dt,
        status="draft",
    )
    db.add(rnd)
    db.commit()
    db.refresh(rnd)

    return _round_response(rnd, reveal_actuals=True)


@router.put("/{round_id}", response_model=RoundResponse)
def update_round(
    round_id: str,
    body: UpdateRoundRequest,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")

    room = db.query(RoomRow).filter(RoomRow.id == rnd.room_id).first()
    if room.professor_id != user.id:
        raise HTTPException(403, "Not your room")

    if rnd.status != "draft":
        raise HTTPException(400, "Only draft rounds can be edited")

    if body.historical_data is not None:
        rnd.historical_data = body.historical_data
    if body.actual_data is not None:
        rnd.actual_data = body.actual_data
    if body.costs is not None:
        rnd.costs = body.costs
    if body.starting_inventory is not None:
        rnd.starting_inventory = body.starting_inventory
    if body.deadline is not None:
        rnd.deadline = datetime.fromisoformat(body.deadline)

    db.commit()
    db.refresh(rnd)
    return _round_response(rnd, reveal_actuals=True)


@router.get("/{round_id}", response_model=RoundResponse)
def get_round(
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")

    is_professor = False
    if rnd.room_id:
        is_professor = (
            db.query(RoomRow)
            .filter(RoomRow.id == rnd.room_id, RoomRow.professor_id == user.id)
            .first()
            is not None
        )
    elif rnd.season_id:
        season = db.query(SeasonRow).filter(SeasonRow.id == rnd.season_id).first()
        is_professor = bool(season and season.owner_user_id == user.id)
    if rnd.status == "draft" and not is_professor:
        raise HTTPException(403, "This round is not yet active")

    reveal = rnd.status == "scored" or is_professor
    return _round_response(rnd, reveal_actuals=reveal)


@router.get("/room/{room_id}")
def list_rounds(
    room_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = (
        db.query(RoomMemberRow)
        .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == room_id)
        .first()
    )
    if not member:
        raise HTTPException(403, "Not a member of this room")

    rounds = (
        db.query(RoundRow)
        .filter(RoundRow.room_id == room_id)
        .order_by(RoundRow.round_number)
        .all()
    )

    is_professor = (
        db.query(RoomRow)
        .filter(RoomRow.id == room_id, RoomRow.professor_id == user.id)
        .first()
        is not None
    )

    visible = rounds if is_professor else [r for r in rounds if r.status != "draft"]

    return [
        _round_response(r, reveal_actuals=(r.status == "scored" or is_professor))
        for r in visible
    ]


@router.post("/{round_id}/activate")
def activate_round(
    round_id: str,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")

    room = db.query(RoomRow).filter(RoomRow.id == rnd.room_id).first()
    if room.professor_id != user.id:
        raise HTTPException(403, "Not your room")

    if room.completed:
        raise HTTPException(400, "This class is completed")

    if rnd.status != "draft":
        raise HTTPException(400, f"Round is already {rnd.status}")

    rnd.status = "active"
    db.commit()
    return {"message": "Round activated"}


@router.delete("/{round_id}")
def delete_round(
    round_id: str,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")

    room = db.query(RoomRow).filter(RoomRow.id == rnd.room_id).first()
    if room.professor_id != user.id:
        raise HTTPException(403, "Not your room")

    db.query(ResultRow).filter(ResultRow.round_id == round_id).delete()
    db.query(PolicyRow).filter(PolicyRow.round_id == round_id).delete()
    db.delete(rnd)
    db.commit()

    return {"message": "Round deleted"}


@router.post("/{round_id}/score")
def score_round(
    round_id: str,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Round not found")

    room = db.query(RoomRow).filter(RoomRow.id == rnd.room_id).first()
    if room.professor_id != user.id:
        raise HTTPException(403, "Not your room")

    if rnd.status == "scored":
        raise HTTPException(400, "Round already scored")

    # Get all submitted policies for this round
    policies = db.query(PolicyRow).filter(PolicyRow.round_id == round_id).all()
    if not policies:
        raise HTTPException(400, "No policies submitted for this round")

    # Seed demand/lead-time history from historical data for policies that need it
    hist_demand = [d["demand"] for d in rnd.historical_data]
    hist_lt = [d["lead_time"] for d in rnd.historical_data]

    scored = []
    for policy in policies:
        # Skip if already scored
        existing = (
            db.query(ResultRow)
            .filter(ResultRow.policy_id == policy.id, ResultRow.round_id == round_id)
            .first()
        )
        if existing:
            continue

        try:
            policy_fn = build_policy_fn(policy.policy_type, policy.config)
        except Exception as e:
            continue  # skip invalid policies

        result = run_simulation(
            policy_fn=policy_fn,
            scenario_days=rnd.actual_data,
            costs=rnd.costs,
            starting_inventory=rnd.starting_inventory,
            demand_history_seed=hist_demand,
            lead_time_history_seed=hist_lt,
        )

        result_row = ResultRow(
            policy_id=policy.id,
            round_id=round_id,
            total_profit=result.total_profit,
            service_level=result.service_level,
            stockout_days=result.stockout_days,
            insurance_spend=result.insurance_spend,
            black_swan_hits=result.black_swan_hits,
            black_swan_total_cost=result.black_swan_total_cost,
            daily_log=[d.to_dict() for d in result.daily_log],
            highlights=result.highlights,
        )
        db.add(result_row)
        scored.append(policy.user_id)

    rnd.status = "scored"
    db.commit()

    return {"message": f"Round scored. {len(scored)} policies evaluated.", "scored_count": len(scored)}


def _round_response(rnd: RoundRow, reveal_actuals: bool) -> dict:
    return {
        "id": rnd.id,
        "room_id": rnd.room_id,
        "season_id": rnd.season_id,
        "round_number": rnd.round_number,
        "historical_data": rnd.historical_data,
        "actual_data": rnd.actual_data if reveal_actuals else None,
        "costs": rnd.costs,
        "starting_inventory": rnd.starting_inventory,
        "deadline": rnd.deadline.isoformat() if rnd.deadline else "",
        "status": rnd.status,
        "locked_for_updates": bool(rnd.locked_for_updates),
    }
