"""Season endpoints for classroom and solo season runs."""

from __future__ import annotations

import secrets
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user, require_professor
from database import (
    PolicyRow,
    RoundEditUnlockRow,
    ResultRow,
    RoomMemberRow,
    RoomRow,
    RoomSoloTemplateRow,
    RoundRow,
    SeasonMemberStateRow,
    SeasonRow,
    UserRow,
    get_db,
)
from simulation.engine import run_simulation
from simulation.policies import build_policy_fn
from simulation.season_scenarios import (
    generate_mixed_season,
    list_presets,
    slice_round_data,
)
from simulation.story_packages import (
    build_story_timeline,
    get_story_package,
    list_story_packages,
)

router = APIRouter(prefix="/seasons", tags=["seasons"])

TYPICAL_MONTH_DAYS_MIN = 21
TYPICAL_MONTH_DAYS_MAX = 35


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateSeasonRequest(BaseModel):
    room_id: Optional[str] = None
    name: str
    scenario_preset: str = "steady"
    scenario_config: dict = {}
    costs: dict
    starting_inventory: int = 100
    total_rounds: int = 20
    contract_updates_allowed: int = 3
    round_duration_days: int = 30
    historical_leadin_days: int = 60
    first_round_deadline: Optional[str] = None  # ISO datetime string
    season_mode: str = "single"
    mix_config: dict = {}
    season_scope: str = "room"
    source_template_id: Optional[str] = None
    seed: Optional[int] = None
    story_package_id: Optional[str] = None


class PreviewSeasonRequest(BaseModel):
    scenario_preset: str = "steady"
    scenario_config: dict = {}
    total_rounds: int = 5
    round_duration_days: int = 30
    historical_leadin_days: int = 60
    season_mode: str = "single"
    mix_config: dict = {}
    seed: Optional[int] = None


class RoomSoloTemplateRequest(BaseModel):
    name: str
    season_mode: str = "random_mix"
    total_rounds: int = 5
    contract_updates_allowed: int = 1
    round_duration_days: int = 30
    historical_leadin_days: int = 60
    scenario_preset: str = "steady"
    scenario_config: dict = {}
    mix_config: dict = {}
    costs: dict
    starting_inventory: int = 100
    is_published: bool = True
    scenario_seed: Optional[int] = 42


class RoundSummary(BaseModel):
    id: str
    round_number: int
    status: str
    deadline: str
    locked_for_updates: bool


class SeasonResponse(BaseModel):
    id: str
    room_id: str | None
    owner_user_id: str | None
    season_scope: str
    source_template_id: str | None
    name: str
    scenario_preset: str
    scenario_config: dict
    total_rounds: int
    contract_updates_allowed: int
    costs: dict
    starting_inventory: int
    round_duration_days: int
    historical_leadin_days: int
    season_mode: str
    mix_config: dict
    story_package_id: str | None = None
    narrative: str | None = None
    news: list[dict] = []
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
        raise HTTPException(403, "Not a member of this classroom")


def _ensure_season_access(db: Session, user: UserRow, season: SeasonRow):
    if season.room_id:
        _ensure_member(db, user, season.room_id)
        return
    if season.owner_user_id != user.id:
        raise HTTPException(403, "Not your season")


def _template_to_dict(row: RoomSoloTemplateRow) -> dict:
    return {
        "id": row.id,
        "room_id": row.room_id,
        "name": row.name,
        "season_mode": row.season_mode,
        "total_rounds": row.total_rounds,
        "contract_updates_allowed": row.contract_updates_allowed,
        "round_duration_days": row.round_duration_days,
        "historical_leadin_days": row.historical_leadin_days,
        "scenario_preset": row.scenario_preset,
        "scenario_config": row.scenario_config or {},
        "mix_config": row.mix_config or {},
        "costs": row.costs,
        "starting_inventory": row.starting_inventory,
        "is_published": bool(row.is_published),
        "scenario_seed": row.scenario_seed,
    }


def _get_or_create_private_sandbox_room(db: Session, user: UserRow) -> RoomRow:
    sandbox_name = f"__sandbox__{user.id}"
    room = db.query(RoomRow).filter(RoomRow.name == sandbox_name).first()
    if room:
        member = (
            db.query(RoomMemberRow)
            .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == room.id)
            .first()
        )
        if not member:
            db.add(RoomMemberRow(user_id=user.id, room_id=room.id))
            db.flush()
        return room
    room = RoomRow(
        name=sandbox_name,
        invite_code=secrets.token_hex(4).upper(),
        professor_id=user.id,
        completed=False,
    )
    db.add(room)
    db.flush()
    db.add(RoomMemberRow(user_id=user.id, room_id=room.id))
    db.flush()
    return room


