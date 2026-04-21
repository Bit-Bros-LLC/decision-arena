"""Season endpoints.

A Season lives beneath a Room and auto-generates N rounds from a season-scale
scenario. Each student gets a pool of contract-update tokens. Rounds beyond the
first are "locked" by default: a student must signal during round N to unlock
round N+1. On advance, non-signalers inherit their previous round's policy.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_professor
from database import (
    ContractUpdateSignalRow,
    PolicyRow,
    ResultRow,
    RoomMemberRow,
    RoomRow,
    RoundRow,
    SeasonMemberStateRow,
    SeasonRow,
    UserRow,
    get_db,
)
from simulation.engine import run_simulation
from simulation.policies import build_policy_fn
from simulation.season_scenarios import (
    generate_season,
    list_presets,
    slice_round_data,
)

router = APIRouter(prefix="/seasons", tags=["seasons"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateSeasonRequest(BaseModel):
    room_id: str
    name: str
    scenario_preset: str
    scenario_config: dict = {}
    costs: dict
    starting_inventory: int = 100
    total_rounds: int = 20
    contract_updates_allowed: int = 3
    round_duration_days: int = 30
    historical_leadin_days: int = 60
    first_round_deadline: str  # ISO datetime string
    seed: Optional[int] = None


class PreviewSeasonRequest(BaseModel):
    scenario_preset: str
    scenario_config: dict = {}
    total_rounds: int = 20
    round_duration_days: int = 30
    historical_leadin_days: int = 60
    seed: Optional[int] = None


class RoundSummary(BaseModel):
    id: str
    round_number: int
    status: str
    deadline: str
    locked_for_updates: bool


class SeasonResponse(BaseModel):
    id: str
    room_id: str
    name: str
    scenario_preset: str
    scenario_config: dict
    total_rounds: int
    contract_updates_allowed: int
    costs: dict
    starting_inventory: int
    round_duration_days: int
    historical_leadin_days: int
    status: str
    rounds: list[RoundSummary]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_professor_of(db: Session, user: UserRow, room_id: str) -> bool:
    room = db.query(RoomRow).filter(RoomRow.id == room_id).first()
    return bool(room and room.professor_id == user.id)


def _ensure_member(db: Session, user: UserRow, room_id: str):
    if _is_professor_of(db, user, room_id):
        return
    member = (
        db.query(RoomMemberRow)
        .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == room_id)
        .first()
    )
    if not member:
        raise HTTPException(403, "Not a member of this room")


def _season_to_response(season: SeasonRow, rounds: list[RoundRow]) -> dict:
    return {
        "id": season.id,
        "room_id": season.room_id,
        "name": season.name,
        "scenario_preset": season.scenario_preset,
        "scenario_config": season.scenario_config or {},
        "total_rounds": season.total_rounds,
        "contract_updates_allowed": season.contract_updates_allowed,
        "costs": season.costs,
        "starting_inventory": season.starting_inventory,
        "round_duration_days": season.round_duration_days,
        "historical_leadin_days": season.historical_leadin_days,
        "status": season.status,
        "rounds": [
            {
                "id": r.id,
                "round_number": r.round_number,
                "status": r.status,
                "deadline": r.deadline.isoformat() if r.deadline else "",
                "locked_for_updates": bool(r.locked_for_updates),
            }
            for r in sorted(rounds, key=lambda x: x.round_number)
        ],
    }


def _get_or_create_member_state(
    db: Session, season: SeasonRow, user: UserRow
) -> SeasonMemberStateRow:
    state = (
        db.query(SeasonMemberStateRow)
        .filter(
            SeasonMemberStateRow.season_id == season.id,
            SeasonMemberStateRow.user_id == user.id,
        )
        .first()
    )
    if state is None:
        state = SeasonMemberStateRow(season_id=season.id, user_id=user.id)
        db.add(state)
        db.flush()
    return state


# ---------------------------------------------------------------------------
# Presets (public to any authenticated user — harmless metadata)
# ---------------------------------------------------------------------------


@router.get("/presets")
def get_presets(_: UserRow = Depends(get_current_user)):
    return list_presets()


@router.post("/preview")
def preview_season(
    body: PreviewSeasonRequest,
    _: UserRow = Depends(require_professor),
):
    """Generate a season timeline without persisting it so the professor can
    visualize the demand signal and historical lead-in before creating."""
    if body.total_rounds < 1:
        raise HTTPException(400, "total_rounds must be >= 1")
    if body.round_duration_days < 1:
        raise HTTPException(400, "round_duration_days must be >= 1")
    try:
        plan = generate_season(
            preset_id=body.scenario_preset,
            total_rounds=body.total_rounds,
            round_duration_days=body.round_duration_days,
            leadin_days=body.historical_leadin_days,
            config=body.scenario_config or {},
            seed=body.seed,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return {
        "leadin": plan["leadin"],
        "timeline": plan["timeline"],
        "round_boundaries": [
            i * body.round_duration_days + 1 for i in range(1, body.total_rounds)
        ],
    }


# ---------------------------------------------------------------------------
# Create / Read
# ---------------------------------------------------------------------------


@router.post("", response_model=SeasonResponse)
def create_season(
    body: CreateSeasonRequest,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    room = db.query(RoomRow).filter(RoomRow.id == body.room_id).first()
    if not room or room.professor_id != user.id:
        raise HTTPException(403, "Not your room")
    if room.completed:
        raise HTTPException(400, "This class is completed; no more seasons can be created")
    if body.total_rounds < 1:
        raise HTTPException(400, "total_rounds must be >= 1")
    if body.contract_updates_allowed < 0:
        raise HTTPException(400, "contract_updates_allowed must be >= 0")
    if body.round_duration_days < 1:
        raise HTTPException(400, "round_duration_days must be >= 1")

    try:
        first_deadline = datetime.fromisoformat(body.first_round_deadline)
    except Exception:
        raise HTTPException(400, "first_round_deadline must be ISO datetime")

    # Generate the season timeline.
    try:
        plan = generate_season(
            preset_id=body.scenario_preset,
            total_rounds=body.total_rounds,
            round_duration_days=body.round_duration_days,
            leadin_days=body.historical_leadin_days,
            config=body.scenario_config or {},
            seed=body.seed,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))

    season = SeasonRow(
        room_id=body.room_id,
        name=body.name,
        total_rounds=body.total_rounds,
        contract_updates_allowed=body.contract_updates_allowed,
        scenario_preset=body.scenario_preset,
        scenario_config=body.scenario_config or {},
        costs=body.costs,
        starting_inventory=body.starting_inventory,
        round_duration_days=body.round_duration_days,
        historical_leadin_days=body.historical_leadin_days,
        status="draft",
    )
    db.add(season)
    db.flush()

    rounds = []
    for i in range(body.total_rounds):
        historical, actual = slice_round_data(
            plan["leadin"], plan["timeline"], i, body.round_duration_days
        )
        rnd = RoundRow(
            room_id=body.room_id,
            season_id=season.id,
            round_number=i + 1,
            historical_data=historical,
            actual_data=actual,
            costs=body.costs,
            starting_inventory=body.starting_inventory,
            deadline=first_deadline + timedelta(days=body.round_duration_days * i),
            status="draft",
            locked_for_updates=(i > 0),
        )
        db.add(rnd)
        rounds.append(rnd)

    db.commit()
    for r in rounds:
        db.refresh(r)
    db.refresh(season)
    return _season_to_response(season, rounds)


@router.get("/room/{room_id}")
def list_room_seasons(
    room_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_member(db, user, room_id)
    seasons = (
        db.query(SeasonRow)
        .filter(SeasonRow.room_id == room_id)
        .order_by(SeasonRow.created_at.desc())
        .all()
    )
    out = []
    for s in seasons:
        rounds = (
            db.query(RoundRow)
            .filter(RoundRow.season_id == s.id)
            .order_by(RoundRow.round_number)
            .all()
        )
        out.append(_season_to_response(s, rounds))
    return out


@router.get("/{season_id}", response_model=SeasonResponse)
def get_season(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Season not found")
    _ensure_member(db, user, season.room_id)
    rounds = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id)
        .order_by(RoundRow.round_number)
        .all()
    )
    return _season_to_response(season, rounds)


@router.get("/{season_id}/my-state")
def get_my_state(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Season not found")
    _ensure_member(db, user, season.room_id)

    state = (
        db.query(SeasonMemberStateRow)
        .filter(
            SeasonMemberStateRow.season_id == season_id,
            SeasonMemberStateRow.user_id == user.id,
        )
        .first()
    )
    used = state.contract_updates_used if state else 0

    # Current active round (if any).
    active = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id, RoundRow.status == "active")
        .order_by(RoundRow.round_number)
        .first()
    )
    next_round = None
    next_round_signaled = False
    if active:
        next_round = (
            db.query(RoundRow)
            .filter(
                RoundRow.season_id == season_id,
                RoundRow.round_number == active.round_number + 1,
            )
            .first()
        )
        if next_round:
            signal = (
                db.query(ContractUpdateSignalRow)
                .filter(
                    ContractUpdateSignalRow.user_id == user.id,
                    ContractUpdateSignalRow.target_round_id == next_round.id,
                )
                .first()
            )
            next_round_signaled = signal is not None

    # Signals for the current round (so the editor can tell whether THIS round is
    # editable for this student).
    current_round_signaled = False
    if active:
        signal_now = (
            db.query(ContractUpdateSignalRow)
            .filter(
                ContractUpdateSignalRow.user_id == user.id,
                ContractUpdateSignalRow.target_round_id == active.id,
            )
            .first()
        )
        current_round_signaled = signal_now is not None

    return {
        "season_id": season_id,
        "contract_updates_used": used,
        "contract_updates_allowed": season.contract_updates_allowed,
        "contract_updates_remaining": max(0, season.contract_updates_allowed - used),
        "active_round_id": active.id if active else None,
        "active_round_number": active.round_number if active else None,
        "current_round_signaled": current_round_signaled,
        "next_round_id": next_round.id if next_round else None,
        "next_round_signaled": next_round_signaled,
    }


# ---------------------------------------------------------------------------
# Activate / Advance
# ---------------------------------------------------------------------------


@router.post("/{season_id}/activate")
def activate_season(
    season_id: str,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Season not found")
    if not _is_professor_of(db, user, season.room_id):
        raise HTTPException(403, "Not your room")
    if season.status != "draft":
        raise HTTPException(400, f"Season is already {season.status}")

    first = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id, RoundRow.round_number == 1)
        .first()
    )
    if not first:
        raise HTTPException(500, "Season has no round 1")

    season.status = "active"
    first.status = "active"
    # Round 1 is always editable (initial contract).
    first.locked_for_updates = False
    db.commit()
    return {"message": "Season activated", "active_round_id": first.id}


@router.post("/{season_id}/advance")
def advance_season(
    season_id: str,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    """Score the current active round and activate the next one. Students who
    did not signal a contract update for the next round inherit their current
    policy automatically."""

    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Season not found")
    if not _is_professor_of(db, user, season.room_id):
        raise HTTPException(403, "Not your room")
    if season.status != "active":
        raise HTTPException(400, f"Season is {season.status}")

    active = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id, RoundRow.status == "active")
        .order_by(RoundRow.round_number)
        .first()
    )
    if not active:
        raise HTTPException(400, "No active round to advance")

    _score_round_in_place(active, db)
    active.status = "scored"

    next_round = (
        db.query(RoundRow)
        .filter(
            RoundRow.season_id == season_id,
            RoundRow.round_number == active.round_number + 1,
        )
        .first()
    )

    if next_round is None:
        season.status = "completed"
        db.commit()
        return {"message": "Season complete", "season_status": "completed"}

    # Copy policies for students who did not signal for `next_round`.
    prev_policies = db.query(PolicyRow).filter(PolicyRow.round_id == active.id).all()
    signaled_user_ids = {
        s.user_id
        for s in db.query(ContractUpdateSignalRow)
        .filter(ContractUpdateSignalRow.target_round_id == next_round.id)
        .all()
    }
    for pol in prev_policies:
        if pol.user_id in signaled_user_ids:
            continue
        existing = (
            db.query(PolicyRow)
            .filter(
                PolicyRow.user_id == pol.user_id,
                PolicyRow.round_id == next_round.id,
            )
            .first()
        )
        if existing:
            continue
        db.add(
            PolicyRow(
                user_id=pol.user_id,
                round_id=next_round.id,
                policy_type=pol.policy_type,
                config=pol.config,
            )
        )

    next_round.status = "active"
    db.commit()
    return {
        "message": "Advanced to next round",
        "scored_round_id": active.id,
        "active_round_id": next_round.id,
    }


def _score_round_in_place(rnd: RoundRow, db: Session) -> int:
    """Run simulation for every policy submitted to this round. Idempotent:
    skips policies that already have a ResultRow."""
    policies = db.query(PolicyRow).filter(PolicyRow.round_id == rnd.id).all()
    hist_demand = [d["demand"] for d in rnd.historical_data]
    hist_lt = [d["lead_time"] for d in rnd.historical_data]

    scored = 0
    for policy in policies:
        existing = (
            db.query(ResultRow)
            .filter(ResultRow.policy_id == policy.id, ResultRow.round_id == rnd.id)
            .first()
        )
        if existing:
            continue
        try:
            policy_fn = build_policy_fn(policy.policy_type, policy.config)
        except Exception:
            continue
        result = run_simulation(
            policy_fn=policy_fn,
            scenario_days=rnd.actual_data,
            costs=rnd.costs,
            starting_inventory=rnd.starting_inventory,
            demand_history_seed=hist_demand,
            lead_time_history_seed=hist_lt,
        )
        db.add(
            ResultRow(
                policy_id=policy.id,
                round_id=rnd.id,
                total_profit=result.total_profit,
                service_level=result.service_level,
                stockout_days=result.stockout_days,
                insurance_spend=result.insurance_spend,
                black_swan_hits=result.black_swan_hits,
                black_swan_total_cost=result.black_swan_total_cost,
                daily_log=[d.to_dict() for d in result.daily_log],
                highlights=result.highlights,
            )
        )
        scored += 1
    return scored


# ---------------------------------------------------------------------------
# Signal a contract update for the next round
# ---------------------------------------------------------------------------


@router.post("/signal/{round_id}")
def signal_update(
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student signals during round N that they will update their policy for
    round N+1. Consumes one contract-update token and unlocks the next round for
    this student."""

    source = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not source:
        raise HTTPException(404, "Round not found")
    if not source.season_id:
        raise HTTPException(400, "This round is not part of a season")
    if source.status != "active":
        raise HTTPException(400, "Source round is not active")

    _ensure_member(db, user, source.room_id)
    if user.role == "professor":
        raise HTTPException(400, "Professors do not submit contract updates")

    target = (
        db.query(RoundRow)
        .filter(
            RoundRow.season_id == source.season_id,
            RoundRow.round_number == source.round_number + 1,
        )
        .first()
    )
    if not target:
        raise HTTPException(400, "No next round in this season")

    existing_signal = (
        db.query(ContractUpdateSignalRow)
        .filter(
            ContractUpdateSignalRow.user_id == user.id,
            ContractUpdateSignalRow.target_round_id == target.id,
        )
        .first()
    )
    if existing_signal:
        raise HTTPException(400, "Already signaled for the next round")

    season = db.query(SeasonRow).filter(SeasonRow.id == source.season_id).first()
    if not season:
        raise HTTPException(500, "Season missing")

    state = _get_or_create_member_state(db, season, user)
    if state.contract_updates_used >= season.contract_updates_allowed:
        raise HTTPException(400, "No contract update tokens remaining")

    state.contract_updates_used += 1
    db.add(
        ContractUpdateSignalRow(
            season_id=season.id,
            user_id=user.id,
            source_round_id=source.id,
            target_round_id=target.id,
        )
    )
    db.commit()
    return {
        "message": "Contract update signaled",
        "target_round_id": target.id,
        "contract_updates_used": state.contract_updates_used,
        "contract_updates_remaining": max(
            0, season.contract_updates_allowed - state.contract_updates_used
        ),
    }
