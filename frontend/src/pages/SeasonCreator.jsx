import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api';
import { FieldLabel } from '../components/FieldLabel';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { COST_TOOLTIPS } from '../lib/costTooltips';
import { SEASON_CREATOR_COPY } from '../lib/seasonCreatorCopy';

const DEFAULT_COSTS = {
  holding_per_unit: 1,
  stockout_penalty: 10,
  ordering_fixed: 20,
  per_unit_cost: 5,
  selling_price: 15,
  dual_source_enabled: false,
  dual_source_premium_per_unit: 2,
  dual_source_rescue_pct: 1,
};

const BADGE_COLORS = {
  Easy: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  Medium: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
  Hard: 'text-red-400 border-red-400/30 bg-red-400/10',
  Expert: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
};

/** Config sliders by preset id. Missing presets get no sliders (defaults used). */
const PRESET_CONFIG_FIELDS = {
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

function nextSundayMidnightLocal() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  let daysToAdd = (7 - day) % 7;
  if (daysToAdd === 0) {
    d.setHours(0, 0, 0, 0);
    if (now.getTime() >= d.getTime()) daysToAdd = 7;
  }
  if (daysToAdd > 0) d.setDate(d.getDate() + daysToAdd);
  d.setHours(0, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
}

function defaultConfigFor(presetId) {
  const fields = PRESET_CONFIG_FIELDS[presetId] || [];
  const out = {};
  fields.forEach((f) => {
    out[f.key] = f.default;
  });
  return out;
}

export default function SeasonCreator() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [presets, setPresets] = useState([]);
  const [presetsError, setPresetsError] = useState(null);
  const [roomLabel, setRoomLabel] = useState(null);

  const [name, setName] = useState('');
  const [totalRounds, setTotalRounds] = useState(20);
  const [contractUpdates, setContractUpdates] = useState(3);
  const [roundDuration, setRoundDuration] = useState(30);
  const [leadinDays, setLeadinDays] = useState(60);
  const [firstDeadline, setFirstDeadline] = useState(nextSundayMidnightLocal);
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [startingInventory, setStartingInventory] = useState(100);

  const [activePresetId, setActivePresetId] = useState(null);
  const [scenarioConfig, setScenarioConfig] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [chartOpen, setChartOpen] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [previewChartData, setPreviewChartData] = useState([]);
  const [previewBoundary, setPreviewBoundary] = useState(null);
  const [previewRoundBoundaries, setPreviewRoundBoundaries] = useState([]);

  useBreadcrumbLabels({ labels: roomLabel ? { room: roomLabel } : {} });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rooms = await api.getRooms();
        if (cancelled) return;
        const found = rooms.find((r) => r.id === roomId);
        if (found?.completed) {
          navigate(`/room/${roomId}`, { replace: true });
          return;
        }
        setRoomLabel(found?.name ?? roomId);
      } catch {
        if (!cancelled) setRoomLabel(roomId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listSeasonPresets();
        if (cancelled) return;
        setPresets(Array.isArray(list) ? list : []);
        if (!activePresetId && list.length > 0) {
          setActivePresetId(list[0].id);
          setScenarioConfig(defaultConfigFor(list[0].id));
        }
      } catch (err) {
        if (!cancelled) setPresetsError(err.message || 'Could not load presets');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId],
  );

  const configFields = PRESET_CONFIG_FIELDS[activePresetId] || [];

  const updateCost = (key, raw) => {
    if (key === 'dual_source_enabled') {
      setCosts((c) => ({ ...c, dual_source_enabled: raw === true || raw === 'true' }));
      return;
    }
    const num = parseFloat(raw);
    setCosts((c) => ({ ...c, [key]: Number.isFinite(num) ? num : c[key] }));
  };

  const updateScenarioField = (key, raw) => {
    const num = parseFloat(raw);
    setScenarioConfig((cfg) => ({
      ...cfg,
      [key]: Number.isFinite(num) ? num : cfg[key],
    }));
  };

  const pickPreset = (preset) => {
    setActivePresetId(preset.id);
    setScenarioConfig(defaultConfigFor(preset.id));
    setChartError(null);
  };

  useEffect(() => {
    if (!chartOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setChartOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chartOpen]);

  const openDemandChartPreview = async () => {
    setChartError(null);
    if (!activePresetId) {
      setChartError('Pick a scenario preset first.');
      return;
    }
    const rounds = Number(totalRounds);
    const duration = Number(roundDuration);
    const leadin = Number(leadinDays);
    if (!Number.isFinite(rounds) || rounds < 1) {
      setChartError('Total rounds must be at least 1.');
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      setChartError('Round duration must be at least 1 day.');
      return;
    }
    if (!Number.isFinite(leadin) || leadin < 0) {
      setChartError('Historical lead-in must be 0 or more days.');
      return;
    }
    setChartLoading(true);
    try {
      const res = await api.previewSeason({
        scenario_preset: activePresetId,
        scenario_config: scenarioConfig,
        total_rounds: rounds,
        round_duration_days: duration,
        historical_leadin_days: leadin,
      });
      const demandVal = (row) => {
        const n = Number(row?.demand);
        return Number.isFinite(n) ? n : null;
      };
      const leadinRows = (res.leadin || []).map((row, i) => ({
        x: i + 1,
        demandHistorical: demandVal(row),
        demandActual: null,
      }));
      const timelineRows = (res.timeline || []).map((row, i) => ({
        x: leadinRows.length + i + 1,
        demandHistorical: null,
        demandActual: demandVal(row),
      }));
      setPreviewChartData([...leadinRows, ...timelineRows]);
      setPreviewBoundary(leadinRows.length + 0.5);
      setPreviewRoundBoundaries(
        (res.round_boundaries || []).map((dayIdx) => leadinRows.length + dayIdx - 0.5),
      );
      setChartOpen(true);
    } catch (err) {
      setChartError(err.message || 'Could not generate preview');
    } finally {
      setChartLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError('Please enter a season name');
      return;
    }
    if (!activePresetId) {
      setSubmitError('Pick a scenario preset first.');
      return;
    }
    if (!firstDeadline) {
      setSubmitError('Set a first-round deadline.');
      return;
    }
    const deadlineIso = firstDeadline.length === 16 ? `${firstDeadline}:00` : firstDeadline;
    setSubmitting(true);
    try {
      const res = await api.createSeason({
        room_id: roomId,
        name: trimmedName,
        scenario_preset: activePresetId,
        scenario_config: scenarioConfig,
        costs,
        starting_inventory: Number(startingInventory),
        total_rounds: Number(totalRounds),
        contract_updates_allowed: Number(contractUpdates),
        round_duration_days: Number(roundDuration),
        historical_leadin_days: Number(leadinDays),
        first_round_deadline: deadlineIso,
      });
      navigate(`/room/${roomId}/season/${res.id}`);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create season');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Create season</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure rules, costs, and demand scenario for your class. Students play each round before
          you score and advance.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Room: <span className="text-slate-200">{roomLabel ?? '…'}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
      >
        <div>
          <FieldLabel label="Season name" help={SEASON_CREATOR_COPY.seasonName} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={SEASON_CREATOR_COPY.seasonNamePlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <p className="mt-1 text-xs text-slate-500">{SEASON_CREATOR_COPY.seasonNameHelper}</p>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-amber-500">Season rules</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="Total rounds" help={SEASON_CREATOR_COPY.totalRounds} />
              <input
                type="number"
                min={1}
                max={60}
                value={totalRounds}
                onChange={(e) => setTotalRounds(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel
                label="Contract updates per student"
                help={SEASON_CREATOR_COPY.contractUpdatesPerStudent}
              />
              <input
                type="number"
                min={0}
                max={20}
                value={contractUpdates}
                onChange={(e) => setContractUpdates(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel label="Round duration (days)" help={SEASON_CREATOR_COPY.roundDuration} />
              <input
                type="number"
                min={1}
                max={90}
                value={roundDuration}
                onChange={(e) => setRoundDuration(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel
                label="Historical lead-in (days)"
                help={SEASON_CREATOR_COPY.historicalLeadin}
              />
              <input
                type="number"
                min={0}
                max={365}
                value={leadinDays}
                onChange={(e) => setLeadinDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel label="Starting inventory" help={SEASON_CREATOR_COPY.startingInventory} />
              <input
                type="number"
                min={0}
                value={startingInventory}
                onChange={(e) => setStartingInventory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel
                label="First round deadline"
                help={SEASON_CREATOR_COPY.firstRoundDeadline}
              />
              <input
                type="datetime-local"
                value={firstDeadline}
                onChange={(e) => setFirstDeadline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 [color-scheme:dark]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Subsequent rounds auto-schedule {roundDuration} days apart. You advance each round
            manually from the season dashboard.
          </p>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-amber-500">Cost parameters</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['holding_per_unit', 'Holding / unit'],
              ['stockout_penalty', 'Stockout penalty'],
              ['ordering_fixed', 'Ordering (fixed)'],
              ['per_unit_cost', 'Per-unit cost'],
              ['selling_price', 'Selling price'],
            ].map(([key, label, tooltipKey]) => (
              <div key={key}>
                <FieldLabel
                  label={label}
                  help={COST_TOOLTIPS[tooltipKey || label]}
                />
                <input
                  type="number"
                  step="1"
                  value={costs[key]}
                  onChange={(e) => updateCost(key, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-amber-500">Dual sourcing</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(costs.dual_source_enabled)}
              onChange={(e) => updateCost('dual_source_enabled', e.target.checked)}
              className="rounded border-slate-600 accent-amber-500"
            />
            <FieldLabel
              label="Enable dual sourcing for students"
              help={COST_TOOLTIPS['Dual sourcing enabled']}
            />
          </label>
          {costs.dual_source_enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel
                  label="Dual-source premium / unit"
                  help={COST_TOOLTIPS['Dual-source premium / unit']}
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={costs.dual_source_premium_per_unit}
                  onChange={(e) => updateCost('dual_source_premium_per_unit', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <FieldLabel
                  label="Supplier rescue % (0.5–1)"
                  help={COST_TOOLTIPS['Supplier rescue %']}
                />
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1"
                  value={costs.dual_source_rescue_pct}
                  onChange={(e) => updateCost('dual_source_rescue_pct', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-amber-500">Season scenario</legend>
          <FieldLabel label="Demand scenario" help={SEASON_CREATOR_COPY.seasonScenario} />
          <p className="text-xs text-slate-500">
            Patterns apply across the <strong>entire season</strong>. E.g. "Regime Change" plants
            1-2 shifts somewhere in {totalRounds * roundDuration} days — not in every round.
          </p>
          {presetsError && <p className="text-sm text-red-400">{presetsError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => pickPreset(preset)}
                className={`group relative rounded-lg border p-3 text-left transition ${
                  activePresetId === preset.id
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                    : 'border-slate-600 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{preset.name}</span>
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider ${
                      BADGE_COLORS[preset.badge] || 'text-slate-400 border-slate-500/40 bg-slate-500/10'
                    }`}
                  >
                    {preset.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">
                  {preset.description}
                </p>
                {activePresetId === preset.id && (
                  <span className="absolute right-2 top-2 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>
        </fieldset>

        {activePreset && configFields.length > 0 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium text-amber-500">
              {activePreset.name} · tuning
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {configFields.map((f) => (
                <div key={f.key}>
                  <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
                    <span>{f.label}</span>
                    <span className="font-mono text-amber-400">
                      {scenarioConfig[f.key] ?? f.default}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={scenarioConfig[f.key] ?? f.default}
                    onChange={(e) => updateScenarioField(f.key, e.target.value)}
                    className="mt-2 w-full accent-amber-500"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <FieldLabel
            label="Preview demand chart"
            help={SEASON_CREATOR_COPY.previewDemand}
          />
          <button
            type="button"
            onClick={openDemandChartPreview}
            disabled={chartLoading || !activePresetId}
            className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-slate-700 disabled:opacity-50"
          >
            {chartLoading ? 'Generating…' : 'Preview demand chart'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            See the lead-in historical data and the full season demand signal before creating.
          </p>
          {chartError && <p className="mt-2 text-sm text-red-400">{chartError}</p>}
        </div>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create season'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/room/${roomId}`)}
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>

      {chartOpen && previewBoundary != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="season-demand-chart-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setChartOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="season-demand-chart-title" className="text-lg font-semibold text-slate-100">
                  Season demand preview
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Historical lead-in (amber) students will see on day one, then the full season
                  timeline (sky) across {totalRounds} rounds of {roundDuration} days. Solid vertical
                  line marks where round&nbsp;1 begins; faint lines mark subsequent round boundaries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChartOpen(false)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 h-80 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={previewChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="x" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                  {previewRoundBoundaries.map((x, i) => (
                    <ReferenceLine
                      key={`rb-${i}`}
                      x={x}
                      stroke="#475569"
                      strokeDasharray="2 4"
                      ifOverflow="extendDomain"
                    />
                  ))}
                  <ReferenceLine
                    x={previewBoundary}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Season starts',
                      position: 'top',
                      fill: '#94a3b8',
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="demandHistorical"
                    name="Historical demand"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="demandActual"
                    name="Season demand"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