def _season_to_response(season: SeasonRow, rounds: list[RoundRow]) -> dict:
    return {
        "id": season.id,
        "room_id": season.room_id,
        "owner_user_id": season.owner_user_id,
        "season_scope": season.season_scope,
        "source_template_id": season.source_template_id,
        "name": season.name,
        "scenario_preset": season.scenario_preset,
        "scenario_config": season.scenario_config or {},
        "total_rounds": season.total_rounds,
        "contract_updates_allowed": season.contract_updates_allowed,
        "costs": season.costs,
        "starting_inventory": season.starting_inventory,
        "round_duration_days": season.round_duration_days,
        "historical_leadin_days": season.historical_leadin_days,
        "season_mode": season.season_mode,
        "mix_config": season.mix_config or {},
        "story_package_id": season.story_package_id,
        "narrative": season.narrative,
        "news": season.news or [],
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


@router.get("/story-packages")
def get_story_packages(_: UserRow = Depends(get_current_user)):
    """List authored narrative story packages (metadata, narrative, news)."""
    return list_story_packages()


@router.get("/story-packages/{story_id}/preview")
def preview_story_package(
    story_id: str,
    _: UserRow = Depends(get_current_user),
):
    """Return a story's frozen demand timeline so the chart can be previewed."""
    pkg = get_story_package(story_id)
    if not pkg:
        raise HTTPException(404, "Story package not found")
    plan = build_story_timeline(story_id)
    total_rounds = pkg["total_rounds"]
    round_duration = pkg["round_duration_days"]
    return {
        "leadin": plan["leadin"],
        "timeline": plan["timeline"],
        "round_boundaries": [
            i * round_duration + 1 for i in range(1, total_rounds)
        ],
    }


@router.post("/preview")
def preview_season(
    body: PreviewSeasonRequest,
    _: UserRow = Depends(get_current_user),
):
    """Generate a season timeline without persisting it so the professor can
    visualize the demand signal and historical lead-in before creating."""
    if body.total_rounds < 1:
        raise HTTPException(400, "total_rounds must be >= 1")
    if body.round_duration_days < 1:
        raise HTTPException(400, "round_duration_days must be >= 1")
    try:
        plan = generate_mixed_season(
            season_mode=body.season_mode,
            total_rounds=body.total_rounds,
            round_duration_days=body.round_duration_days,
            leadin_days=body.historical_leadin_days,
            scenario_preset=body.scenario_preset,
            scenario_config=body.scenario_config or {},
            mix_config=body.mix_config or {},
            seed=body.seed,
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(400, str(exc))
    return {
        "leadin": plan["leadin"],
        "timeline": plan["timeline"],
        "round_boundaries": [
            i * body.round_duration_days + 1 for i in range(1, body.total_rounds)
        ],
        "round_plan": plan.get("round_plan", []),
    }


# ---------------------------------------------------------------------------
# Create / Read
# ---------------------------------------------------------------------------


@router.post("", response_model=SeasonResponse)
def create_season(
    body: CreateSeasonRequest,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope = (body.season_scope or "room").lower()
    room = None
    if scope == "room":
        if not body.room_id:
            raise HTTPException(400, "room_id required for classroom fiscal years")
        room = db.query(RoomRow).filter(RoomRow.id == body.room_id).first()
        if not room:
            raise HTTPException(404, "Classroom not found")
        if user.role == "professor":
            if room.professor_id != user.id:
                raise HTTPException(403, "Not your classroom")
        else:
            _ensure_member(db, user, room.id)
        if room.completed:
            raise HTTPException(400, "This class is completed; no more fiscal years can be created")
    elif scope != "sandbox":
        raise HTTPException(400, "season_scope must be room or sandbox")
    if scope == "sandbox":
        room = _get_or_create_private_sandbox_room(db, user)
        body.room_id = room.id

    # A story package pre-selects every mechanical setting (rounds, contract
    # updates, duration, lead-in, inventory, costs) and ships a frozen timeline
    # plus narrative + news. Professor-provided values are overridden by the
    # package so the authored story stays coherent.
    story_pkg = None
    if body.story_package_id:
        story_pkg = get_story_package(body.story_package_id)
        if not story_pkg:
            raise HTTPException(404, "Story package not found")
        body.total_rounds = story_pkg["total_rounds"]
        body.round_duration_days = story_pkg["round_duration_days"]
        body.historical_leadin_days = story_pkg["historical_leadin_days"]
        body.contract_updates_allowed = story_pkg["contract_updates_allowed"]
        body.starting_inventory = story_pkg["starting_inventory"]
        body.costs = dict(story_pkg["costs"])
        body.season_mode = "single"
        body.mix_config = {}
        body.scenario_config = {}

    if body.total_rounds < 1:
        raise HTTPException(400, "total_rounds must be >= 1")
    if body.contract_updates_allowed < 0:
        raise HTTPException(400, "contract_updates_allowed must be >= 0")
    if body.round_duration_days < 1:
        raise HTTPException(400, "round_duration_days must be >= 1")
    if not body.story_package_id and (
        body.round_duration_days < TYPICAL_MONTH_DAYS_MIN
        or body.round_duration_days > TYPICAL_MONTH_DAYS_MAX
    ):
        raise HTTPException(
            400,
            f"Month length must be between {TYPICAL_MONTH_DAYS_MIN} and {TYPICAL_MONTH_DAYS_MAX} days",
        )

    def _parse_iso_deadline(value: str) -> datetime:
        # Accept common JS ISO output with trailing Z.
        cleaned = value.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        return datetime.fromisoformat(cleaned)

    first_deadline: datetime
    if body.first_round_deadline:
        try:
            first_deadline = _parse_iso_deadline(body.first_round_deadline)
        except Exception:
            raise HTTPException(400, "first_round_deadline must be ISO datetime")
    else:
        # Self-run seasons should not require a manual deadline.
        if scope in ("sandbox", "room"):
            first_deadline = datetime.now()
        else:
            raise HTTPException(400, "first_round_deadline must be ISO datetime")

    # Generate the season timeline. Story packages use a frozen, hand-authored
    # timeline; everything else uses the algorithmic generator.
    if story_pkg is not None:
        plan = build_story_timeline(body.story_package_id)
    else:
        try:
            plan = generate_mixed_season(
                season_mode=body.season_mode,
                total_rounds=body.total_rounds,
                round_duration_days=body.round_duration_days,
                leadin_days=body.historical_leadin_days,
                scenario_preset=body.scenario_preset,
                scenario_config=body.scenario_config or {},
                mix_config=body.mix_config or {},
                seed=body.seed,
            )
        except (ValueError, TypeError) as exc:
            raise HTTPException(400, str(exc))

    season = SeasonRow(
        room_id=body.room_id,
        owner_user_id=user.id,
        season_scope=scope,
        source_template_id=body.source_template_id,
        name=body.name,
        total_rounds=body.total_rounds,
        contract_updates_allowed=body.contract_updates_allowed,
        scenario_preset=body.scenario_preset,
        scenario_config=body.scenario_config or {},
        season_mode=body.season_mode,
        mix_config=body.mix_config or {},
        costs=body.costs,
        starting_inventory=body.starting_inventory,
        round_duration_days=body.round_duration_days,
        historical_leadin_days=body.historical_leadin_days,
        story_package_id=body.story_package_id,
        narrative=story_pkg["narrative"] if story_pkg else None,
        news=story_pkg["news"] if story_pkg else [],
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

    auto_start = bool(
        scope == "sandbox" or body.source_template_id is not None or user.role != "professor"
    )
    if auto_start and rounds:
        season.status = "active"
        rounds[0].status = "active"
        rounds[0].locked_for_updates = False

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
        .filter(SeasonRow.room_id == room_id, SeasonRow.season_scope == "room")
        .order_by(SeasonRow.created_at.desc())
        .all()
    )
    # Template ("Season Sprint") runs are private: only the owner lists them; shared
    # room seasons without a template stay visible to all members.
    visible = [
        s
        for s in seasons
        if s.source_template_id is None or s.owner_user_id == user.id
    ]
    template_seasons = [s for s in visible if s.source_template_id]
    by_group: dict[tuple[str, str], list[SeasonRow]] = defaultdict(list)
    for s in template_seasons:
        by_group[(s.owner_user_id or "", s.source_template_id or "")].append(s)
    attempt_by_id: dict[str, int] = {}
    for _key, group in by_group.items():
        ordered = sorted(
            group,
            key=lambda x: (x.created_at or datetime.min, x.id),
        )
        for i, s in enumerate(ordered, 1):
            attempt_by_id[s.id] = i
    tids = {s.source_template_id for s in template_seasons if s.source_template_id}
    name_by_tid: dict[str, str] = {}
    if tids:
        for trow in (
            db.query(RoomSoloTemplateRow)
            .filter(RoomSoloTemplateRow.id.in_(tids))
            .all()
        ):
            name_by_tid[trow.id] = trow.name

    out: list[dict] = []
    for s in visible:
        rounds = (
            db.query(RoundRow)
            .filter(RoundRow.season_id == s.id)
            .order_by(RoundRow.round_number)
            .all()
        )
        row = _season_to_response(s, rounds)
        if s.source_template_id:
            row["sprint_attempt"] = attempt_by_id.get(s.id, 1)
            row["template_name"] = name_by_tid.get(s.source_template_id)
        else:
            row["sprint_attempt"] = None
            row["template_name"] = None
        out.append(row)
    return out


@router.get("/sandbox")
def list_sandbox_seasons(
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    seasons = (
        db.query(SeasonRow)
        .filter(SeasonRow.owner_user_id == user.id, SeasonRow.season_scope == "sandbox")
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


@router.get("/my-solo")
def list_my_solo_seasons(
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    seasons = (
        db.query(SeasonRow)
        .filter(
            SeasonRow.owner_user_id == user.id,
            (SeasonRow.season_scope == "sandbox") | (SeasonRow.source_template_id.isnot(None)),
        )
        .order_by(SeasonRow.created_at.desc())
        .all()
    )
    template_seasons = [s for s in seasons if s.source_template_id]
    by_group: dict[tuple[str, str], list[SeasonRow]] = defaultdict(list)
    for s in template_seasons:
        by_group[(s.room_id or "", s.source_template_id or "")].append(s)
    attempt_by_id: dict[str, int] = {}
    for _key, group in by_group.items():
        ordered = sorted(
            group,
            key=lambda x: (x.created_at or datetime.min, x.id),
        )
        for i, s in enumerate(ordered, 1):
            attempt_by_id[s.id] = i
    tids = {s.source_template_id for s in template_seasons if s.source_template_id}
    name_by_tid: dict[str, str] = {}
    if tids:
        for trow in (
            db.query(RoomSoloTemplateRow)
            .filter(RoomSoloTemplateRow.id.in_(tids))
            .all()
        ):
            name_by_tid[trow.id] = trow.name
    rids = {s.room_id for s in seasons if s.room_id}
    room_name_by_id: dict[str, str] = {}
    if rids:
        for rm in db.query(RoomRow).filter(RoomRow.id.in_(rids)).all():
            room_name_by_id[rm.id] = rm.name
    out = []
    for s in seasons:
        rounds = (
            db.query(RoundRow)
            .filter(RoundRow.season_id == s.id)
            .order_by(RoundRow.round_number)
            .all()
        )
        row = _season_to_response(s, rounds)
        row["open_path"] = (
            f"/room/{s.room_id}/season/{s.id}" if s.room_id else f"/season-sprint/{s.id}"
        )
        if s.source_template_id:
            row["sprint_attempt"] = attempt_by_id.get(s.id, 1)
            row["template_name"] = name_by_tid.get(s.source_template_id)
        else:
            row["sprint_attempt"] = None
            row["template_name"] = None
        row["room_name"] = room_name_by_id.get(s.room_id) if s.room_id else None
        out.append(row)
    return out


@router.get("/{season_id}", response_model=SeasonResponse)
def get_season(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Fiscal year not found")
    _ensure_season_access(db, user, season)
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
        raise HTTPException(404, "Fiscal year not found")
    _ensure_season_access(db, user, season)

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
    active_round_unlocked = False
    if active:
        unlock_now = (
            db.query(RoundEditUnlockRow)
            .filter(
                RoundEditUnlockRow.user_id == user.id,
                RoundEditUnlockRow.round_id == active.id,
            )
            .first()
        )
        active_round_unlocked = (
            active.round_number == 1
            or not bool(active.locked_for_updates)
            or unlock_now is not None
        )

    return {
        "season_id": season_id,
        "contract_updates_used": used,
        "contract_updates_allowed": season.contract_updates_allowed,
        "contract_updates_remaining": max(0, season.contract_updates_allowed - used),
        "active_round_id": active.id if active else None,
        "active_round_number": active.round_number if active else None,
        "active_round_unlocked": active_round_unlocked,
        "can_unlock_active_round": bool(
            active
            and active.round_number > 1
            and active.status == "active"
            and not active_round_unlocked
            and used < season.contract_updates_allowed
        ),
    }


# ---------------------------------------------------------------------------
# Activate / Advance
# ---------------------------------------------------------------------------


@router.post("/{season_id}/activate")
def activate_season(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Fiscal year not found")
    if season.room_id:
        if user.role == "professor":
            if not _is_professor_of(db, user, season.room_id):
                raise HTTPException(403, "Not your classroom")
        else:
            _ensure_member(db, user, season.room_id)
    elif season.owner_user_id != user.id:
        raise HTTPException(403, "Not your season")
    if season.status != "draft":
        raise HTTPException(400, f"Fiscal year is already {season.status}")

    first = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id, RoundRow.round_number == 1)
        .first()
    )
    if not first:
        raise HTTPException(500, "Fiscal year has no month 1")

    season.status = "active"
    first.status = "active"
    # Round 1 is always editable (initial contract).
    first.locked_for_updates = False
    db.commit()
    return {"message": "Fiscal year activated", "active_round_id": first.id}


@router.post("/{season_id}/advance")
def advance_season(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score the current active round and activate the next one.
    Policies are copied forward by default; students may spend a contract
    update token in the new active round to unlock editing."""

    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Fiscal year not found")
    if season.room_id:
        if user.role == "professor":
            if not _is_professor_of(db, user, season.room_id):
                raise HTTPException(403, "Not your classroom")
        else:
            _ensure_member(db, user, season.room_id)
    elif season.owner_user_id != user.id:
        raise HTTPException(403, "Not your season")
    if season.status != "active":
        raise HTTPException(400, f"Fiscal year is {season.status}")

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
        return {"message": "Fiscal year complete", "season_status": "completed"}

    # Copy prior policies into the next round for all users by default.
    prev_policies = db.query(PolicyRow).filter(PolicyRow.round_id == active.id).all()
    for pol in prev_policies:
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
    next_round.locked_for_updates = next_round.round_number > 1
    db.commit()
    return {
        "message": "Advanced to next month",
        "scored_round_id": active.id,
        "active_round_id": next_round.id,
    }


@router.post("/{season_id}/undo-latest-advance")
def undo_latest_advance(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Fiscal year not found")
    _ensure_season_access(db, user, season)

    # Only allow self-managed solo seasons to undo scoring.
    is_solo_owner = (
        season.owner_user_id == user.id
        and (season.season_scope == "sandbox" or season.source_template_id is not None)
    )
    if not is_solo_owner:
        raise HTTPException(403, "Undo scoring is only available in your practice runs")

    latest_scored = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id, RoundRow.status == "scored")
        .order_by(RoundRow.round_number.desc())
        .first()
    )
    if not latest_scored:
        raise HTTPException(400, "No scored round to undo")

    next_round = (
        db.query(RoundRow)
        .filter(
            RoundRow.season_id == season_id,
            RoundRow.round_number == latest_scored.round_number + 1,
        )
        .first()
    )

    # Roll back results for the reopened round.
    db.query(ResultRow).filter(ResultRow.round_id == latest_scored.id).delete()
    latest_scored.status = "active"

    if next_round:
        # Undo the "advance" side effects so the next round is untouched again.
        next_round.status = "draft"
        next_round.locked_for_updates = True
        db.query(PolicyRow).filter(PolicyRow.round_id == next_round.id).delete()
        db.query(RoundEditUnlockRow).filter(RoundEditUnlockRow.round_id == next_round.id).delete()

    season.status = "active"
    db.commit()

    return {
        "message": "Latest scored round reopened",
        "active_round_id": latest_scored.id,
        "reopened_round_number": latest_scored.round_number,
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
                dual_source_spend=result.dual_source_spend,
                black_swan_hits=result.black_swan_hits,
                black_swan_total_cost=result.black_swan_total_cost,
                daily_log=[d.to_dict() for d in result.daily_log],
                highlights=result.highlights,
            )
        )
        scored += 1
    return scored


# ---------------------------------------------------------------------------
# Spend a contract-update token to unlock active round edits
# ---------------------------------------------------------------------------


@router.post("/{season_id}/rounds/{round_id}/unlock")
def unlock_round_edits(
    season_id: str,
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Month not found")
    if not rnd.season_id:
        raise HTTPException(400, "This round is not part of a season")
    if rnd.season_id != season_id:
        raise HTTPException(400, "Month does not belong to this fiscal year")
    if rnd.status != "active":
        raise HTTPException(400, "Month is not active")
    if rnd.round_number <= 1:
        raise HTTPException(400, "Month 1 is already editable")

    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(500, "Fiscal year missing")
    _ensure_season_access(db, user, season)

    existing_unlock = (
        db.query(RoundEditUnlockRow)
        .filter(
            RoundEditUnlockRow.user_id == user.id,
            RoundEditUnlockRow.round_id == rnd.id,
        )
        .first()
    )
    if existing_unlock:
        state = _get_or_create_member_state(db, season, user)
        return {
            "message": "Month already unlocked",
            "round_id": rnd.id,
            "contract_updates_used": state.contract_updates_used,
            "contract_updates_remaining": max(
                0,
                season.contract_updates_allowed - state.contract_updates_used,
            ),
        }

    state = _get_or_create_member_state(db, season, user)
    if state.contract_updates_used >= season.contract_updates_allowed:
        raise HTTPException(400, "No policy reviews remaining")

    state.contract_updates_used += 1
    db.add(
        RoundEditUnlockRow(
            season_id=season.id,
            user_id=user.id,
            round_id=rnd.id,
        )
    )
    db.commit()
    return {
        "message": "Month unlocked for policy edits",
        "round_id": rnd.id,
        "contract_updates_used": state.contract_updates_used,
        "contract_updates_remaining": max(
            0, season.contract_updates_allowed - state.contract_updates_used
        ),
    }


@router.get("/room/{room_id}/solo-templates")
def list_room_solo_templates(
    room_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_member(db, user, room_id)
    q = db.query(RoomSoloTemplateRow).filter(RoomSoloTemplateRow.room_id == room_id)
    if user.role != "professor":
        q = q.filter(RoomSoloTemplateRow.is_published == True)
    rows = q.order_by(RoomSoloTemplateRow.created_at.desc()).all()
    return [_template_to_dict(r) for r in rows]


@router.post("/room/{room_id}/solo-templates")
def create_room_solo_template(
    room_id: str,
    body: RoomSoloTemplateRequest,
    user: UserRow = Depends(require_professor),
    db: Session = Depends(get_db),
):
    if not _is_professor_of(db, user, room_id):
        raise HTTPException(403, "Not your room")
    row = RoomSoloTemplateRow(
        room_id=room_id,
        name=body.name,
        season_mode=body.season_mode,
        total_rounds=body.total_rounds,
        contract_updates_allowed=body.contract_updates_allowed,
        round_duration_days=body.round_duration_days,
        historical_leadin_days=body.historical_leadin_days,
        scenario_preset=body.scenario_preset,
        scenario_config=body.scenario_config or {},
        mix_config=body.mix_config or {},
        costs=body.costs,
        starting_inventory=body.starting_inventory,
        is_published=body.is_published,
        scenario_seed=body.scenario_seed,
        created_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _template_to_dict(row)


@router.post("/room/{room_id}/solo-templates/{template_id}/instantiate", response_model=SeasonResponse)
def instantiate_room_solo_template(
    room_id: str,
    template_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_member(db, user, room_id)
    template = (
        db.query(RoomSoloTemplateRow)
        .filter(RoomSoloTemplateRow.id == template_id, RoomSoloTemplateRow.room_id == room_id)
        .first()
    )
    if not template:
        raise HTTPException(404, "Template not found")
    if not template.is_published and not _is_professor_of(db, user, room_id):
        raise HTTPException(403, "Template not published")
    seed = template.scenario_seed if template.scenario_seed is not None else 42
    body = CreateSeasonRequest(
        room_id=room_id,
        name=f"{template.name} · {user.display_name}",
        scenario_preset=template.scenario_preset,
        scenario_config=template.scenario_config or {},
        costs=template.costs,
        starting_inventory=template.starting_inventory,
        total_rounds=template.total_rounds,
        contract_updates_allowed=template.contract_updates_allowed,
        round_duration_days=template.round_duration_days,
        historical_leadin_days=template.historical_leadin_days,
        first_round_deadline=datetime.now().isoformat(),
        season_mode=template.season_mode,
        mix_config=template.mix_config or {},
        season_scope="room",
        source_template_id=template.id,
        seed=seed,
    )
    return create_season(body=body, user=user, db=db)
