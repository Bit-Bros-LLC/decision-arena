import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { api } from '../api';

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function profitClass(v) {
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-red-400';
  return 'text-slate-400';
}

const chartTooltipStyle = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
};

export default function RoundResults() {
  const { roundId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getMyResults(roundId);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load results');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
        <p className="text-amber-500">Loading results…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
        <p className="text-red-400">{error}</p>
        <Link
          to={`/leaderboard/${roundId}`}
          className="mt-4 inline-block text-amber-500 underline hover:text-amber-400"
        >
          Back to leaderboard
        </Link>
      </div>
    );
  }

  const log = data.daily_log || [];
  const chartData = log.map((row) => ({
    day: row.day,
    daily_profit: row.daily_profit,
  }));

  const slPct = (data.service_level ?? 0) * 100;

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-100">Round results</h1>
          <Link
            to={`/leaderboard/${roundId}`}
            className="rounded-lg border border-amber-500/50 bg-slate-800 px-4 py-2 text-sm font-medium text-amber-500 transition hover:bg-slate-700"
          >
            ← Leaderboard
          </Link>
        </header>

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-medium text-amber-500">Summary</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-400">Total P&amp;L</dt>
              <dd
                className={`text-3xl font-bold tabular-nums ${profitClass(data.total_profit)}`}
              >
                {formatMoney(data.total_profit)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Service level</dt>
              <dd className="text-2xl font-semibold tabular-nums text-slate-100">
                {slPct.toFixed(1)}%
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Stockout days</dt>
              <dd className="text-2xl font-semibold tabular-nums text-slate-100">
                {data.stockout_days ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Insurance spend</dt>
              <dd className="text-2xl font-semibold tabular-nums text-slate-100">
                {formatMoney(data.insurance_spend)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Black swan hits</dt>
              <dd className="text-2xl font-semibold tabular-nums text-slate-100">
                {data.black_swan_hits ?? 0}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-medium text-amber-500">Daily P&amp;L</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => formatMoney(value)}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Bar dataKey="daily_profit" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.day}
                      fill={entry.daily_profit >= 0 ? '#34d399' : '#f87171'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-medium text-amber-500">Highlights</h2>
          {Array.isArray(data.highlights) && data.highlights.length > 0 ? (
            <ul className="list-inside list-disc space-y-2 text-slate-300">
              {data.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">No highlights recorded.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-medium text-amber-500">Daily log</h2>
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-900/95 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Demand</th>
                  <th className="px-3 py-2">Sold</th>
                  <th className="px-3 py-2">Missed</th>
                  <th className="px-3 py-2">Ordered</th>
                  <th className="px-3 py-2">Inventory</th>
                  <th className="px-3 py-2">P&amp;L</th>
                  <th className="px-3 py-2">Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {log.map((row) => (
                  <tr key={row.day} className="hover:bg-slate-700/40">
                    <td className="px-3 py-2 tabular-nums text-slate-200">{row.day}</td>
                    <td className="px-3 py-2 tabular-nums">{row.demand}</td>
                    <td className="px-3 py-2 tabular-nums">{row.sold}</td>
                    <td className="px-3 py-2 tabular-nums">{row.unfulfilled}</td>
                    <td className="px-3 py-2 tabular-nums">{row.ordered}</td>
                    <td className="px-3 py-2 tabular-nums">{row.inventory_end}</td>
                    <td
                      className={`px-3 py-2 tabular-nums font-medium ${profitClass(row.daily_profit)}`}
                    >
                      {formatMoney(row.daily_profit)}
                    </td>
                    <td className="px-3 py-2 text-amber-500/90">
                      {row.black_swan_event ? String(row.black_swan_event) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
