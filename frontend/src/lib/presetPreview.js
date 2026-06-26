/** Fixed preview params for per-card sparklines (slice 4). */
export const SLICE4_PREVIEW_DEFAULTS = {
  total_rounds: 3,
  round_duration_days: 30,
  historical_leadin_days: 60,
};

export const BADGE_COLORS = {
  Easy: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  Medium: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  Hard: 'text-red-400 border-red-400/30 bg-red-400/10',
  Expert: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
};

/** Config sliders by preset id. Missing presets get no sliders (defaults used). */
export const PRESET_CONFIG_FIELDS = {
  steady: [
    { key: 'base_demand', label: 'Base demand', min: 20, max: 200, step: 5, default: 80 },
    { key: 'noise', label: 'Noise', min: 0, max: 80, step: 2, default: 30 },
    { key: 'swan_chance', label: 'Black-swan chance / day', min: 0, max: 0.2, step: 0.01, default: 0.06 },
  ],
  seasonality: [
    { key: 'base_demand', label: 'Base demand', min: 20, max: 200, step: 5, default: 80 },
    { key: 'amplitude', label: 'Wave amplitude', min: 5, max: 100, step: 5, default: 35 },
    { key: 'period', label: 'Wave period (days)', min: 10, max: 180, step: 5, default: 90 },
    { key: 'noise', label: 'Noise', min: 0, max: 60, step: 2, default: 16 },
  ],
  trend_up: [
    { key: 'start_demand', label: 'Start demand', min: 10, max: 120, step: 5, default: 40 },
    { key: 'end_demand', label: 'End demand', min: 40, max: 300, step: 5, default: 140 },
    { key: 'noise', label: 'Noise', min: 0, max: 60, step: 2, default: 24 },
  ],
  regime_change: [
    { key: 'shift_count', label: 'Number of shifts', min: 1, max: 3, step: 1, default: 2 },
    { key: 'noise', label: 'Noise', min: 0, max: 60, step: 2, default: 24 },
    { key: 'min_base', label: 'Min regime demand', min: 10, max: 200, step: 5, default: 50 },
    { key: 'max_base', label: 'Max regime demand', min: 50, max: 300, step: 5, default: 150 },
  ],
  high_volatility: [
    { key: 'base_demand', label: 'Base demand', min: 20, max: 200, step: 5, default: 80 },
    { key: 'noise', label: 'Noise', min: 20, max: 160, step: 5, default: 80 },
    { key: 'spike_chance', label: 'Spike chance / day', min: 0, max: 0.25, step: 0.01, default: 0.08 },
  ],
  intermittent: [
    { key: 'active_prob', label: 'Active-day probability', min: 0.1, max: 0.9, step: 0.05, default: 0.6 },
    { key: 'active_min', label: 'Active demand min', min: 20, max: 300, step: 10, default: 120 },
    { key: 'active_max', label: 'Active demand max', min: 50, max: 600, step: 10, default: 300 },
  ],
  black_swan_storm: [
    { key: 'base_demand', label: 'Base demand', min: 20, max: 200, step: 5, default: 80 },
    { key: 'noise', label: 'Noise', min: 0, max: 80, step: 2, default: 40 },
    { key: 'swan_density', label: 'Swan density / day', min: 0, max: 0.2, step: 0.005, default: 0.04 },
    { key: 'min_gap_days', label: 'Min days between swans', min: 1, max: 15, step: 1, default: 4 },
  ],
};

export function defaultConfigFor(presetId) {
  const fields = PRESET_CONFIG_FIELDS[presetId] || [];
  const out = {};
  fields.forEach((f) => {
    out[f.key] = f.default;
  });
  return out;
}

function demandVal(row) {
  const n = Number(row?.demand);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} res - API response from previewSeason
 * @returns {{ chartData: object[], boundary: number, roundBoundaries: number[], sparklineData: object[] }}
 */
export function transformPreviewResponse(res) {
  const leadinRows = (res.leadin || []).map((row, i) => ({
    x: i + 1,
    demandHistorical: demandVal(row),
    demandActual: null,
    demand: demandVal(row),
  }));
  const timelineRows = (res.timeline || []).map((row, i) => ({
    x: leadinRows.length + i + 1,
    demandHistorical: null,
    demandActual: demandVal(row),
    demand: demandVal(row),
  }));
  const chartData = [...leadinRows, ...timelineRows];
  const boundary = leadinRows.length + 0.5;
  const roundBoundaries = (res.round_boundaries || []).map(
    (dayIdx) => leadinRows.length + dayIdx - 0.5,
  );
  return { chartData, boundary, roundBoundaries, sparklineData: chartData };
}

/**
 * @param {string} presetId
 * @param {object} [overrides] - optional overrides for preview params
 */
export function buildPreviewRequest(presetId, overrides = {}) {
  return {
    scenario_preset: presetId,
    scenario_config: overrides.scenario_config ?? defaultConfigFor(presetId),
    total_rounds: overrides.total_rounds ?? SLICE4_PREVIEW_DEFAULTS.total_rounds,
    round_duration_days:
      overrides.round_duration_days ?? SLICE4_PREVIEW_DEFAULTS.round_duration_days,
    historical_leadin_days:
      overrides.historical_leadin_days ?? SLICE4_PREVIEW_DEFAULTS.historical_leadin_days,
    ...overrides,
  };
}

export function previewCacheKey(presetId, overrides = {}) {
  return JSON.stringify(buildPreviewRequest(presetId, overrides));
}
