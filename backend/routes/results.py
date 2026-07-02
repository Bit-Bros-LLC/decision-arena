from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    UserRow, RoundRow, SeasonRow, RoomSoloTemplateRow,
    PolicyRow, ResultRow, get_db,
)
from routes.seasons import _ensure_season_access, _ensure_member

router = APIRouter(tags=["results"])


def _redact_season_cohort_peers(standings: list[dict], user: UserRow) -> None:
    """In-place: students see 'Other player' and no peer user_id; professors unchanged."""
    is_professor = user.role == "professor"
    for entry in standings:
        if not is_professor and not entry.get("is_me"):
            entry["display_name"] = "Other player"
            entry.pop("user_id", None)


@router.get("/results/{round_id}")
def get_my_results(
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's results for a specific round."""
    policy = (
        db.query(PolicyRow)
        .filter(PolicyRow.user_id == user.id, PolicyRow.round_id == round_id)
        .first()
    )
    if not policy:
        raise HTTPException(404, "No policy submitted for this round")

    result = (
        db.query(ResultRow)
        .filter(ResultRow.policy_id == policy.id, ResultRow.round_id == round_id)
        .first()
    )
    if not result:
        raise HTTPException(404, "Month has not been scored yet")

    return {
        "policy_type": policy.policy_type,
        "policy_config": policy.config,
        "total_profit": result.total_profit,
        "service_level": result.service_level,
        "stockout_days": result.stockout_days,
        "dual_source_spend": result.dual_source_spend,
        "black_swan_hits": result.black_swan_hits,
        "black_swan_total_cost": result.black_swan_total_cost,
        "daily_log": result.daily_log,
        "highlights": result.highlights,
    }


@router.get("/leaderboard/{round_id}")
def round_leaderboard(
    round_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Leaderboard for a single round - all students ranked by profit."""
    rnd = db.query(RoundRow).filter(RoundRow.id == round_id).first()
    if not rnd:
        raise HTTPException(404, "Month not found")
    if rnd.status != "scored":
        raise HTTPException(400, "Month has not been scored yet")

    rows = (
        db.query(ResultRow, PolicyRow, UserRow)
        .join(PolicyRow, ResultRow.policy_id == PolicyRow.id)
        .join(UserRow, PolicyRow.user_id == UserRow.id)
        .filter(ResultRow.round_id == round_id)
        .order_by(ResultRow.total_profit.desc())
        .all()
    )

    leaderboard = []
    for rank, (result, policy, u) in enumerate(rows, 1):
        daily_profits = [d.get("daily_profit", 0) for d in (result.daily_log or [])]
        leaderboard.append({
            "rank": rank,
            "user_id": u.id,
            "display_name": u.display_name,
            "policy_type": policy.policy_type,
            "total_profit": result.total_profit,
            "service_level": result.service_level,
            "stockout_days": result.stockout_days,
            "dual_source_spend": result.dual_source_spend,
            "black_swan_hits": result.black_swan_hits,
            "daily_profits": daily_profits,
            "is_me": u.id == user.id,
        })

    return leaderboard


@router.get("/leaderboard/season/{season_id}")
def season_leaderboard(
    season_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cumulative leaderboard across all scored rounds in a single season."""
    season = db.query(SeasonRow).filter(SeasonRow.id == season_id).first()
    if not season:
        raise HTTPException(404, "Fiscal year not found")
    _ensure_season_access(db, user, season)

    scored_rounds = (
        db.query(RoundRow)
        .filter(RoundRow.season_id == season_id, RoundRow.status == "scored")
        .order_by(RoundRow.round_number)
        .all()
    )
    round_ids = [r.id for r in scored_rounds]

    if not round_ids:
        return {"rounds": [], "standings": []}

    # All results for this season's scored rounds
    all_results = (
        db.query(ResultRow, PolicyRow, UserRow)
        .join(PolicyRow, ResultRow.policy_id == PolicyRow.id)
        .join(UserRow, PolicyRow.user_id == UserRow.id)
        .filter(ResultRow.round_id.in_(round_ids))
        .all()
    )

    # Build per-user season data
    user_data: dict[str, dict] = {}
    for result, policy, u in all_results:
        if u.id not in user_data:
            user_data[u.id] = {
                "user_id": u.id,
                "display_name": u.display_name,
                "rounds": {},
                "season_total": 0.0,
                "rounds_played": 0,
            }
        user_data[u.id]["rounds"][result.round_id] = {
            "round_number": next(r.round_number for r in scored_rounds if r.id == result.round_id),
            "profit": result.total_profit,
            "service_level": result.service_level,
        }
        user_data[u.id]["season_total"] += result.total_profit
        user_data[u.id]["rounds_played"] += 1

    # Sort by season total, assign ranks
    standings = sorted(user_data.values(), key=lambda x: x["season_total"], reverse=True)
    for i, entry in enumerate(standings, 1):
        entry["rank"] = i
        entry["is_me"] = entry["user_id"] == user.id
    _redact_season_cohort_peers(standings, user)

    return {
        "rounds": [{"id": r.id, "round_number": r.round_number} for r in scored_rounds],
        "standings": standings,
    }


@router.get("/leaderboard/room/{room_id}/template/{template_id}/cohort")
def template_cohort_leaderboard(
    room_id: str,
    template_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cumulative standings across all season instances in this room for one template
    (async runs). Rounds are keyed by round_number in per_round, not by round_id."""
    _ensure_member(db, user, room_id)
    template = (
        db.query(RoomSoloTemplateRow)
        .filter(
            RoomSoloTemplateRow.id == template_id,
            RoomSoloTemplateRow.room_id == room_id,
        )
        .first()
    )
    if not template:
        raise HTTPException(404, "Template not found in this room")

    seasons = (
        db.query(SeasonRow)
        .filter(SeasonRow.room_id == room_id, SeasonRow.source_template_id == template_id)
        .all()
    )
    if not seasons:
        return {
            "room_id": room_id,
            "template_id": template_id,
            "cohort": True,
            "rounds": [],
            "standings": [],
        }
    season_ids = [s.id for s in seasons]
    policy_pairs = (
        db.query(PolicyRow.user_id, SeasonRow.id)
        .select_from(PolicyRow)
        .join(RoundRow, PolicyRow.round_id == RoundRow.id)
        .join(SeasonRow, RoundRow.season_id == SeasonRow.id)
        .filter(SeasonRow.id.in_(season_ids))
        .distinct()
        .all()
    )
    u_to_sids: dict[str, set[str]] = defaultdict(set)
    for uid, sid in policy_pairs:
        u_to_sids[uid].add(sid)

    user_canonical_season: dict[str, str] = {}
    for uid, sids in u_to_sids.items():
        if not sids:
            continue
        season_rows = (
            db.query(SeasonRow).filter(SeasonRow.id.in_(sids)).all()
        )
        if not season_rows:
            continue
        best = max(
            season_rows,
            key=lambda s: (s.created_at or datetime.min, s.id),
        )
        user_canonical_season[uid] = best.id

    standings: list[dict] = []
    for uid, canon_season_id in user_canonical_season.items():
        prof_u = db.query(UserRow).filter(UserRow.id == uid).first()
        if not prof_u:
            continue
        scored_rounds = (
            db.query(RoundRow)
            .filter(
                RoundRow.season_id == canon_season_id,
                RoundRow.status == "scored",
            )
            .order_by(RoundRow.round_number)
            .all()
        )
        if not scored_rounds:
            continue
        rids = [r.id for r in scored_rounds]
        all_results = (
            db.query(ResultRow, PolicyRow, UserRow)
            .join(PolicyRow, ResultRow.policy_id == PolicyRow.id)
            .join(UserRow, PolicyRow.user_id == UserRow.id)
            .filter(ResultRow.round_id.in_(rids), UserRow.id == uid)
            .all()
        )
        if not all_results:
            continue
        per_round: dict = {}
        season_total = 0.0
        for result, _policy, _u2 in all_results:
            rnum = next(
                (sr.round_number for sr in scored_rounds if sr.id == result.round_id),
                0,
            )
            if rnum == 0:
                continue
            per_round[str(rnum)] = {
                "round_number": rnum,
                "profit": result.total_profit,
                "service_level": result.service_level,
            }
            season_total += result.total_profit
        standings.append(
            {
                "user_id": prof_u.id,
                "display_name": prof_u.display_name,
                "per_round": per_round,
                "season_total": season_total,
            }
        )

    standings = sorted(standings, key=lambda x: x["season_total"], reverse=True)
    for i, entry in enumerate(standings, 1):
        entry["rank"] = i
        entry["is_me"] = entry["user_id"] == user.id
    _redact_season_cohort_peers(standings, user)

    rdigits = [n for s in standings for n in s.get("per_round", {}).keys()]
    max_n = int(template.total_rounds)
    for r in rdigits:
        try:
            max_n = max(max_n, int(r))
        except ValueError:
            pass
    col_rounds = [{"round_number": n} for n in range(1, max_n + 1)]

    return {
        "room_id": room_id,
        "template_id": template_id,
        "template_name": template.name,
        "cohort": True,
        "rounds": col_rounds,
        "standings": standings,
    }
