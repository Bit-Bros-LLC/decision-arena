"""Authored narrative "story" packages.

A story package is a fully pre-built season: it bundles the mechanical config a
professor would otherwise pick by hand (rounds, contract updates, duration,
lead-in, starting inventory, costs) together with a hand-authored, deterministic
demand timeline and a narrative + timed "news" hints rendered to students.

Unlike the algorithmic presets in ``season_scenarios.py``, a story's timeline is
frozen and curated so that the events students read about in the news line up
*exactly* with what happens in the simulated demand (e.g. a supplier storm in
the news is a real burst of ``supplier_failure`` days that month).

Each timeline is shape::

    { "leadin": [leadin_days day-dicts], "timeline": [total_rounds * round_duration_days day-dicts] }

where each day matches the ``DayScenario.from_dict`` contract in
``simulation.models`` (``day``, ``demand``, ``lead_time``, optional
``black_swan``). Generation is deterministic given the story's fixed seed.
"""

from __future__ import annotations

import random
from typing import Callable, Optional

DEFAULT_COSTS = {
    "holding_per_unit": 1,
    "stockout_penalty": 10,
    "ordering_fixed": 20,
    "per_unit_cost": 5,
    "selling_price": 15,
    "dual_source_enabled": False,
    "dual_source_premium_per_unit": 2,
    "dual_source_rescue_pct": 1,
}

ROUND_DURATION_DAYS = 30
LEADIN_DAYS = 60
TOTAL_ROUNDS = 6


# ---------------------------------------------------------------------------
# Timeline builder helpers (authored, deterministic via a seeded RNG)
# ---------------------------------------------------------------------------


def _clamp(d: float) -> int:
    return max(0, round(d))


def _lt(rng: random.Random, lo: int = 1, hi: int = 3) -> int:
    return rng.randint(lo, hi)


def flat(rng: random.Random, n: int, demand: float, noise: float = 8.0) -> list[dict]:
    """A run of ``n`` calm days oscillating gently around ``demand``."""
    out = []
    for _ in range(n):
        d = demand + rng.uniform(-noise, noise)
        out.append({"demand": _clamp(d), "lead_time": _lt(rng), "black_swan": None})
    return out


def ramp(rng: random.Random, n: int, start: float, end: float, noise: float = 8.0) -> list[dict]:
    """A run of ``n`` days ramping linearly from ``start`` to ``end``."""
    out = []
    for i in range(n):
        frac = i / max(1, n - 1)
        d = start + (end - start) * frac + rng.uniform(-noise, noise)
        out.append({"demand": _clamp(d), "lead_time": _lt(rng), "black_swan": None})
    return out


def spike(
    rng: random.Random,
    n: int,
    base: float,
    peak: float,
    peak_at: float = 0.5,
    width: float = 0.25,
    noise: float = 8.0,
) -> list[dict]:
    """``n`` days around ``base`` with a smooth bump peaking at ``peak``.

    ``peak_at`` and ``width`` are fractions of the segment (triangular bump).
    """
    out = []
    center = peak_at * (n - 1)
    half = max(1.0, width * n)
    for i in range(n):
        dist = abs(i - center)
        bump = max(0.0, 1.0 - dist / half)
        d = base + (peak - base) * bump + rng.uniform(-noise, noise)
        out.append({"demand": _clamp(d), "lead_time": _lt(rng), "black_swan": None})
    return out


def storm(
    rng: random.Random,
    n: int,
    demand: float,
    noise: float = 12.0,
    density: float = 0.28,
    min_gap_days: int = 2,
    note: str = "supplier storm",
) -> list[dict]:
    """``n`` days of (possibly elevated) demand peppered with dense
    ``supplier_failure`` events, spaced at least ``min_gap_days`` apart."""
    out = []
    last_swan = -(min_gap_days + 1)
    target_hits = max(1, round(n * density))
    hits = 0
    for i in range(n):
        swan = None
        gap_ok = (i - last_swan) > min_gap_days
        remaining = n - i
        need_more = (target_hits - hits) >= remaining
        if gap_ok and (need_more or rng.random() < density):
            swan = {"type": "supplier_failure", "note": note}
            last_swan = i
            hits += 1
        d = demand + rng.uniform(-noise, noise)
        out.append({"demand": _clamp(d), "lead_time": _lt(rng, 2, 4), "black_swan": swan})
    return out


