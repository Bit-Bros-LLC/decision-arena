"""
Core simulation engine. One function to rule them all.
Powers both backtesting (against historical data) and scoring (against actuals).
"""
from __future__ import annotations
from typing import Callable

from .models import (
    CostParams,
    DayScenario,
    Decision,
    DailyRecord,
    PendingOrder,
    SimState,
    SimulationResult,
)
from .highlights import generate_highlights


def _apply_supplier_failure(
    details: dict,
    state: SimState,
    per_unit_cost: float,
    rescue_pct: float,
) -> tuple[float, str]:
    """Apply supplier failure damage and return (cost, description)."""
    duration = details.get("duration_days", 3)
    cutoff = state.day + duration

    cancelled_count = 0
    rescued_lines: list[str] = []
    total_damage = 0.0
    kept: list[PendingOrder] = []

    for order in state.pending_orders:
        if order.arrival_day > cutoff:
            kept.append(order)
            continue

        if order.dual_sourced:
            rescued_qty = int(order.quantity * rescue_pct)
            lost_qty = order.quantity - rescued_qty
            if lost_qty > 0:
                total_damage += lost_qty * per_unit_cost
            if rescued_qty > 0:
                kept.append(
                    PendingOrder(
                        quantity=rescued_qty,
                        arrival_day=order.arrival_day,
                        dual_sourced=True,
                    )
                )
                if lost_qty > 0:
                    rescued_lines.append(
                        f"dual-source order: {rescued_qty} of {order.quantity} units rescued"
                    )
            else:
                cancelled_count += 1
        else:
            cancelled_count += 1
            total_damage += order.quantity * per_unit_cost

    state.pending_orders = kept

    desc = f"Supplier failure ({duration} days). {cancelled_count} orders fully lost."
    if rescued_lines:
        desc += " " + "; ".join(rescued_lines) + "."
    if total_damage > 0:
        desc += f" Damage: ${total_damage:.0f}."

    return total_damage, desc


def _apply_black_swan(
    event_type: str,
    details: dict,
    state: SimState,
    costs: CostParams,
) -> tuple[float, str]:
    """Apply black swan damage and return (cost, description)."""
    if event_type == "supplier_failure":
        return _apply_supplier_failure(
            details,
            state,
            costs.per_unit_cost,
            costs.dual_source_rescue_pct,
        )

    return 0.0, f"Unknown or legacy event (no effect): {event_type}"


def simulate_day(
    state: SimState,
    decision: Decision,
    day_scenario: DayScenario,
    costs: CostParams,
) -> DailyRecord:
    """Execute one simulated day. Mutates state in place, returns the record."""

    inventory_start = state.inventory

    # 1. Receive arriving orders
    arrived = [o for o in state.pending_orders if o.arrival_day <= state.day]
    for order in arrived:
        state.inventory += order.quantity
    state.pending_orders = [o for o in state.pending_orders if o.arrival_day > state.day]

    # 2. Black swan (supplier failure only)
    swan_cost = 0.0
    swan_event_str = None
    if day_scenario.black_swan is not None:
        swan_cost, swan_event_str = _apply_black_swan(
            day_scenario.black_swan.event_type,
            day_scenario.black_swan.details,
            state,
            costs,
        )

    # 3. Sell
    sold = min(day_scenario.demand, max(state.inventory, 0))
    unfulfilled = day_scenario.demand - sold
    state.inventory -= sold

    # 4. Costs
    revenue = sold * costs.selling_price
    holding_cost = max(state.inventory, 0) * costs.holding_per_unit
    stockout_cost = unfulfilled * costs.stockout_penalty

    use_dual = costs.dual_source_enabled and decision.use_dual_source
    dual_source_premium = 0.0
    order_cost = 0.0
    if decision.order_quantity > 0:
        unit_cost = costs.per_unit_cost
        if use_dual:
            unit_cost += costs.dual_source_premium_per_unit
            dual_source_premium = costs.dual_source_premium_per_unit * decision.order_quantity
        order_cost = costs.ordering_fixed + (decision.order_quantity * unit_cost)
        state.pending_orders.append(
            PendingOrder(
                quantity=decision.order_quantity,
                arrival_day=state.day + day_scenario.lead_time,
                dual_sourced=use_dual,
            )
        )

    daily_profit = revenue - holding_cost - stockout_cost - order_cost - swan_cost

    state.cash += daily_profit
    state.demand_history.append(day_scenario.demand)
    state.lead_time_history.append(day_scenario.lead_time)

    return DailyRecord(
        day=state.day,
        demand=day_scenario.demand,
        sold=sold,
        unfulfilled=unfulfilled,
        ordered=decision.order_quantity,
        inventory_start=inventory_start,
        inventory_end=state.inventory,
        revenue=revenue,
        holding_cost=holding_cost,
        stockout_cost=stockout_cost,
        order_cost=order_cost,
        dual_source_premium=dual_source_premium,
        black_swan_event=swan_event_str,
        black_swan_cost=swan_cost,
        used_dual_source=use_dual,
        daily_profit=daily_profit,
    )


