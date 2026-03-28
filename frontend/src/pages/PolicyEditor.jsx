import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { api, getUser } from '../api';

const TEMPLATES = [
  { id: 'order_up_to', label: 'Order Up To' },
  { id: 'service_level', label: 'Service Level' },
  { id: 'reorder_point', label: 'Reorder Point' },
];

const SERVICE_LEVELS = [0.85, 0.9, 0.95, 0.97, 0.99];
const INSURANCE_MODES = ['never', 'always', 'conditional'];

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function defaultConfig(policyType) {
  switch (policyType) {
    case 'order_up_to':
      return { target_level: 200, insurance_mode: 'never' };
    case 'service_level':
      return {
        target_service_level: 0.95,
        lookback_days: 14,
        insurance_mode: 'never',
      };
    case 'reorder_point':
      return {
        reorder_point: 120,
        order_quantity: 150,
        insurance_mode: 'never',
      };
    default:
      return {};
  }
}

export default function PolicyEditor() {
  const { roundId } = useParams();
  const user = getUser();

  const [round, setRound] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [policyType, setPolicyType] = useState('order_up_to');
  const [config, setConfig] = useState(() => defaultConfig('order_up_to'));
  const [policyLoaded, setPolicyLoaded] = useState(false);

  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestError, setBacktestError] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const [submitMsg, setSubmitMsg] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [r, pol] = await Promise.all([
          api.getRound(roundId),
          api.getMyPolicy(roundId),
        ]);
        if (cancelled) return;
        setRound(r);
        if (pol && pol.policy_type && pol.config) {
          setPolicyType(pol.policy_type);
          setConfig({ ...defaultConfig(pol.policy_type), ...pol.config });
        }
        setPolicyLoaded(true);
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load round');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const historical = round?.historical_data || [];
  const costs = round?.costs || {};

  const demandStats = useMemo(() => {
    const demands = historical.map((d) => d.demand).filter((x) => typeof x === 'number');
    const lts = historical.map((d) => d.lead_time).filter((x) => typeof x === 'number');
    return {
      avgDemand: mean(demands),
      stdDemand: stdDev(demands),
      minD: demands.length ? Math.min(...demands) : 0,
      maxD: demands.length ? Math.max(...demands) : 0,
      avgLt: mean(lts),
    };
  }, [historical]);

  const leadTimeBuckets = useMemo(() => {
    const counts = {};
    historical.forEach((d) => {
      const lt = d.lead_time;
      if (lt == null) return;
      counts[lt] = (counts[lt] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([lead_time, count]) => ({
        lead_time: `LT ${lead_time}`,
        count,
        _sort: Number(lead_time),
      }))
      .sort((a, b) => a._sort - b._sort)
      .map(({ lead_time, count }) => ({ lead_time, count }));
  }, [historical]);

  const lineData = useMemo(
    () =>
      historical.map((d) => ({
        day: d.day,
        demand: d.demand,
      })),
    [historical],
  );

  const updateConfig = useCallback((patch) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  const onTemplateChange = (id) => {
    setPolicyType(id);
    setConfig(defaultConfig(id));
    setBacktestResult(null);
    setBacktestError(null);
  };

  const runBacktest = async () => {
    setBacktestError(null);
    setBacktestLoading(true);
    try {
      const result = await api.backtest({
        round_id: roundId,
        policy_type: policyType,
        config,
      });
      setBacktestResult(result);
    } catch (e) {
      setBacktestResult(null);
      setBacktestError(e.message || 'Backtest failed');
    } finally {
      setBacktestLoading(false);
    }
  };

  const submitPolicy = async () => {
    setSubmitMsg(null);
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await api.savePolicy({
        round_id: roundId,
        policy_type: policyType,
        config,
      });
      setSubmitMsg(res?.message || 'Policy saved.');
    } catch (e) {
      setSubmitError(e.message || 'Submit failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const barProfitData = useMemo(() => {
    if (!backtestResult?.daily_log?.length) return [];
    return backtestResult.daily_log.map((d) => ({
      day: d.day,
      daily_profit: d.daily_profit,
    }));
  }, [backtestResult]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
        <p className="text-red-400">{loadError}</p>
      </div>
    );
  }

  if (!round && !loadError) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
        <p className="text-amber-500">Loading round…</p>
      </div>
    );
  }

  const roundActive = round.status === 'active';
  const canEdit = user && roundActive;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="border-b border-slate-800 bg-slate-800/80 px-4 py-4 md:px-6">
        <h1 className="text-xl font-semibold text-slate-100">
          Policy designer
          {round && (
            <span className="ml-2 text-base font-normal text-slate-400">
              · Round {round.round_number}
            </span>
          )}
        </h1>
        {!roundActive && (
          <p className="mt-2 text-sm text-amber-500/90">
            This round is scored; policy edits are closed.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6 p-4 lg:flex-row lg:items-start lg:gap-4 lg:p-6">
        {/* LEFT — Historical */}
        <section className="flex w-full flex-col rounded-xl border border-slate-700 bg-slate-800 p-4 lg:min-w-0 lg:flex-[1]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Historical data
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:text-sm">
            <Stat label="Avg demand" value={demandStats.avgDemand.toFixed(1)} />
            <Stat label="Std dev" value={demandStats.stdDemand.toFixed(2)} />
            <Stat label="Min / Max" value={`${demandStats.minD} / ${demandStats.maxD}`} />
            <Stat label="Avg lead time" value={demandStats.avgLt.toFixed(2)} />
          </div>

          <div className="mt-4 h-56 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="demand"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-4 text-xs font-medium text-slate-400">Lead time (days in sample)</h3>
          {leadTimeBuckets.length > 0 ? (
            <div className="mt-2 h-36 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTimeBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="lead_time" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No lead time data.</p>
          )}

          <h3 className="mt-4 text-xs font-medium text-slate-400">Cost parameters</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <CostRow label="Holding / unit" v={costs.holding_per_unit} />
            <CostRow label="Stockout penalty" v={costs.stockout_penalty} />
            <CostRow label="Ordering (fixed)" v={costs.ordering_fixed} />
            <CostRow label="Per-unit cost" v={costs.per_unit_cost} />
            <CostRow label="Selling price" v={costs.selling_price} />
            <CostRow label="Insurance premium" v={costs.insurance_premium} />
            {costs.insurance_coverage_pct != null && (
              <CostRow
                label="Insurance coverage"
                v={`${(Number(costs.insurance_coverage_pct) * 100).toFixed(0)}%`}
              />
            )}
          </ul>
        </section>

        {/* CENTER — Policy */}
        <section className="flex w-full flex-col rounded-xl border border-slate-700 bg-slate-800 p-4 lg:min-w-0 lg:flex-[1]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Policy designer
          </h2>
          {!policyLoaded && (
            <p className="mb-2 text-xs text-slate-500">Loading your saved policy…</p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  policyType === t.id
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="policy_template"
                  className="sr-only"
                  checked={policyType === t.id}
                  onChange={() => onTemplateChange(t.id)}
                  disabled={!canEdit}
                />
                <span className="text-sm font-medium text-slate-100">{t.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">
            {policyType === 'order_up_to' && (
              <>
                <RangeField
                  label="Target level (S)"
                  min={50}
                  max={500}
                  step={10}
                  value={config.target_level ?? 200}
                  onChange={(v) => updateConfig({ target_level: v })}
                  disabled={!canEdit}
                />
                <SelectField
                  label="Insurance mode"
                  value={config.insurance_mode || 'never'}
                  options={INSURANCE_MODES}
                  onChange={(v) => updateConfig({ insurance_mode: v })}
                  disabled={!canEdit}
                />
              </>
            )}
            {policyType === 'service_level' && (
              <>
                <SelectField
                  label="Target service level"
                  value={String(config.target_service_level ?? 0.95)}
                  options={SERVICE_LEVELS.map(String)}
                  formatOption={(o) => `${(Number(o) * 100).toFixed(0)}%`}
                  onChange={(v) => updateConfig({ target_service_level: Number(v) })}
                  disabled={!canEdit}
                />
                <RangeField
                  label="Lookback days"
                  min={7}
                  max={30}
                  step={1}
                  value={config.lookback_days ?? 14}
                  onChange={(v) => updateConfig({ lookback_days: v })}
                  disabled={!canEdit}
                />
                <SelectField
                  label="Insurance mode"
                  value={config.insurance_mode || 'never'}
                  options={INSURANCE_MODES}
                  onChange={(v) => updateConfig({ insurance_mode: v })}
                  disabled={!canEdit}
                />
              </>
            )}
            {policyType === 'reorder_point' && (
              <>
                <RangeField
                  label="Reorder point (s)"
                  min={20}
                  max={300}
                  step={5}
                  value={config.reorder_point ?? 120}
                  onChange={(v) => updateConfig({ reorder_point: v })}
                  disabled={!canEdit}
                />
                <RangeField
                  label="Order quantity (Q)"
                  min={50}
                  max={400}
                  step={10}
                  value={config.order_quantity ?? 150}
                  onChange={(v) => updateConfig({ order_quantity: v })}
                  disabled={!canEdit}
                />
                <SelectField
                  label="Insurance mode"
                  value={config.insurance_mode || 'never'}
                  options={INSURANCE_MODES}
                  onChange={(v) => updateConfig({ insurance_mode: v })}
                  disabled={!canEdit}
                />
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runBacktest}
              disabled={!user || backtestLoading}
              className="rounded-lg border border-amber-500/50 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-amber-500/10 disabled:opacity-40"
            >
              {backtestLoading ? 'Running…' : 'Run Backtest'}
            </button>
            <button
              type="button"
              onClick={submitPolicy}
              disabled={!canEdit || submitLoading}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
            >
              {submitLoading ? 'Saving…' : 'Submit Policy'}
            </button>
          </div>
          {backtestError && (
            <p className="mt-2 text-sm text-red-400">{backtestError}</p>
          )}
          {submitError && <p className="mt-2 text-sm text-red-400">{submitError}</p>}
          {submitMsg && (
            <p className="mt-2 text-sm text-emerald-400" role="status">
              {submitMsg}
            </p>
          )}
        </section>

        {/* RIGHT — Backtest */}
        <section className="flex w-full flex-col rounded-xl border border-slate-700 bg-slate-800 p-4 lg:min-w-0 lg:flex-[1]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Backtest results
          </h2>
          {!backtestResult ? (
            <p className="rounded-lg border border-dashed border-slate-600 bg-slate-900/50 p-6 text-center text-sm text-slate-500">
              Run a backtest to see results
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Total profit</p>
                  <p className="text-lg font-semibold text-amber-400">
                    ${Number(backtestResult.total_profit).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Service level</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {(Number(backtestResult.service_level) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Stockout days</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {backtestResult.stockout_days}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barProfitData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="daily_profit" radius={[2, 2, 0, 0]}>
                      {barProfitData.map((entry) => (
                        <Cell
                          key={entry.day}
                          fill={entry.daily_profit >= 0 ? '#22c55e' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {Array.isArray(backtestResult.highlights) &&
                backtestResult.highlights.length > 0 && (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {backtestResult.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-900/80 px-2 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-100">{value}</p>
    </div>
  );
}

function CostRow({ label, v }) {
  if (v === undefined || v === null) return null;
  const display = typeof v === 'number' ? v.toLocaleString() : String(v);
  return (
    <li className="flex justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-200">{display}</span>
    </li>
  );
}

function RangeField({ label, min, max, step, value, onChange, disabled }) {
  return (
    <div>
      <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-amber-400">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-amber-500 disabled:opacity-40"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
  formatOption,
}) {
  return (
    <div>
      <label className="block text-sm text-slate-300">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none disabled:opacity-40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {formatOption ? formatOption(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}