def _numbered(days: list[dict]) -> list[dict]:
    return [{**d, "day": i + 1} for i, d in enumerate(days)]


# ---------------------------------------------------------------------------
# Story 1 — The Great Supplier Meltdown
# ---------------------------------------------------------------------------


def _build_supplier_meltdown() -> dict:
    rng = random.Random(101)
    leadin = flat(rng, LEADIN_DAYS, 80, noise=7)
    timeline: list[dict] = []
    # R1: calm baseline
    timeline += flat(rng, 30, 80, noise=8)
    # R2: viral product launch -> demand surges and stays elevated
    timeline += ramp(rng, 30, 85, 130, noise=10)
    # R3: storm month one (demand still elevated, dense supplier failures)
    timeline += storm(rng, 30, 125, noise=14, density=0.30, note="port congestion")
    # R4: storm month two (the second consecutive disrupted month)
    timeline += storm(rng, 30, 120, noise=14, density=0.34, note="force majeure")
    # R5: supply reopening, demand cooling
    timeline += ramp(rng, 30, 115, 95, noise=10)
    # R6: back to baseline
    timeline += flat(rng, 30, 82, noise=8)
    return {"leadin": _numbered(leadin), "timeline": _numbered(timeline)}


# ---------------------------------------------------------------------------
# Story 2 — The Holiday Demand Rush
# ---------------------------------------------------------------------------


def _build_holiday_rush() -> dict:
    rng = random.Random(202)
    leadin = flat(rng, LEADIN_DAYS, 70, noise=6)
    timeline: list[dict] = []
    # R1: calm baseline
    timeline += flat(rng, 30, 70, noise=7)
    # R2: flash marketing campaign mid-month
    timeline += spike(rng, 30, 72, 120, peak_at=0.5, width=0.3, noise=8)
    # R3: gradual build toward the holidays
    timeline += ramp(rng, 30, 80, 110, noise=8)
    # R4: holiday peak
    timeline += spike(rng, 30, 110, 165, peak_at=0.55, width=0.45, noise=10)
    # R5: post-holiday slump with mild volatility
    timeline += flat(rng, 30, 80, noise=16)
    # R6: settle back to baseline
    timeline += flat(rng, 30, 70, noise=7)
    return {"leadin": _numbered(leadin), "timeline": _numbered(timeline)}


# ---------------------------------------------------------------------------
# Story 3 — Boom, Bust & Black Swan
# ---------------------------------------------------------------------------


def _build_boom_bust_swan() -> dict:
    rng = random.Random(303)
    leadin = flat(rng, LEADIN_DAYS, 90, noise=7)
    timeline: list[dict] = []
    # R1: calm baseline before the boom
    timeline += flat(rng, 30, 90, noise=8)
    # R2: boom begins (regime shift up)
    timeline += ramp(rng, 30, 95, 140, noise=12)
    # R3: boom plateau
    timeline += flat(rng, 30, 150, noise=12)
    # R4: structural bust (regime shift down, sharp)
    timeline += ramp(rng, 30, 140, 60, noise=12)
    # R5: depressed market hit by an isolated supplier outage
    timeline += storm(rng, 30, 55, noise=10, density=0.20, min_gap_days=3, note="logistics outage")
    # R6: tentative stabilization
    timeline += flat(rng, 30, 70, noise=9)
    return {"leadin": _numbered(leadin), "timeline": _numbered(timeline)}


# ---------------------------------------------------------------------------
# Package registry
# ---------------------------------------------------------------------------