def run_simulation(
    policy_fn: Callable[[dict], Decision],
    scenario_days: list[dict],
    costs: dict | CostParams,
    starting_inventory: int = 100,
    demand_history_seed: list[int] | None = None,
    lead_time_history_seed: list[int] | None = None,
) -> SimulationResult:
    """
    Run a full simulation of a policy against a sequence of days.

    Args:
        policy_fn: callable that takes a state dict and returns a Decision
        scenario_days: list of day dicts with keys: day, demand, lead_time, black_swan
        costs: cost parameters (dict or CostParams)
        starting_inventory: units on hand at day 0
        demand_history_seed: optional prior demand observations (for service level calc)
        lead_time_history_seed: optional prior lead time observations

    Returns:
        SimulationResult with full metrics and daily log
    """
    if isinstance(costs, dict):
        costs = CostParams.from_dict(costs)

    scenarios = [DayScenario.from_dict(d) for d in scenario_days]

    state = SimState(
        inventory=starting_inventory,
        demand_history=list(demand_history_seed or []),
        lead_time_history=list(lead_time_history_seed or []),
    )

    daily_log: list[DailyRecord] = []
    errors: list[dict] = []

    for day_scenario in scenarios:
        state.day = day_scenario.day

        # Get policy decision (with error handling)
        state_view = state.to_policy_view()
        try:
            decision = policy_fn(state_view)
            if not isinstance(decision, Decision):
                raise TypeError(f"Policy must return a Decision, got {type(decision)}")
            decision.order_quantity = max(0, int(decision.order_quantity))
        except Exception as e:
            decision = Decision(order_quantity=0, use_dual_source=False)
            errors.append({"day": day_scenario.day, "error": str(e), "used_default": True})

        record = simulate_day(state, decision, day_scenario, costs)
        daily_log.append(record)

    # Compute summary metrics
    total_demand = sum(r.demand for r in daily_log)
    total_sold = sum(r.sold for r in daily_log)
    service_level = total_sold / total_demand if total_demand > 0 else 1.0
    stockout_days = sum(1 for r in daily_log if r.unfulfilled > 0)
    dual_source_spend = sum(r.dual_source_premium for r in daily_log)
    black_swan_hits = sum(1 for r in daily_log if r.black_swan_event is not None)
    black_swan_total_cost = sum(r.black_swan_cost for r in daily_log)

    highlights = generate_highlights(daily_log)

    return SimulationResult(
        total_profit=state.cash,
        service_level=service_level,
        stockout_days=stockout_days,
        total_demand=total_demand,
        total_sold=total_sold,
        dual_source_spend=dual_source_spend,
        black_swan_hits=black_swan_hits,
        black_swan_total_cost=black_swan_total_cost,
        daily_log=daily_log,
        highlights=highlights,
        errors=errors,
    )
