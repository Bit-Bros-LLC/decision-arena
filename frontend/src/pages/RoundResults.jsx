import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Legend,
} from 'recharts';
import { api, getUser } from '../api';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';

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
  const user = getUser();
  const [data, setData] = useState(null);
  const [round, setRound] = useState(null);
  const [season, setSeason] = useState(null);
  const [isSoloSeasonRound, setIsSoloSeasonRound] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [undoBusy, setUndoBusy] = useState(false);
  const [roomCrumbName, setRoomCrumbName] = useState(null);

  const roomIdForCrumb = season?.room_id || round?.room_id;

  useEffect(() => {
    if (!roomIdForCrumb) {
      setRoomCrumbName(null);
      return;
    }
    let cancelled = false;
    api
      .getRooms()
      .then((list) => {
        const found = list.find((r) => r.id === roomIdForCrumb);
        if (!cancelled) setRoomCrumbName(found?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setRoomCrumbName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomIdForCrumb]);

  const breadcrumbResultsConfig = useMemo(() => {
    if (!round) return { labels: {}, afterDashboard: [] };
    const rn = round.round_number;
    const roundPolicy = typeof rn === 'number' ? `Round ${rn} · Policy` : 'Policy';
    return {
      labels: { roundPolicy },
      afterDashboard:
        roomIdForCrumb && roomCrumbName
          ? [{ label: roomCrumbName, to: `/room/${roomIdForCrumb}` }]
          : [],
    };
  }, [round, roomIdForCrumb, roomCrumbName]);

  useBreadcrumbLabels(breadcrumbResultsConfig);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [res, roundRes] = await Promise.all([
          api.getMyResults(roundId),
          api.getRound(roundId),
        ]);
        if (!cancelled) setData(res);
        if (!cancelled) setRound(roundRes);
        if (!cancelled && roundRes?.season_id) {
          try {
            const seasonRes = await api.getSeason(roundRes.season_id);
            if (!cancelled) setSeason(seasonRes);
            const isSolo =
              seasonRes?.owner_user_id === user?.user_id &&
              (seasonRes?.season_scope === 'sandbox' || Boolean(seasonRes?.source_template_id));
            setIsSoloSeasonRound(Boolean(isSolo));
          } catch {
            setIsSoloSeasonRound(false);
            setSeason(null);
          }
        } else if (!cancelled) {
          setIsSoloSeasonRound(false);
          setSeason(null);
        }
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
      <div className="p-6">
        <p className="text-amber-500">Loading results…</p>
      </div>
    );
  }

  if (error) {
    const showLeaderboardFromError =
      !isSoloSeasonRound || (season && season.season_scope === 'room');
    return (
      <div className="p-6">
        <p className="text-red-400">{error}</p>
        {showLeaderboardFromError && (
          <Link
            to={`/leaderboard/${roundId}`}
            className="mt-4 inline-block text-amber-500 underline hover:text-amber-400"
          >
            Back to leaderboard
          </Link>
        )}
      </div>
    );
  }

  const log = data.daily_log || [];
  const chartData = log.map((row) => ({
    day: row.day,
    daily_profit: row.daily_profit,
  }));
  const historical = Array.isArray(round?.historical_data) ? round.historical_data : [];
  const actual = Array.isArray(round?.actual_data) ? round.actual_data : [];
  const scenarioChartData = [
    ...historical.map((row, i) => ({
      x: i + 1,
      demandHistorical: Number.isFinite(Number(row?.demand)) ? Number(row.demand) : null,
      demandActual: null,
    })),
    ...actual.map((row, i) => ({
      x: historical.length + i + 1,
      demandHistorical: null,
      demandActual: Number.isFinite(Number(row?.demand)) ? Number(row.demand) : null,
    })),
  ];
  const scenarioBoundary = historical.length + 0.5;

  const slPct = (data.service_level ?? 0) * 100;
  const isClassSeason = season?.season_scope === 'room';
  const seasonTarget =
    season?.id && season?.room_id
      ? `/room/${season.room_id}/season/${season.id}`
      : season?.id
        ? `/season-sprint/${season.id}`
        : null;
  const latestScoredRoundNumber = Array.isArray(season?.rounds)
    ? season.rounds
        .filter((r) => r.status === 'scored')
        .reduce((max, r) => Math.max(max, Number(r.round_number) || 0), 0)
    : 0;
  const canUndoScore =
    isSoloSeasonRound &&
    round?.status === 'scored' &&
    Number(round?.round_number) === latestScoredRoundNumber &&
    !undoBusy;

  const handleUndoScore = async () => {
    if (!season?.id) return;
    if (!window.confirm('Undo scoring for this round and reopen it for policy edits?')) return;
    setUndoBusy(true);
    setError(null);
    try {
      await api.undoLatestSeasonAdvance(season.id);
      window.location.href = `/round/${roundId}`;
    } catch (e) {
      setError(e.message || 'Could not undo scoring');
    } finally {
      setUndoBusy(false);
    }
  };

  return (
    <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-100">Round results</h1>
          <div className="flex flex-wrap items-center gap-2">
            {canUndoScore && (
              <button
                type="button"
                onClick={handleUndoScore}
                disabled={undoBusy}
                className="rounded-lg border border-red-500/50 bg-slate-800 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-slate-700 disabled:opacity-40"
              >
                {undoBusy ? 'Undoing…' : 'Undo Score'}
              </button>
            )}
            {seasonTarget && (
              <Link
                to={seasonTarget}
                className="rounded-lg border border-emerald-500/50 bg-slate-800 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-slate-700"
              >
                Back to season rounds
              </Link>
            )}
            {round?.season_id && isClassSeason && (
              <Link
                to={`/leaderboard/season/${round.season_id}`}
                className="rounded-lg border border-slate-500/50 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Season standings
              </Link>
            )}
            {(!round?.season_id || isClassSeason) && (
              <Link
                to={`/leaderboard/${roundId}`}
                className="rounded-lg border border-amber-500/50 bg-slate-800 px-4 py-2 text-sm font-medium text-amber-500 transition hover:bg-slate-700"
              >
                Round leaderboard
              </Link>
            )}
          </div>
        </div>

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
              <dt className="text-sm text-slate-400">Dual-source spend</dt>
              <dd className="text-2xl font-semibold tabular-nums text-slate-100">
                {formatMoney(data.dual_source_spend)}
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
          <h2 className="mb-4 text-lg font-medium text-amber-500">Scenario review</h2>
          <p className="mb-4 text-xs text-slate-500">
            Historical period (amber) and scored period (sky), plus the exact data used for this round.
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scenarioChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="x" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
                <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(label) => `Day ${label}`} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                <ReferenceLine
                  x={scenarioBoundary}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{ value: 'Scored period starts', position: 'top', fill: '#94a3b8', fontSize: 11 }}
                />
                <Line type="monotone" dataKey="demandHistorical" name="Historical demand" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls={false} />
                <Line type="monotone" dataKey="demandActual" name="Actual demand" stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <details className="group rounded-lg border border-slate-700 bg-slate-900/40">
              <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 marker:content-none">
                <span>Historical data</span>
                <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
              </summary>
              <pre className="max-h-56 overflow-auto border-t border-slate-700 p-3 text-xs text-slate-300">
                {JSON.stringify(historical, null, 2)}
              </pre>
            </details>
            <details className="group rounded-lg border border-slate-700 bg-slate-900/40">
              <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 marker:content-none">
                <span>Actual scored data</span>
                <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
              </summary>
              <pre className="max-h-56 overflow-auto border-t border-slate-700 p-3 text-xs text-slate-300">
                {JSON.stringify(actual, null, 2)}
              </pre>
            </details>
          </div>
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
        {seasonTarget && (
          <div className="flex justify-end">
            <Link
              to={seasonTarget}
              className="rounded-lg border border-emerald-500/50 bg-slate-800 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-slate-700"
            >
              Back to season rounds
            </Link>
          </div>
        )}
    </div>
  );
}