STORY_PACKAGES: list[dict] = [
    {
        "id": "supplier-meltdown",
        "title": "The Great Supplier Meltdown",
        "summary": "A viral product launch sends demand soaring — right before a two-month supplier storm cancels your shipments.",
        "difficulty": "Hard",
        "narrative": (
            "You manage inventory for a mid-size electronics distributor. For months "
            "demand has been steady and predictable. Then marketing's new flagship "
            "gadget goes **viral** in month two, and demand climbs fast.\n\n"
            "But success draws attention to a fragile supply chain. Two months after "
            "the launch, a **port-congestion crisis** triggers a wave of supplier "
            "failures that lasts **two straight months**, cancelling in-flight orders. "
            "Your job: ride the launch surge, then survive the storm without bleeding "
            "cash on stockouts. Watch the news — and decide carefully when to spend a "
            "contract change."
        ),
        "total_rounds": TOTAL_ROUNDS,
        "round_duration_days": ROUND_DURATION_DAYS,
        "historical_leadin_days": LEADIN_DAYS,
        "contract_updates_allowed": 2,
        "starting_inventory": 120,
        "costs": {**DEFAULT_COSTS, "dual_source_enabled": True, "dual_source_premium_per_unit": 2, "dual_source_rescue_pct": 1},
        "build_timeline": _build_supplier_meltdown,
        "news": [
            {"reveal_round": 1, "about_round": 2, "kind": "forecast", "headline": "Buzz building around next month's launch", "body": "Marketing reports record pre-orders for the new gadget. Expect a demand surge starting next round."},
            {"reveal_round": 1, "about_round": 3, "kind": "forecast", "headline": "Analysts flag spring port congestion", "body": "Shipping analysts warn that port congestion could disrupt suppliers in about two months. Keep a contract change in reserve."},
            {"reveal_round": 2, "about_round": 2, "kind": "event", "headline": "Launch goes viral — demand surges", "body": "The new gadget is everywhere. Demand has jumped well above baseline and is still climbing."},
            {"reveal_round": 2, "about_round": 3, "kind": "forecast", "headline": "Supplier issues force-majeure warning", "body": "Your primary supplier has issued a force-majeure notice for next month. Now is the time to plan for dual sourcing or extra buffer."},
            {"reveal_round": 3, "about_round": 3, "kind": "event", "headline": "Supplier storm hits — shipments cancelled", "body": "Port congestion is cancelling in-flight orders. Expect frequent supplier failures this month."},
            {"reveal_round": 3, "about_round": 4, "kind": "forecast", "headline": "Disruption expected to persist", "body": "Logistics teams see no quick fix — the disruption will likely continue into next month."},
            {"reveal_round": 4, "about_round": 4, "kind": "event", "headline": "Storm persists into a second month", "body": "Supplier failures continue. Dual-sourced orders are your best chance to keep shelves stocked."},
            {"reveal_round": 5, "about_round": 5, "kind": "event", "headline": "Supply lines reopening, demand cooling", "body": "Ports are clearing and demand is easing back toward normal. Time to right-size inventory."},
        ],
    },
    {
        "id": "holiday-rush",
        "title": "The Holiday Demand Rush",
        "summary": "A flash campaign and a blockbuster holiday peak reward managers who build inventory ahead of the wave.",
        "difficulty": "Medium",
        "narrative": (
            "You run inventory for a consumer-goods retailer heading into the busiest "
            "stretch of the year. A **flash marketing campaign** in month two gives "
            "you an early taste of a demand spike. The real test comes later: a "
            "**holiday peak** in month four where demand nearly doubles.\n\n"
            "Stock too little and you stock out during your best sales window; stock "
            "too much and you eat holding costs in the post-holiday slump. Use the "
            "news to build ahead of the peak and time your contract change well."
        ),
        "total_rounds": TOTAL_ROUNDS,
        "round_duration_days": ROUND_DURATION_DAYS,
        "historical_leadin_days": LEADIN_DAYS,
        "contract_updates_allowed": 2,
        "starting_inventory": 100,
        "costs": {**DEFAULT_COSTS},
        "build_timeline": _build_holiday_rush,
        "news": [
            {"reveal_round": 1, "about_round": 2, "kind": "forecast", "headline": "Marketing plans a flash campaign", "body": "A short, sharp promotional push is scheduled for next month. Expect a temporary demand spike."},
            {"reveal_round": 1, "about_round": 4, "kind": "forecast", "headline": "Holiday season approaching", "body": "The holiday peak is two rounds out and is expected to be the biggest demand event of the season. Start planning your build-up."},
            {"reveal_round": 2, "about_round": 2, "kind": "event", "headline": "Flash campaign drives a spike", "body": "The campaign landed — demand spiked mid-month before settling back down."},
            {"reveal_round": 3, "about_round": 4, "kind": "forecast", "headline": "Retailers brace for record holiday demand", "body": "Forecasts point to a record holiday peak next round. Consider spending a contract change now to build inventory ahead of it."},
            {"reveal_round": 4, "about_round": 4, "kind": "event", "headline": "Holiday rush peaks", "body": "Demand has surged to its seasonal high. Service levels this month make or break the season."},
            {"reveal_round": 5, "about_round": 5, "kind": "event", "headline": "Post-holiday slump sets in", "body": "Demand has dropped sharply and is choppy. Trim inventory to avoid holding costs."},
        ],
    },
    {
        "id": "boom-bust-swan",
        "title": "Boom, Bust & Black Swan",
        "summary": "A market boom flips into a structural bust — and a supplier outage strikes while you're already down.",
        "difficulty": "Expert",
        "narrative": (
            "You manage supply for a product entering a hot new market. Month two "
            "kicks off a genuine **boom**: demand jumps to a new, higher regime and "
            "holds there.\n\n"
            "But booms invite competition. A rival's market entry triggers a "
            "**structural bust** in month four — demand collapses to well below where "
            "you started. Then, while the market is already weak, a **supplier outage** "
            "strikes in month five. Reading the regime changes early and spending your "
            "contract changes at the right moments is the whole game."
        ),
        "total_rounds": TOTAL_ROUNDS,
        "round_duration_days": ROUND_DURATION_DAYS,
        "historical_leadin_days": LEADIN_DAYS,
        "contract_updates_allowed": 3,
        "starting_inventory": 110,
        "costs": {**DEFAULT_COSTS, "dual_source_enabled": True, "dual_source_premium_per_unit": 3, "dual_source_rescue_pct": 1},
        "build_timeline": _build_boom_bust_swan,
        "news": [
            {"reveal_round": 1, "about_round": 2, "kind": "forecast", "headline": "New market opening — boom forecast", "body": "Your product is launching into a fast-growing market. Demand is expected to jump to a higher level starting next round."},
            {"reveal_round": 2, "about_round": 2, "kind": "event", "headline": "Boom underway — orders surge", "body": "Demand has shifted up to a new, sustained level. Scale your policy to the new regime."},
            {"reveal_round": 2, "about_round": 4, "kind": "forecast", "headline": "Competitor announces market entry", "body": "A major competitor is entering in two rounds. Analysts warn of a sharp downturn — keep a contract change ready to scale down."},
            {"reveal_round": 3, "about_round": 4, "kind": "forecast", "headline": "Signs of market saturation", "body": "Growth is stalling and saturation is setting in. The boom likely ends next round."},
            {"reveal_round": 4, "about_round": 4, "kind": "event", "headline": "The bust arrives — demand collapses", "body": "Demand has fallen well below baseline as the competitor takes share. Cut your order-up-to levels to avoid piling up inventory."},
            {"reveal_round": 4, "about_round": 5, "kind": "forecast", "headline": "Logistics disruption flagged", "body": "A supplier outage is expected next round — on top of weak demand. Dual sourcing may help protect what little demand remains."},
            {"reveal_round": 5, "about_round": 5, "kind": "event", "headline": "Supplier outage strikes a weak market", "body": "A logistics outage is causing supplier failures while demand is already depressed. Balance rescue costs against thin margins."},
        ],
    },
]

