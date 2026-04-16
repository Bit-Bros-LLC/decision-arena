import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { api } from '../api';
import { CLAUDE_ROUND_DATA_PROMPT } from '../claudeRoundDataPrompt';

const DEFAULT_COSTS = {
  holding_per_unit: 1,
  stockout_penalty: 10,
  ordering_fixed: 20,
  per_unit_cost: 5,
  selling_price: 15,
  insurance_premium: 8,
  insurance_coverage_pct: 0.8,
};

function randomBlackSwan(chance = 0.06) {
  if (Math.random() > chance) return null;
  const types = ['supplier_failure', 'demand_spike', 'warehouse_damage', 'cost_shock'];
  return { type: types[Math.floor(Math.random() * types.length)], note: 'sample' };
}

function clampDemand(d) {
  return Math.max(0, Math.round(d));
}

// --- Scenario preset generators ---
// Each returns { historical: [...60 days], actual: [...30 days] }

const SCENARIO_PRESETS = [
  {
    id: 'steady',
    name: 'Steady State',
    description: 'Flat demand (~80/day) with mild noise. Good baseline round — tests basic inventory policy tuning.',
    badge: 'Easy',
    badgeColor: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    generate() {
      const make = (count, startDay) =>
        Array.from({ length: count }, (_, i) => ({
          day: startDay + i,
          demand: clampDemand(80 + (Math.random() - 0.5) * 30),
          lead_time: 1 + Math.floor(Math.random() * 3),
          black_swan: randomBlackSwan(),
        }));
      return { historical: make(60, 1), actual: make(30, 1) };
    },
  },
  {
    id: 'seasonality',
    name: 'Seasonality',
    description: 'Strong repeating wave pattern (period ~30 days). Students must detect the cycle and plan ahead.',
    badge: 'Medium',
    badgeColor: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    generate() {
      const make = (count, startDay, dayOffset) =>
        Array.from({ length: count }, (_, i) => {
          const t = dayOffset + i;
          const wave = Math.sin((2 * Math.PI * t) / 30) * 35;
          return {
            day: startDay + i,
            demand: clampDemand(80 + wave + (Math.random() - 0.5) * 16),
            lead_time: 1 + Math.floor(Math.random() * 3),
            black_swan: randomBlackSwan(),
          };
        });
      return { historical: make(60, 1, 0), actual: make(30, 1, 60) };
    },
  },
  {
    id: 'trend_up',
    name: 'Upward Trend',
    description: 'Demand grows steadily from ~40 to ~120 over time. Tests whether policies adapt to a non-stationary mean.',
    badge: 'Medium',
    badgeColor: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    generate() {
      const slope = 1.1;
      const make = (count, startDay, dayOffset) =>
        Array.from({ length: count }, (_, i) => {
          const t = dayOffset + i;
          return {
            day: startDay + i,
            demand: clampDemand(40 + slope * t + (Math.random() - 0.5) * 24),
            lead_time: 1 + Math.floor(Math.random() * 3),
            black_swan: randomBlackSwan(),
          };
        });
      return { historical: make(60, 1, 0), actual: make(30, 1, 60) };
    },
  },
  {
    id: 'step_shift',
    name: 'Step Shift (Regime Change)',
    description: 'Demand jumps from ~60 to ~130 midway through history. Actuals stay at the new level. Exposes static policies.',
    badge: 'Hard',
    badgeColor: 'text-red-400 border-red-400/30 bg-red-400/10',
    generate() {
      const shiftDay = 35;
      const make = (count, startDay, dayOffset) =>
        Array.from({ length: count }, (_, i) => {
          const t = dayOffset + i;
          const base = t < shiftDay ? 60 : 130;
          return {
            day: startDay + i,
            demand: clampDemand(base + (Math.random() - 0.5) * 24),
            lead_time: 1 + Math.floor(Math.random() * 4),
            black_swan: randomBlackSwan(),
          };
        });
      return { historical: make(60, 1, 0), actual: make(30, 1, 60) };
    },
  },
  {
    id: 'high_volatility',
    name: 'High Volatility',
    description: 'Wild swings around a ~80 mean with occasional extreme spikes. Tests safety stock and risk tolerance.',
    badge: 'Hard',
    badgeColor: 'text-red-400 border-red-400/30 bg-red-400/10',
    generate() {
      const make = (count, startDay) =>
        Array.from({ length: count }, (_, i) => {
          const spike = Math.random() < 0.08 ? (Math.random() < 0.5 ? 80 : -40) : 0;
          return {
            day: startDay + i,
            demand: clampDemand(80 + (Math.random() - 0.5) * 80 + spike),
            lead_time: 1 + Math.floor(Math.random() * 4),
            black_swan: randomBlackSwan(),
          };
        });
      return { historical: make(60, 1), actual: make(30, 1) };
    },
  },
  {
    id: 'intermittent',
    name: 'Intermittent / Lumpy',
    description: '~40% of days have zero demand, the rest spike to 120-300. Classic hard problem in spare-parts inventory.',
    badge: 'Expert',
    badgeColor: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    generate() {
      const make = (count, startDay) =>
        Array.from({ length: count }, (_, i) => {
          const active = Math.random() > 0.4;
          return {
            day: startDay + i,
            demand: active ? clampDemand(120 + Math.random() * 180) : 0,
            lead_time: 1 + Math.floor(Math.random() * 4),
            black_swan: randomBlackSwan(),
          };
        });
      return { historical: make(60, 1), actual: make(30, 1) };
    },
  },
  {
    id: 'black_swan_storm',
    name: 'Black Swan Storm',
    description: 'Normal-ish demand but disruptions hit ~20% of days. Forces students to value insurance and contingency.',
    badge: 'Expert',
    badgeColor: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
    generate() {
      const make = (count, startDay) =>
        Array.from({ length: count }, (_, i) => ({
          day: startDay + i,
          demand: clampDemand(80 + (Math.random() - 0.5) * 40),
          lead_time: 1 + Math.floor(Math.random() * 4),
          black_swan: randomBlackSwan(0.20),
        }));
      return { historical: make(60, 1), actual: make(30, 1) };
    },
  },
];

