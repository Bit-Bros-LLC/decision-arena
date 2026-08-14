from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    UserRow, RoundRow, SeasonRow,
    PolicyRow, ResultRow, get_db,
)
from routes.seasons import _ensure_season_access

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
                "season_stockout_days": 0,
                "season_dual_source_spend": 0.0,
                "_sold": 0,
                "_demand": 0,
            }
        user_data[u.id]["rounds"][result.round_id] = {
            "round_number": next(r.round_number for r in scored_rounds if r.id == result.round_id),
            "profit": result.total_profit,
            "service_level": result.service_level,
            "stockout_days": result.stockout_days,
            "dual_source_spend": result.dual_source_spend,
        }
        user_data[u.id]["season_total"] += result.total_profit
        user_data[u.id]["rounds_played"] += 1
        user_data[u.id]["season_stockout_days"] += int(result.stockout_days or 0)
        user_data[u.id]["season_dual_source_spend"] += float(result.dual_source_spend or 0)
        # Demand-weighted fill rate across the fiscal year (not a plain average of monthly SLs).
        daily = result.daily_log or []
        user_data[u.id]["_sold"] += sum(int(d.get("sold") or 0) for d in daily)
        user_data[u.id]["_demand"] += sum(int(d.get("demand") or 0) for d in daily)

    # Sort by season total, assign ranks
    standings = sorted(user_data.values(), key=lambda x: x["season_total"], reverse=True)
    for i, entry in enumerate(standings, 1):
        demand = entry.pop("_demand", 0)
        sold = entry.pop("_sold", 0)
        if demand > 0:
            entry["season_service_level"] = round(sold / demand, 4)
        else:
            # Fallback: mean of monthly service levels when daily_log is unavailable
            sls = [c["service_level"] for c in entry["rounds"].values() if c.get("service_level") is not None]
            entry["season_service_level"] = round(sum(sls) / len(sls), 4) if sls else 0.0
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
    raise HTTPException(
        410,
        "Case study cohort standings have been removed. Use fiscal year or practice run standings.",
    )