_PACKAGE_BY_ID = {p["id"]: p for p in STORY_PACKAGES}


def _public_metadata(pkg: dict) -> dict:
    """Everything except the build_timeline callable, which isn't JSON-serializable."""
    return {
        "id": pkg["id"],
        "title": pkg["title"],
        "summary": pkg["summary"],
        "difficulty": pkg["difficulty"],
        "narrative": pkg["narrative"],
        "total_rounds": pkg["total_rounds"],
        "round_duration_days": pkg["round_duration_days"],
        "historical_leadin_days": pkg["historical_leadin_days"],
        "contract_updates_allowed": pkg["contract_updates_allowed"],
        "starting_inventory": pkg["starting_inventory"],
        "costs": pkg["costs"],
        "news": pkg["news"],
    }


def list_story_packages() -> list[dict]:
    """Public metadata for all stories (no raw timeline)."""
    return [_public_metadata(p) for p in STORY_PACKAGES]


def get_story_package(story_id: str) -> Optional[dict]:
    return _PACKAGE_BY_ID.get(story_id)


def get_story_metadata(story_id: str) -> Optional[dict]:
    pkg = _PACKAGE_BY_ID.get(story_id)
    return _public_metadata(pkg) if pkg else None


def build_story_timeline(story_id: str) -> dict:
    """Return ``{"leadin": [...], "timeline": [...]}`` for a story.

    Raises ``KeyError`` if the story id is unknown.
    """
    pkg = _PACKAGE_BY_ID[story_id]
    builder: Callable[[], dict] = pkg["build_timeline"]
    return builder()
