"""
Standalone test: run all 3 policy templates against a sample 30-day scenario.
Usage: python -m simulation.test_engine  (from the backend/ directory)
"""
from .engine import run_simulation
from .policies import build_policy_fn


# --- Sample 30-day scenario (professor would enter this) ---
SAMPLE_SCENARIO = [
    {"day": 1,  "demand": 95,  "lead_time": 3, "black_swan": None},
    {"day": 2,  "demand": 103, "lead_time": 2, "black_swan": None},
    {"day": 3,  "demand": 88,  "lead_time": 3, "black_swan": None},
    {"day": 4,  "demand": 110, "lead_time": 2, "black_swan": None},
    {"day": 5,  "demand": 97,  "lead_time": 3, "black_swan": None},
    {"day": 6,  "demand": 115, "lead_time": 2, "black_swan": None},
    {"day": 7,  "demand": 105, "lead_time": 4, "black_swan": None},
    {"day": 8,  "demand": 92,  "lead_time": 2, "black_swan": None},
    {"day": 9,  "demand": 130, "lead_time": 3, "black_swan": None},
    {"day": 10, "demand": 140, "lead_time": 2, "black_swan": None},
    {"day": 11, "demand": 125, "lead_time": 3, "black_swan": None},
    {"day": 12, "demand": 108, "lead_time": 2, "black_swan": None},
    {"day": 13, "demand": 95,  "lead_time": 3, "black_swan": None},
    {"day": 14, "demand": 102, "lead_time": 5, "black_swan": {"type": "supplier_failure", "duration_days": 3}},
    {"day": 15, "demand": 118, "lead_time": 7, "black_swan": None},
    {"day": 16, "demand": 135, "lead_time": 6, "black_swan": None},
    {"day": 17, "demand": 112, "lead_time": 3, "black_swan": None},
    {"day": 18, "demand": 98,  "lead_time": 2, "black_swan": None},
    {"day": 19, "demand": 105, "lead_time": 2, "black_swan": None},
    {"day": 20, "demand": 110, "lead_time": 3, "black_swan": None},
    {"day": 21, "demand": 88,  "lead_time": 2, "black_swan": None},
    {"day": 22, "demand": 200, "lead_time": 2, "black_swan": None},  # demand spike (no black_swan flag, just high demand)
    {"day": 23, "demand": 180, "lead_time": 3, "black_swan": None},
    {"day": 24, "demand": 120, "lead_time": 2, "black_swan": None},
    {"day": 25, "demand": 95,  "lead_time": 2, "black_swan": None},
    {"day": 26, "demand": 100, "lead_time": 3, "black_swan": None},
    {"day": 27, "demand": 108, "lead_time": 2, "black_swan": None},
    {"day": 28, "demand": 115, "lead_time": 2, "black_swan": {"type": "warehouse_damage", "inventory_loss_pct": 0.4}},
    {"day": 29, "demand": 90,  "lead_time": 3, "black_swan": None},
    {"day": 30, "demand": 102, "lead_time": 2, "black_swan": None},
]

COSTS = {
    "holding_per_unit": 1.0,
    "stockout_penalty": 10.0,
    "ordering_fixed": 20.0,
    "per_unit_cost": 5.0,
    "selling_price": 15.0,
    "insurance_premium": 8.0,
    "insurance_coverage_pct": 0.80,
}

# Some historical demand for policies that need demand_history to bootstrap
HISTORICAL_DEMAND = [100, 95, 110, 88, 105, 112, 98, 103, 107, 92, 115, 99, 108, 101]
HISTORICAL_LEAD_TIMES = [2, 3, 2, 3, 2, 4, 2, 3, 2, 3, 2, 3, 2, 3]


POLICIES_TO_TEST = [
    ("order_up_to", {"target_level": 200, "insurance_mode": "never"}, "Order Up To (S=200, no insurance)"),
    ("order_up_to", {"target_level": 250, "insurance_mode": "always"}, "Order Up To (S=250, always insured)"),
    ("service_level", {"target_service_level": 0.95, "lookback_days": 14, "insurance_mode": "conditional"}, "Service Level (95%, conditional insurance)"),
    ("reorder_point", {"reorder_point": 80, "order_quantity": 150, "insurance_mode": "never"}, "Reorder Point (s=80, Q=150, no insurance)"),
    ("reorder_point", {"reorder_point": 120, "order_quantity": 200, "insurance_mode": "always"}, "Reorder Point (s=120, Q=200, always insured)"),
]