/** Next Sunday at 00:00 local time. If today is Sunday and midnight has passed, uses the following Sunday. */
function nextSundayMidnightLocal() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  let daysToAdd = (7 - day) % 7;
  if (daysToAdd === 0) {
    d.setHours(0, 0, 0, 0);
    if (now.getTime() >= d.getTime()) {
      daysToAdd = 7;
    }
  }
  if (daysToAdd > 0) {
    d.setDate(d.getDate() + daysToAdd);
  }
  d.setHours(0, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
}

export default function Admin() {
  const { roomId, roundId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(roundId);

  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [startingInventory, setStartingInventory] = useState(100);
  const [deadline, setDeadline] = useState(nextSundayMidnightLocal);
  const [historicalJson, setHistoricalJson] = useState('[]');
  const [actualJson, setActualJson] = useState('[]');
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyClaudeDone, setCopyClaudeDone] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [previewChartData, setPreviewChartData] = useState([]);
  const [previewBoundary, setPreviewBoundary] = useState(null);
  const [roomLabel, setRoomLabel] = useState(null);
  const [loadingRound, setLoadingRound] = useState(isEdit);

  useEffect(() => {
    let cancelled = false;
    setRoomLabel(null);
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
    if (!roundId) return;
    let cancelled = false;
    setLoadingRound(true);
    (async () => {
      try {
        const rnd = await api.getRound(roundId);
        if (cancelled) return;
        if (rnd.status !== 'draft') {
          navigate(`/room/${roomId}`, { replace: true });
          return;
        }
        setCosts(rnd.costs ?? DEFAULT_COSTS);
        setStartingInventory(rnd.starting_inventory ?? 100);
        if (rnd.deadline) {
          const dt = rnd.deadline.slice(0, 16);
          setDeadline(dt);
        }
        setHistoricalJson(JSON.stringify(rnd.historical_data ?? [], null, 2));
        setActualJson(JSON.stringify(rnd.actual_data ?? [], null, 2));
      } catch (err) {
        if (!cancelled) setSubmitError(err.message || 'Failed to load round');
      } finally {
        if (!cancelled) setLoadingRound(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId, roomId, navigate]);

  const copyClaudePrompt = async () => {
    try {
      await navigator.clipboard.writeText(CLAUDE_ROUND_DATA_PROMPT);
      setCopyClaudeDone(true);
      setTimeout(() => setCopyClaudeDone(false), 2000);
    } catch {
      setCopyClaudeDone(false);
    }
  };

  const updateCost = (key, raw) => {
    const num = key === 'insurance_coverage_pct' ? parseFloat(raw) : parseFloat(raw);
    setCosts((c) => ({ ...c, [key]: Number.isFinite(num) ? num : c[key] }));
  };

  const [activePreset, setActivePreset] = useState(null);

  const applyPreset = (preset) => {
    const { historical, actual } = preset.generate();
    setHistoricalJson(JSON.stringify(historical, null, 2));
    setActualJson(JSON.stringify(actual, null, 2));
    setActivePreset(preset.id);
    setChartError(null);
  };

  useEffect(() => {
    if (!chartOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setChartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartOpen]);

  const openDemandChartPreview = () => {
    setChartError(null);
    let historical;
    let actual;
    try {
      historical = JSON.parse(historicalJson);
      actual = JSON.parse(actualJson);
    } catch {
      setChartError('Historical or actual data is not valid JSON.');
      return;
    }
    if (!Array.isArray(historical) || !Array.isArray(actual)) {
      setChartError('Historical and actual data must be JSON arrays.');
      return;
    }
    if (historical.length === 0 || actual.length === 0) {
      setChartError('Both historical and actual arrays need at least one day.');
      return;
    }
    const demandVal = (row) => {
      const n = Number(row?.demand);
      return Number.isFinite(n) ? n : null;
    };
    setPreviewChartData([
      ...historical.map((row, i) => ({
        x: i + 1,
        demandHistorical: demandVal(row),
        demandActual: null,
      })),
      ...actual.map((row, i) => ({
        x: historical.length + i + 1,
        demandHistorical: null,
        demandActual: demandVal(row),
      })),
    ]);
    setPreviewBoundary(historical.length + 0.5);
    setChartOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    let historical_data;
    let actual_data;
    try {
      historical_data = JSON.parse(historicalJson);
      actual_data = JSON.parse(actualJson);
    } catch {
      setSubmitError('Historical or actual data is not valid JSON.');
      return;
    }
    if (!Array.isArray(historical_data) || !Array.isArray(actual_data)) {
      setSubmitError('Historical and actual data must be JSON arrays.');
      return;
    }
    if (!deadline) {
      setSubmitError('Please set a deadline.');
      return;
    }

    const deadlineIso = deadline.length === 16 ? `${deadline}:00` : deadline;

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.updateRound(roundId, {
          historical_data,
          actual_data,
          costs,
          starting_inventory: Number(startingInventory),
          deadline: deadlineIso,
        });
      } else {
        await api.createRound({
          room_id: roomId,
          historical_data,
          actual_data,
          costs,
          starting_inventory: Number(startingInventory),
          deadline: deadlineIso,
        });
      }
      navigate(`/room/${roomId}`);
    } catch (err) {
      setSubmitError(err.message || (isEdit ? 'Failed to update round' : 'Failed to create round'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingRound) {
    return (
      <div className="p-6">
        <p className="text-amber-500">Loading round…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            {isEdit ? 'Edit round' : 'Create round'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Room:{' '}
            <span className="text-slate-200">{roomLabel ?? '…'}</span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
        >
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium text-amber-500">Cost parameters</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['holding_per_unit', 'Holding / unit'],
                ['stockout_penalty', 'Stockout penalty'],
                ['ordering_fixed', 'Ordering (fixed)'],
                ['per_unit_cost', 'Per-unit cost'],
                ['selling_price', 'Selling price'],
                ['insurance_premium', 'Insurance premium'],
                ['insurance_coverage_pct', 'Insurance coverage (0–1)'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-wide text-slate-400">
                    {label}
                  </label>
                  <input
                    type="number"
                    step={key === 'insurance_coverage_pct' ? '0.01' : '1'}
                    value={costs[key]}
                    onChange={(e) => updateCost(key, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="block text-sm font-medium text-amber-500">Starting inventory</label>
            <input
              type="number"
              min={0}
              value={startingInventory}
              onChange={(e) => setStartingInventory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-500">
              Submission deadline{' '}
              <span className="font-normal text-slate-500">
                (calendar — local time; defaults to next Sunday at midnight)
              </span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 [color-scheme:dark]"
            />
            <p className="mt-1 text-xs text-slate-500">
              Students must submit their policies before this date/time.
            </p>
          </div>

          <fieldset className="space-y-4">
            <legend className="text-lg font-medium text-amber-500">Scenario presets</legend>
            <p className="text-xs text-slate-500">
              Pick a preset to auto-generate 60 days of historical data + 30 days of actuals. You can still
              edit the JSON after, or paste your own.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SCENARIO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`group relative rounded-lg border p-3 text-left transition ${
                    activePreset === preset.id
                      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                      : 'border-slate-600 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100">{preset.name}</span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider ${preset.badgeColor}`}
                    >
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">
                    {preset.description}
                  </p>
                  {activePreset === preset.id && (
                    <span className="absolute right-2 top-2 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              Click again to re-roll with fresh random data for the same pattern.
            </p>
          </fieldset>

          <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-200">Or generate data with an AI assistant</p>
                <p className="mt-1 text-xs text-slate-500">
                  Paste the copied instructions into Claude (or any AI); paste the JSON it produces into the
                  fields below.
                </p>
              </div>
              <button
                type="button"
                onClick={copyClaudePrompt}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-medium text-amber-500 hover:bg-slate-700"
              >
                {copyClaudeDone ? 'Copied!' : 'Copy Claude instructions'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-amber-500">Historical data (JSON)</label>
            <p className="mt-1 text-xs text-slate-500">
              Format:{' '}
              <code className="text-slate-400">
                [{`{"day":1,"demand":100,"lead_time":2,"black_swan":null}`},…]
              </code>
            </p>
            <textarea
              value={historicalJson}
              onChange={(e) => {
                setChartError(null);
                setActivePreset(null);
                setHistoricalJson(e.target.value);
              }}
              rows={8}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-amber-500">Actual scenario (JSON)</label>
            <p className="mt-1 text-xs text-slate-500">
              Same shape as historical; typically 30 days of actuals for scoring.
            </p>
            <textarea
              value={actualJson}
              onChange={(e) => {
                setChartError(null);
                setActivePreset(null);
                setActualJson(e.target.value);
              }}
              rows={6}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              spellCheck={false}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={openDemandChartPreview}
              className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-slate-700"
            >
              Preview demand chart
            </button>
            {chartError && <p className="mt-2 text-sm text-red-400">{chartError}</p>}
          </div>

          {submitError && <p className="text-sm text-red-400">{submitError}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
            >
              {submitting
                ? (isEdit ? 'Saving…' : 'Creating…')
                : (isEdit ? 'Save changes' : 'Create round')}
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
          aria-labelledby="demand-chart-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setChartOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="demand-chart-title" className="text-lg font-semibold text-slate-100">
                  Demand preview
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Historical period (amber), then holdout actuals (sky). Vertical line marks where scoring
                  period starts.
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
            <div className="mt-4 h-72 w-full min-w-0">
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
                  <ReferenceLine
                    x={previewBoundary}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Holdout starts',
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
                    name="Actual demand"
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
