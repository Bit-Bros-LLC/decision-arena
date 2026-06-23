"""Season-scale scenario generators.

Each preset produces a single coherent timeline of shape::

    { "leadin": [lead-in 60 days], "timeline": [N * round_duration days] }

where each day is a dict matching the ``DayScenario.from_dict`` contract in
``simulation.models`` (``day``, ``demand``, ``lead_time``, optional
``black_swan``).

Unlike the per-round presets in ``frontend/src/pages/Admin.jsx``, these
generators operate on the *whole season* so that patterns like regime shifts
or black-swan density are spread sensibly across all rounds. Generation is
deterministic given ``seed``.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Callable


def _clamp_demand(d: float) -> int:
    return max(0, round(d))


def _drop_none_config_keys(cfg: dict | None) -> dict:
    """JSON may send explicit null for optional sliders — drop so preset defaults apply."""
    if not cfg:
        return {}
    return {k: v for k, v in cfg.items() if v is not None}


def _make_day(day: int, demand: float, lt: int, swan: dict | None) -> dict:
    out: dict = {
        "day": day,
        "demand": _clamp_demand(demand),
        "lead_time": int(lt),
        "black_swan": swan,
    }
    return out


def _rand_swan(rng: random.Random, chance: float) -> dict | None:
    if rng.random() > chance:
        return None
    return {"type": "supplier_failure", "note": "generated"}


# ---------------------------------------------------------------------------
# Per-preset generators
# ---------------------------------------------------------------------------

def _gen_steady(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    base = float(config.get("base_demand", 80))
    noise = float(config.get("noise", 30))
    swan_chance = float(config.get("swan_chance", 0.06))
    out = []
    for i in range(total_days):
        demand = base + (rng.random() - 0.5) * noise
        lt = 1 + rng.randint(0, 2)
        out.append(_make_day(i + 1, demand, lt, _rand_swan(rng, swan_chance)))
    return out


def _gen_seasonality(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    """Seasonal wave. Period defaults to ~90 days over a 600-day season so you
    typically see ~6 full cycles."""
    base = float(config.get("base_demand", 80))
    amplitude = float(config.get("amplitude", 35))
    period = float(config.get("period", max(30, total_days / 6.0)))
    noise = float(config.get("noise", 16))
    swan_chance = float(config.get("swan_chance", 0.06))
    phase = rng.uniform(0, 2 * math.pi)
    out = []
    for i in range(total_days):
        wave = math.sin((2 * math.pi * i) / period + phase) * amplitude
        demand = base + wave + (rng.random() - 0.5) * noise
        lt = 1 + rng.randint(0, 2)
        out.append(_make_day(i + 1, demand, lt, _rand_swan(rng, swan_chance)))
    return out


def _gen_trend_up(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    """Smooth upward trend from ``start_demand`` to ``end_demand`` across the
    whole season."""
    start = float(config.get("start_demand", 40))
    end = float(config.get("end_demand", 140))
    noise = float(config.get("noise", 24))
    swan_chance = float(config.get("swan_chance", 0.06))
    out = []
    for i in range(total_days):
        base = start + (end - start) * (i / max(1, total_days - 1))
        demand = base + (rng.random() - 0.5) * noise
        lt = 1 + rng.randint(0, 2)
        out.append(_make_day(i + 1, demand, lt, _rand_swan(rng, swan_chance)))
    return out


def _gen_regime_change(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    """1-2 regime shifts spaced across the whole season (not per round)."""
    shift_count = int(config.get("shift_count", 2))
    shift_count = max(1, min(shift_count, 3))
    noise = float(config.get("noise", 24))
    swan_chance = float(config.get("swan_chance", 0.05))
    min_base = float(config.get("min_base", 50))
    max_base = float(config.get("max_base", 150))

    # Choose shift days with min-gap so shifts do not cluster.
    min_gap = max(1, total_days // (shift_count + 1) // 2)
    shift_days: list[int] = []
    attempts = 0
    while len(shift_days) < shift_count and attempts < 100:
        attempts += 1
        candidate = rng.randint(total_days // 6, total_days - total_days // 6)
        if all(abs(candidate - d) >= min_gap for d in shift_days):
            shift_days.append(candidate)
    shift_days.sort()

    # Build alternating regime levels.
    regimes = [rng.uniform(min_base, max_base)]
    for _ in shift_days:
        # pick a new level at least 40 units away from current
        for _attempt in range(20):
            candidate = rng.uniform(min_base, max_base)
            if abs(candidate - regimes[-1]) >= 40:
                regimes.append(candidate)
                break
        else:
            regimes.append(max_base if regimes[-1] < (min_base + max_base) / 2 else min_base)

    out = []
    idx = 0
    for i in range(total_days):
        while idx < len(shift_days) and i >= shift_days[idx]:
            idx += 1
        base = regimes[idx]
        demand = base + (rng.random() - 0.5) * noise
        lt = 1 + rng.randint(0, 3)
        out.append(_make_day(i + 1, demand, lt, _rand_swan(rng, swan_chance)))
    return out


def _gen_high_volatility(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    base = float(config.get("base_demand", 80))
    noise = float(config.get("noise", 80))
    spike_chance = float(config.get("spike_chance", 0.08))
    swan_chance = float(config.get("swan_chance", 0.05))
    out = []
    for i in range(total_days):
        spike = 0.0
        if rng.random() < spike_chance:
            spike = 80 if rng.random() < 0.5 else -40
        demand = base + (rng.random() - 0.5) * noise + spike
        lt = 1 + rng.randint(0, 3)
        out.append(_make_day(i + 1, demand, lt, _rand_swan(rng, swan_chance)))
    return out


def _gen_intermittent(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    active_prob = float(config.get("active_prob", 0.6))
    active_min = float(config.get("active_min", 120))
    active_max = float(config.get("active_max", 300))
    swan_chance = float(config.get("swan_chance", 0.05))
    out = []
    for i in range(total_days):
        if rng.random() <= active_prob:
            demand = active_min + rng.random() * (active_max - active_min)
        else:
            demand = 0.0
        lt = 1 + rng.randint(0, 3)
        out.append(_make_day(i + 1, demand, lt, _rand_swan(rng, swan_chance)))
    return out


def _gen_black_swan_storm(rng: random.Random, total_days: int, config: dict) -> list[dict]:
    """Normal-ish demand but black swans are sprinkled across the ENTIRE season at
    a chosen density. Density is a per-day probability, with a min-gap to avoid
    clustering."""
    base = float(config.get("base_demand", 80))
    noise = float(config.get("noise", 40))
    density = float(config.get("swan_density", 0.04))
    min_gap = int(config.get("min_gap_days", 4))

    # Draw candidate swans, enforce min-gap.
    swans: dict[int, dict] = {}
    last = -10_000
    for i in range(total_days):
        if (i - last) < min_gap:
            continue
        if rng.random() < density:
            swans[i] = {"type": "supplier_failure", "note": "storm"}
            last = i

    out = []
    for i in range(total_days):
        demand = base + (rng.random() - 0.5) * noise
        lt = 1 + rng.randint(0, 3)
        out.append(_make_day(i + 1, demand, lt, swans.get(i)))
    return out


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

@dataclass
class SeasonPreset:
    id: str
    name: str
    description: str
    badge: str
    generate: Callable[[random.Random, int, dict], list[dict]]


SEASON_PRESETS: list[SeasonPreset] = [
    SeasonPreset(
        id="steady",
        name="Steady State",
        description="Flat demand across the whole season with mild noise. Baseline.",
        badge="Easy",
        generate=_gen_steady,
    ),
    SeasonPreset(
        id="seasonality",
        name="Seasonality",
        description="Long repeating wave spanning multiple rounds. Students must detect and plan ahead.",
        badge="Medium",
        generate=_gen_seasonality,
    ),
    SeasonPreset(
        id="trend_up",
        name="Upward Trend",
        description="Demand climbs steadily across the entire season. Exposes static policies.",
        badge="Medium",
        generate=_gen_trend_up,
    ),
    SeasonPreset(
        id="regime_change",
        name="Regime Change",
        description="1-2 step shifts in demand somewhere in the season. Not every round will feel them.",
        badge="Hard",
        generate=_gen_regime_change,
    ),
    SeasonPreset(
        id="high_volatility",
        name="High Volatility",
        description="Wild swings around the mean throughout the season with occasional extreme days.",
        badge="Hard",
        generate=_gen_high_volatility,
    ),
    SeasonPreset(
        id="intermittent",
        name="Intermittent / Lumpy",
        description="Many zero-demand days punctuated by large bursts. Classic spare-parts problem.",
        badge="Expert",
        generate=_gen_intermittent,
    ),
    SeasonPreset(
        id="black_swan_storm",
        name="Supplier Disruption Storm",
        description="Normal-ish demand but supplier failures scattered across the whole season. Stress-tests dual sourcing.",
        badge="Expert",
        generate=_gen_black_swan_storm,
    ),
]

_PRESET_BY_ID = {p.id: p for p in SEASON_PRESETS}


def list_presets() -> list[dict]:
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "badge": p.badge,
        }
        for p in SEASON_PRESETS
    ]


def generate_season(
    preset_id: str,
    total_rounds: int,
    round_duration_days: int,
    leadin_days: int,
    config: dict | None = None,
    seed: int | None = None,
) -> dict:
    """Build a coherent season scenario.

    Returns ``{"leadin": [...], "timeline": [...]}``. Day numbers restart at 1 in
    each list; when sliced into rounds the caller is responsible for re-numbering
    the historical + actual windows per round.
    """
    if preset_id not in _PRESET_BY_ID:
        raise ValueError(f"Unknown season preset: {preset_id}")
    preset = _PRESET_BY_ID[preset_id]
    cfg = _drop_none_config_keys(dict(config or {}))
    rng = random.Random(seed if seed is not None else cfg.get("seed"))

    total = total_rounds * round_duration_days
    # Pull a longer sequence then split off the lead-in so the timeline is a
    # single coherent draw (especially useful for trends / regime changes).
    full = preset.generate(rng, leadin_days + total, cfg)
    leadin_raw = full[:leadin_days]
    timeline_raw = full[leadin_days:]

    leadin = [
        {**d, "day": i + 1} for i, d in enumerate(leadin_raw)
    ]
    timeline = [
        {**d, "day": i + 1} for i, d in enumerate(timeline_raw)
    ]
    return {"leadin": leadin, "timeline": timeline}


def generate_mixed_season(
    season_mode: str,
    total_rounds: int,
    round_duration_days: int,
    leadin_days: int,
    scenario_preset: str = "steady",
    scenario_config: dict | None = None,
    mix_config: dict | None = None,
    seed: int | None = None,
) -> dict:
    mode = (season_mode or "single").strip().lower()
    if mode == "single":
        return generate_season(
            preset_id=scenario_preset,
            total_rounds=total_rounds,
            round_duration_days=round_duration_days,
            leadin_days=leadin_days,
            config=_drop_none_config_keys(scenario_config),
            seed=seed,
        )

    rng = random.Random(seed)
    cfg = dict(mix_config or {})
    timeline: list[dict] = []
    plan: list[dict] = []
    if mode == "random_mix":
        allowed = cfg.get("allowed_presets") or [p.id for p in SEASON_PRESETS]
        allowed = [p for p in allowed if p in _PRESET_BY_ID]
        if not allowed:
            raise ValueError("random_mix requires at least one valid allowed preset")
        per_preset_config = cfg.get("preset_configs") or {}
        for round_idx in range(total_rounds):
            pick = rng.choice(allowed)
            seg = _PRESET_BY_ID[pick].generate(
                rng,
                round_duration_days,
                _drop_none_config_keys(per_preset_config.get(pick, {})),
            )
            timeline.extend(seg)
            plan.append({"round": round_idx + 1, "preset_id": pick})
    elif mode == "custom_mix":
        round_presets = cfg.get("round_presets") or []
        if len(round_presets) != total_rounds:
            raise ValueError("custom_mix requires round_presets length to match total_rounds")
        per_preset_config = cfg.get("preset_configs") or {}
        for round_idx, pick in enumerate(round_presets):
            if pick not in _PRESET_BY_ID:
                raise ValueError(f"Unknown season preset in custom mix: {pick}")
            seg = _PRESET_BY_ID[pick].generate(
                rng,
                round_duration_days,
                _drop_none_config_keys(per_preset_config.get(pick, {})),
            )
            timeline.extend(seg)
            plan.append({"round": round_idx + 1, "preset_id": pick})
    else:
        raise ValueError(f"Unknown season mode: {season_mode}")

    leadin_preset = _PRESET_BY_ID[scenario_preset] if scenario_preset in _PRESET_BY_ID else _PRESET_BY_ID["steady"]
    leadin = leadin_preset.generate(rng, leadin_days, _drop_none_config_keys(dict(scenario_config or {})))
    leadin = [{**d, "day": i + 1} for i, d in enumerate(leadin)]
    timeline = [{**d, "day": i + 1} for i, d in enumerate(timeline)]
    return {"leadin": leadin, "timeline": timeline, "round_plan": plan}


def slice_round_data(
    leadin: list[dict],
    timeline: list[dict],
    round_index: int,
    round_duration_days: int,
) -> tuple[list[dict], list[dict]]:
    """Compute (historical_data, actual_data) for a round.

    ``round_index`` is 0-based. Historical = lead-in + timeline up to round start
    (renumbered 1..). Actual = that round's 30-day slice (renumbered 1..). Day
    numbering restarts at 1 in each window to match the existing frontend
    expectations.
    """
    start = round_index * round_duration_days
    end = start + round_duration_days
    # Historical: lead-in + all prior-round actuals so far. Students see more
    # history as the season progresses.
    hist_source = list(leadin) + list(timeline[:start])
    historical = [{**d, "day": i + 1} for i, d in enumerate(hist_source)]
    actual_slice = timeline[start:end]
    actual = [{**d, "day": i + 1} for i, d in enumerate(actual_slice)]
    return historical, actual
