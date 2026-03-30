"""
UI policy templates. Each builder takes a config dict (from slider values)
and returns a callable: fn(state_view) -> Decision.
"""
from __future__ import annotations
import math
from .models import Decision


def _insurance_decision(state: dict, mode: str, threshold: float = 0.3) -> bool:
    if mode == "always":
        return True
    if mode == "never":
        return False
    # "conditional" - buy insurance when inventory is low relative to recent demand
    if not state["demand_history"]:
        return False
    avg_demand = sum(state["demand_history"][-7:]) / max(len(state["demand_history"][-7:]), 1)
    return state["inventory"] < avg_demand * threshold


# ---------------------------------------------------------------------------
# Template A: Order Up To (S)
# ---------------------------------------------------------------------------

def make_order_up_to(config: dict):
    """
    Each day: order enough to bring inventory_position up to target S.
    Config keys:
        target_level (int): the S value
        insurance_mode (str): "always" | "never" | "conditional"
    """
    target = int(config["target_level"])
    ins_mode = config.get("insurance_mode", "never")

    def policy_fn(state: dict) -> Decision:
        gap = target - state["inventory_position"]
        order_qty = max(0, gap)
        return Decision(
            order_quantity=order_qty,
            buy_insurance=_insurance_decision(state, ins_mode),
        )

    return policy_fn


# ---------------------------------------------------------------------------
# Template B: Service Level Target
# ---------------------------------------------------------------------------

def make_service_level(config: dict):
    """
    Target a fill-rate service level. Calculates safety stock from demand history.
    Config keys:
        target_service_level (float): e.g. 0.95
        lookback_days (int): how many days of history to use (default 14)
        insurance_mode (str): "always" | "never" | "conditional"
    """
    target_sl = float(config["target_service_level"])
    lookback = int(config.get("lookback_days", 14))
    ins_mode = config.get("insurance_mode", "never")

    z_table = {
        0.85: 1.04,
        0.90: 1.28,
        0.95: 1.65,
        0.97: 1.88,
        0.99: 2.33,
        0.99999: 4.26,  # ~Φ⁻¹(0.99999) for normal safety factor
    }

    def _closest_z(sl: float) -> float:
        if sl in z_table:
            return z_table[sl]
        closest = min(z_table.keys(), key=lambda k: abs(k - sl))
        return z_table[closest]

    def policy_fn(state: dict) -> Decision:
        history = state["demand_history"][-lookback:]
        if len(history) < 3:
            return Decision(order_quantity=50, buy_insurance=_insurance_decision(state, ins_mode))

        avg_demand = sum(history) / len(history)
        variance = sum((d - avg_demand) ** 2 for d in history) / len(history)
        std_demand = math.sqrt(variance) if variance > 0 else 1.0

        avg_lt = 3.0
        if state["lead_time_history"]:
            recent_lt = state["lead_time_history"][-lookback:]
            avg_lt = sum(recent_lt) / len(recent_lt)

        z = _closest_z(target_sl)
        safety_stock = z * std_demand * math.sqrt(avg_lt)
        reorder_point = avg_demand * avg_lt + safety_stock
        order_up_to = reorder_point + avg_demand * avg_lt

        if state["inventory_position"] <= reorder_point:
            order_qty = max(0, int(order_up_to - state["inventory_position"]))
        else:
            order_qty = 0

        return Decision(
            order_quantity=order_qty,
            buy_insurance=_insurance_decision(state, ins_mode),
        )

    return policy_fn


# ---------------------------------------------------------------------------
# Template C: (s, Q) Reorder Point
# ---------------------------------------------------------------------------

def make_reorder_point(config: dict):
    """
    When inventory_position drops to or below s, order exactly Q units.
    Config keys:
        reorder_point (int): s - the threshold
        order_quantity (int): Q - fixed order size
        insurance_mode (str): "always" | "never" | "conditional"
    """
    s = int(config["reorder_point"])
    q = int(config["order_quantity"])
    ins_mode = config.get("insurance_mode", "never")

    def policy_fn(state: dict) -> Decision:
        if state["inventory_position"] <= s:
            order_qty = q
        else:
            order_qty = 0

        return Decision(
            order_quantity=order_qty,
            buy_insurance=_insurance_decision(state, ins_mode),
        )

    return policy_fn


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

POLICY_BUILDERS = {
    "order_up_to": make_order_up_to,
    "service_level": make_service_level,
    "reorder_point": make_reorder_point,
}


def build_policy_fn(policy_type: str, config: dict):
    """Look up the template and return a callable policy function."""
    builder = POLICY_BUILDERS.get(policy_type)
    if builder is None:
        raise ValueError(f"Unknown policy type: {policy_type}. Options: {list(POLICY_BUILDERS)}")
    return builder(config)
