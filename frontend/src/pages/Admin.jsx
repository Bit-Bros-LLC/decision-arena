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

function randomBlackSwan() {
  if (Math.random() > 0.06) return null;
  const types = ['supplier_failure', 'demand_spike', 'warehouse_damage', 'cost_shock'];
  return { type: types[Math.floor(Math.random() * types.length)], note: 'sample' };
}

function generateHistoricalDays(count) {
  const rows = [];
  for (let day = 1; day <= count; day++) {
    const wave = Math.sin(day / 6) * 18;
    const demand = Math.max(10, Math.round(55 + Math.random() * 70 + wave));
    const lead_time = 1 + Math.floor(Math.random() * 4);
    rows.push({ day, demand, lead_time, black_swan: randomBlackSwan() });
  }
  return rows;
}

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
  const { roomId } = useParams();
  const navigate = useNavigate();

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

  const fillHistoricalSample = () => {
    setHistoricalJson(JSON.stringify(generateHistoricalDays(60), null, 2));
  };

  const fillActualSample = () => {
    setActualJson(JSON.stringify(generateHistoricalDays(30), null, 2));
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
      await api.createRound({
        room_id: roomId,
        historical_data,
        actual_data,
        costs,
        starting_inventory: Number(startingInventory),
        deadline: deadlineIso,
      });
      navigate(`/room/${roomId}`);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create round');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Create round</h1>
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

          <div className="rounded-lg border border-slate-600 bg-slate-900/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-200">Generate data with an assistant</p>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-amber-500">Historical data (JSON)</label>
              <button
                type="button"
                onClick={fillHistoricalSample}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-slate-700"
              >
                Generate sample data (60 days)
              </button>
            </div>
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
                setHistoricalJson(e.target.value);
              }}
              rows={8}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              spellCheck={false}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-medium text-amber-500">Actual scenario (JSON)</label>
              <button
                type="button"
                onClick={fillActualSample}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-500 hover:bg-slate-700"
              >
                Generate sample actuals (30 days)
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Same shape as historical; typically 30 days of actuals for scoring.
            </p>
            <textarea
              value={actualJson}
              onChange={(e) => {
                setChartError(null);
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
              {submitting ? 'Creating…' : 'Create round'}
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
