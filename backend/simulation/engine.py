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


def _apply_black_swan(
    event_type: str,
    details: dict,
    state: SimState,
    has_insurance: bool,
    coverage_pct: float,
) -> tuple[float, str]:
    """Apply black swan damage and return (cost, description)."""

    if event_type == "supplier_failure":
        duration = details.get("duration_days", 3)
        # Cancel all pending orders that would arrive during the disruption
        cancelled = []
        kept = []
        for order in state.pending_orders:
            if order.arrival_day <= state.day + duration:
                cancelled.append(order)
            else:
                kept.append(order)
        state.pending_orders = kept
        raw_damage = sum(o.quantity for o in cancelled) * 5.0  # lost order value
        desc = f"Supplier failure ({duration} days). {len(cancelled)} orders cancelled."

    elif event_type == "demand_spike":
        # Demand is already set high by the professor in the scenario data.
        # The "damage" is the extra stockout cost that naturally occurs.
        # We just flag it as a notable event; no extra artificial cost.
        return 0.0, f"Demand spike (multiplier in scenario data)"

    elif event_type == "warehouse_damage":
        loss_pct = details.get("inventory_loss_pct", 0.5)
        units_lost = int(state.inventory * loss_pct)
        state.inventory -= units_lost
        raw_damage = units_lost * 10.0  # replacement value
        desc = f"Warehouse damage. Lost {units_lost} units ({loss_pct:.0%} of inventory)."

    elif event_type == "cost_shock":
        multiplier = details.get("cost_multiplier", 2.0)
        # One-time cost hit representing price spikes on existing orders
        raw_damage = 500.0 * multiplier
        desc = f"Cost shock ({multiplier}x). Emergency procurement surcharge."

    else:
        return 0.0, f"Unknown event: {event_type}"

    if has_insurance:
        actual_damage = raw_damage * (1.0 - coverage_pct)
        desc += f" Insurance covered ${raw_damage * coverage_pct:.0f} of ${raw_damage:.0f}."
    else:
        actual_damage = raw_damage
        desc += f" NO INSURANCE. Full damage: ${raw_damage:.0f}."

    return actual_damage, desc


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

    # 2. Black swan
    swan_cost = 0.0
    swan_event_str = None
    if day_scenario.black_swan is not None:
        swan_cost, swan_event_str = _apply_black_swan(
            day_scenario.black_swan.event_type,
            day_scenario.black_swan.details,
            state,
            state.has_insurance,
            costs.insurance_coverage_pct,
        )

    # 3. Sell
    sold = min(day_scenario.demand, max(state.inventory, 0))
    unfulfilled = day_scenario.demand - sold
    state.inventory -= sold

    # 4. Costs
    revenue = sold * costs.selling_price
    holding_cost = max(state.inventory, 0) * costs.holding_per_unit
    stockout_cost = unfulfilled * costs.stockout_penalty
    insurance_cost = costs.insurance_premium if decision.buy_insurance else 0.0

    order_cost = 0.0
    if decision.order_quantity > 0:
        order_cost = costs.ordering_fixed + (decision.order_quantity * costs.per_unit_cost)
        state.pending_orders.append(
            PendingOrder(
                quantity=decision.order_quantity,
                arrival_day=state.day + day_scenario.lead_time,
            )
        )

    daily_profit = revenue - holding_cost - stockout_cost - order_cost - insurance_cost - swan_cost
    state.cash += daily_profit
    state.has_insurance = decision.buy_insurance
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
        insurance_cost=insurance_cost,
        black_swan_event=swan_event_str,
        black_swan_cost=swan_cost,
        was_insured=decision.buy_insurance,
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
            decision = Decision(order_quantity=0, buy_insurance=False)
            errors.append({"day": day_scenario.day, "error": str(e), "used_default": True})

        record = simulate_day(state, decision, day_scenario, costs)
        daily_log.append(record)

    # Compute summary metrics
    total_demand = sum(r.demand for r in daily_log)
    total_sold = sum(r.sold for r in daily_log)
    service_level = total_sold / total_demand if total_demand > 0 else 1.0
    stockout_days = sum(1 for r in daily_log if r.unfulfilled > 0)
    insurance_spend = sum(r.insurance_cost for r in daily_log)
    black_swan_hits = sum(1 for r in daily_log if r.black_swan_event is not None)
    black_swan_total_cost = sum(r.black_swan_cost for r in daily_log)

    highlights = generate_highlights(daily_log)

    return SimulationResult(
        total_profit=state.cash,
        service_level=service_level,
        stockout_days=stockout_days,
        total_demand=total_demand,
        total_sold=total_sold,
        insurance_spend=insurance_spend,
        black_swan_hits=black_swan_hits,
        black_swan_total_cost=black_swan_total_cost,
        daily_log=daily_log,
        highlights=highlights,
        errors=errors,
    )
