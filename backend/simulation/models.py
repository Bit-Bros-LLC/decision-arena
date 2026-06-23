from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CostParams:
    holding_per_unit: float = 1.0
    stockout_penalty: float = 10.0
    ordering_fixed: float = 20.0
    per_unit_cost: float = 5.0
    selling_price: float = 15.0
    dual_source_enabled: bool = False
    dual_source_premium_per_unit: float = 2.0
    dual_source_rescue_pct: float = 1.0

    @classmethod
    def from_dict(cls, d: dict) -> CostParams:
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class BlackSwanEvent:
    event_type: str  # "supplier_failure"
    details: dict = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict | None) -> BlackSwanEvent | None:
        if d is None:
            return None
        return cls(event_type=d["type"], details={k: v for k, v in d.items() if k != "type"})


@dataclass
class DayScenario:
    day: int
    demand: int
    lead_time: int
    black_swan: BlackSwanEvent | None = None

    @classmethod
    def from_dict(cls, d: dict) -> DayScenario:
        return cls(
            day=d["day"],
            demand=d["demand"],
            lead_time=d["lead_time"],
            black_swan=BlackSwanEvent.from_dict(d.get("black_swan")),
        )


@dataclass
class PendingOrder:
    quantity: int
    arrival_day: int
    dual_sourced: bool = False


@dataclass
class Decision:
    order_quantity: int
    use_dual_source: bool


@dataclass
class SimState:
    """Mutable state passed through the simulation. Also the read-only view given to policies."""
    day: int = 0
    inventory: int = 0
    pending_orders: list[PendingOrder] = field(default_factory=list)
    cash: float = 0.0
    demand_history: list[int] = field(default_factory=list)
    lead_time_history: list[int] = field(default_factory=list)

    def to_policy_view(self) -> dict:
        """Flat dict that policy functions receive. Read-only snapshot."""
        return {
            "day": self.day,
            "inventory": self.inventory,
            "pending_orders": [
                {"quantity": o.quantity, "arrival_day": o.arrival_day}
                for o in self.pending_orders
            ],
            "inventory_position": self.inventory + sum(o.quantity for o in self.pending_orders),
            "cash": self.cash,
            "demand_history": list(self.demand_history),
            "lead_time_history": list(self.lead_time_history),
        }


@dataclass
class DailyRecord:
    day: int
    demand: int
    sold: int
    unfulfilled: int
    ordered: int
    inventory_start: int
    inventory_end: int
    revenue: float
    holding_cost: float
    stockout_cost: float
    order_cost: float
    dual_source_premium: float
    black_swan_event: str | None
    black_swan_cost: float
    used_dual_source: bool
    daily_profit: float

    def to_dict(self) -> dict:
        return {
            "day": self.day,
            "demand": self.demand,
            "sold": self.sold,
            "unfulfilled": self.unfulfilled,
            "ordered": self.ordered,
            "inventory_start": self.inventory_start,
            "inventory_end": self.inventory_end,
            "revenue": round(self.revenue, 2),
            "holding_cost": round(self.holding_cost, 2),
            "stockout_cost": round(self.stockout_cost, 2),
            "order_cost": round(self.order_cost, 2),
            "dual_source_premium": round(self.dual_source_premium, 2),
            "black_swan_event": self.black_swan_event,
            "black_swan_cost": round(self.black_swan_cost, 2),
            "used_dual_source": self.used_dual_source,
            "daily_profit": round(self.daily_profit, 2),
        }


@dataclass
class SimulationResult:
    total_profit: float
    service_level: float  # % of total demand fulfilled
    stockout_days: int
    total_demand: int
    total_sold: int
    dual_source_spend: float
    black_swan_hits: int
    black_swan_total_cost: float
    daily_log: list[DailyRecord] = field(default_factory=list)
    highlights: list[str] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_profit": round(self.total_profit, 2),
            "service_level": round(self.service_level, 4),
            "stockout_days": self.stockout_days,
            "total_demand": self.total_demand,
            "total_sold": self.total_sold,
            "dual_source_spend": round(self.dual_source_spend, 2),
            "black_swan_hits": self.black_swan_hits,
            "black_swan_total_cost": round(self.black_swan_total_cost, 2),
            "daily_log": [d.to_dict() for d in self.daily_log],
            "highlights": self.highlights,
            "errors": self.errors,
        }
