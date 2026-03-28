from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import (
    UserRow, RoomRow, RoomMemberRow, RoundRow,
    PolicyRow, ResultRow, get_db,
)

router = APIRouter(tags=["results"])


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
        raise HTTPException(404, "Round has not been scored yet")

    return {
        "policy_type": policy.policy_type,
        "policy_config": policy.config,
        "total_profit": result.total_profit,
        "service_level": result.service_level,
        "stockout_days": result.stockout_days,
        "insurance_spend": result.insurance_spend,
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
        raise HTTPException(404, "Round not found")
    if rnd.status != "scored":
        raise HTTPException(400, "Round has not been scored yet")

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
            "insurance_spend": result.insurance_spend,
            "black_swan_hits": result.black_swan_hits,
            "daily_profits": daily_profits,
            "is_me": u.id == user.id,
        })

    return leaderboard


@router.get("/leaderboard/season/{room_id}")
def season_leaderboard(
    room_id: str,
    user: UserRow = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cumulative leaderboard across all scored rounds in a room."""
    member = (
        db.query(RoomMemberRow)
        .filter(RoomMemberRow.user_id == user.id, RoomMemberRow.room_id == room_id)
        .first()
    )
    if not member:
        raise HTTPException(403, "Not a member of this room")

    scored_rounds = (
        db.query(RoundRow)
        .filter(RoundRow.room_id == room_id, RoundRow.status == "scored")
        .order_by(RoundRow.round_number)
        .all()
    )
    round_ids = [r.id for r in scored_rounds]

    if not round_ids:
        return {"rounds": [], "standings": []}

    # Get all results for this room's scored rounds
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

    return {
        "rounds": [{"id": r.id, "round_number": r.round_number} for r in scored_rounds],
        "standings": standings,
    }
