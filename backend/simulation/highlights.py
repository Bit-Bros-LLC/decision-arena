"""Auto-generate human-readable key moments from a simulation's daily log."""
from __future__ import annotations
from .models import DailyRecord


def _stockout_msg(start: int, end: int, length: int, total_missed: int) -> str:
    if length == 1:
        return f"Day {start}: Stockout. {total_missed} units unfulfilled."
    return f"Days {start}-{end}: Stockout streak ({length} days). {total_missed} units unfulfilled."


def generate_highlights(daily_log: list[DailyRecord]) -> list[str]:
    highlights: list[str] = []

    # Track stockout streaks
    streak_start = None
    for rec in daily_log:
        if rec.unfulfilled > 0 and streak_start is None:
            streak_start = rec.day
        elif rec.unfulfilled == 0 and streak_start is not None:
            streak_end = rec.day - 1
            length = streak_end - streak_start + 1
            total_missed = sum(
                r.unfulfilled for r in daily_log
                if streak_start <= r.day <= streak_end
            )
            highlights.append(_stockout_msg(streak_start, streak_end, length, total_missed))
            streak_start = None
    if streak_start is not None:
        streak_end = daily_log[-1].day
        length = streak_end - streak_start + 1
        total_missed = sum(
            r.unfulfilled for r in daily_log
            if streak_start <= r.day <= streak_end
        )
        highlights.append(_stockout_msg(streak_start, streak_end, length, total_missed))

    # Black swan events
    for rec in daily_log:
        if rec.black_swan_event:
            highlights.append(f"Day {rec.day}: {rec.black_swan_event}")

    # Worst single day
    if daily_log:
        worst = min(daily_log, key=lambda r: r.daily_profit)
        if worst.daily_profit < 0:
            highlights.append(
                f"Day {worst.day}: Worst day (${worst.daily_profit:,.0f}). "
                f"Demand={worst.demand}, Sold={worst.sold}, Inventory={worst.inventory_end}."
            )

    # Best single day
    if daily_log:
        best = max(daily_log, key=lambda r: r.daily_profit)
        if best.daily_profit > 0:
            highlights.append(
                f"Day {best.day}: Best day (+${best.daily_profit:,.0f}). "
                f"Demand={best.demand}, Sold={best.sold}."
            )

    # High holding cost warning
    total_holding = sum(r.holding_cost for r in daily_log)
    total_revenue = sum(r.revenue for r in daily_log)
    if total_revenue > 0 and total_holding / total_revenue > 0.2:
        pct = total_holding / total_revenue * 100
        highlights.append(
            f"Holding costs consumed {pct:.0f}% of revenue (${total_holding:,.0f}). "
            f"Consider lowering target inventory."
        )

    # Dual-source spend vs supplier failures
    total_dual_source = sum(r.dual_source_premium for r in daily_log)
    total_swan_cost = sum(r.black_swan_cost for r in daily_log)
    dual_days = sum(1 for r in daily_log if r.used_dual_source)
    supplier_failures = sum(
        1 for r in daily_log
        if r.black_swan_event and "Supplier failure" in r.black_swan_event
    )
    if dual_days > 0 and supplier_failures == 0 and total_dual_source > 100:
        highlights.append(
            f"Paid ${total_dual_source:,.0f} in dual-source premiums with no supplier failures. "
            f"Dual sourcing may have been unnecessary this round."
        )
    elif dual_days == 0 and supplier_failures > 0 and total_swan_cost > 0:
        highlights.append(
            f"{supplier_failures} supplier failure(s) caused ${total_swan_cost:,.0f} in damage. "
            f"Dual sourcing could have mitigated lost orders."
        )

    return highlights