def print_daily_log(result, max_days=10):
    """Print first N days of the daily log as a table."""
    print(f"  {'Day':>4} {'Demand':>7} {'Sold':>5} {'Miss':>5} {'Order':>6} "
          f"{'Inv.Start':>10} {'Inv.End':>8} {'P&L':>10} {'Event'}")
    print(f"  {'---':>4} {'------':>7} {'----':>5} {'----':>5} {'-----':>6} "
          f"{'---------':>10} {'-------':>8} {'---':>10} {'-----'}")
    for rec in result.daily_log[:max_days]:
        event = rec.black_swan_event[:30] + "..." if rec.black_swan_event and len(rec.black_swan_event) > 30 else (rec.black_swan_event or "")
        print(f"  {rec.day:>4} {rec.demand:>7} {rec.sold:>5} {rec.unfulfilled:>5} {rec.ordered:>6} "
              f"{rec.inventory_start:>10} {rec.inventory_end:>8} {rec.daily_profit:>10,.0f} {event}")
    if len(result.daily_log) > max_days:
        print(f"  ... ({len(result.daily_log) - max_days} more days)")


def main():
    print("=" * 80)
    print("DECISION ARENA - Simulation Engine Test")
    print("=" * 80)
    print(f"Scenario: 30 days, starting inventory: 100")
    print(f"Black swans: Day 14 (supplier failure), Day 28 (warehouse damage)")
    print(f"Demand spike: Days 22-23 (200, 180)")
    print()

    for policy_type, config, label in POLICIES_TO_TEST:
        print("-" * 80)
        print(f"POLICY: {label}")
        print("-" * 80)

        policy_fn = build_policy_fn(policy_type, config)

        result = run_simulation(
            policy_fn=policy_fn,
            scenario_days=SAMPLE_SCENARIO,
            costs=COSTS,
            starting_inventory=100,
            demand_history_seed=HISTORICAL_DEMAND,
            lead_time_history_seed=HISTORICAL_LEAD_TIMES,
        )

        print(f"\n  RESULTS:")
        print(f"    Total Profit:     ${result.total_profit:>10,.2f}")
        print(f"    Service Level:     {result.service_level:>9.1%}")
        print(f"    Stockout Days:     {result.stockout_days:>9} / {len(result.daily_log)}")
        print(f"    Total Demand:      {result.total_demand:>9,}")
        print(f"    Total Sold:        {result.total_sold:>9,}")
        print(f"    Insurance Spend:  ${result.insurance_spend:>10,.2f}")
        print(f"    Black Swan Hits:   {result.black_swan_hits:>9}")
        print(f"    Black Swan Cost:  ${result.black_swan_total_cost:>10,.2f}")

        print(f"\n  DAILY LOG (first 15 days):")
        print_daily_log(result, max_days=15)

        if result.highlights:
            print(f"\n  KEY MOMENTS:")
            for h in result.highlights:
                print(f"    • {h}")

        if result.errors:
            print(f"\n  ERRORS:")
            for e in result.errors:
                print(f"    ⚠ Day {e['day']}: {e['error']}")

        print()

    # Leaderboard summary
    print("=" * 80)
    print("LEADERBOARD")
    print("=" * 80)
    results_list = []
    for policy_type, config, label in POLICIES_TO_TEST:
        policy_fn = build_policy_fn(policy_type, config)
        result = run_simulation(
            policy_fn=policy_fn,
            scenario_days=SAMPLE_SCENARIO,
            costs=COSTS,
            starting_inventory=100,
            demand_history_seed=HISTORICAL_DEMAND,
            lead_time_history_seed=HISTORICAL_LEAD_TIMES,
        )
        results_list.append((label, result))

    results_list.sort(key=lambda x: x[1].total_profit, reverse=True)
    print(f"\n  {'Rank':>4}  {'Policy':<45} {'Profit':>10} {'SvcLvl':>7} {'Stockouts':>9}")
    print(f"  {'----':>4}  {'------':<45} {'------':>10} {'------':>7} {'---------':>9}")
    for i, (label, res) in enumerate(results_list, 1):
        print(f"  {i:>4}  {label:<45} ${res.total_profit:>9,.0f} {res.service_level:>6.1%} {res.stockout_days:>9}")

    print()


if __name__ == "__main__":
    main()
