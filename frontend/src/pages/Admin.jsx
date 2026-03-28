import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

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

export default function Admin() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [roundNumber, setRoundNumber] = useState(1);
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [startingInventory, setStartingInventory] = useState(100);
  const [deadline, setDeadline] = useState('');
  const [historicalJson, setHistoricalJson] = useState('[]');
  const [actualJson, setActualJson] = useState('[]');
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
        round_number: Number(roundNumber),
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
    <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-100">Create round</h1>
          <p className="mt-1 text-sm text-slate-400">Room: {roomId}</p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
        >
          <div>
            <label className="block text-sm font-medium text-amber-500">Round number</label>
            <input
              type="number"
              min={1}
              value={roundNumber}
              onChange={(e) => setRoundNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

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
            <label className="block text-sm font-medium text-amber-500">Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
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
              onChange={(e) => setHistoricalJson(e.target.value)}
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
              onChange={(e) => setActualJson(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              spellCheck={false}
            />
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
      </div>
    </div>
  );
}
