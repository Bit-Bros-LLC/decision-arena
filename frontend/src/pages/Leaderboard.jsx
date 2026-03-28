import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api, getUser } from '../api';

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

function MiniProfitSpark({ values }) {
  const data = (values || []).map((v, i) => ({ i, v }));
  if (!data.length) {
    return <span className="text-slate-500">—</span>;
  }
  return (
    <div className="h-10 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="i" hide />
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '12px',
            }}
            formatter={(val) => formatMoney(val)}
            labelFormatter={() => 'Day'}
          />
          <Bar dataKey="v" maxBarSize={4}>
            {data.map((entry) => (
              <Cell key={entry.i} fill={entry.v >= 0 ? '#34d399' : '#f87171'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TabButton({ active, children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-amber-500 text-slate-900'
          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}

export default function Leaderboard() {
  const params = useParams();
  const navigate = useNavigate();
  const roundId = params.roundId;
  const seasonRoomId = params.roomId;

  /** Season route is `/leaderboard/season/:roomId` (only `roomId` in params). */
  const isSeasonRoute = Boolean(seasonRoomId);

  const [roundRows, setRoundRows] = useState(null);
  const [seasonPayload, setSeasonPayload] = useState(null);
  const [roomIdForSeason, setRoomIdForSeason] = useState(seasonRoomId || null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const me = getUser();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (isSeasonRoute && seasonRoomId) {
          const s = await api.getSeasonLeaderboard(seasonRoomId);
          if (!cancelled) {
            setSeasonPayload(s);
            setRoundRows(null);
          }
        } else if (roundId) {
          const [lb, rnd] = await Promise.all([
            api.getRoundLeaderboard(roundId),
            api.getRound(roundId),
          ]);
          if (!cancelled) {
            setRoundRows(lb);
            setRoomIdForSeason(rnd?.room_id ?? null);
            setSeasonPayload(null);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load leaderboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId, seasonRoomId, isSeasonRoute]);

  const defaultRoundIdFromSeason = useMemo(() => {
    const rounds = seasonPayload?.rounds;
    if (!rounds?.length) return null;
    return rounds[rounds.length - 1].id;
  }, [seasonPayload]);

  const seasonColumns = seasonPayload?.rounds ?? [];

  const goRoundTab = () => {
    if (roundId && !isSeasonRoute) {
      navigate(`/leaderboard/${roundId}`);
      return;
    }
    if (defaultRoundIdFromSeason) {
      navigate(`/leaderboard/${defaultRoundIdFromSeason}`);
    }
  };

  const goSeasonTab = () => {
    const rid = roomIdForSeason || seasonRoomId;
    if (!rid) return;
    navigate(`/leaderboard/season/${rid}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-slate-200">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-100">Leaderboard</h1>
          <div className="flex gap-2">
            <TabButton
              active={!isSeasonRoute}
              onClick={goRoundTab}
              disabled={isSeasonRoute && !defaultRoundIdFromSeason}
            >
              Round
            </TabButton>
            <TabButton
              active={isSeasonRoute}
              onClick={goSeasonTab}
              disabled={!isSeasonRoute && !roomIdForSeason && !seasonRoomId}
            >
              Season
            </TabButton>
          </div>
        </header>

        {loading && <p className="text-amber-500">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && !isSeasonRoute && roundRows && (
          <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 shadow-lg">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Profit</th>
                  <th className="px-4 py-3">Service level</th>
                  <th className="px-4 py-3">Stockouts</th>
                  <th className="px-4 py-3">Insurance</th>
                  <th className="px-4 py-3">Daily P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {roundRows.map((row) => {
                  const highlight =
                    me && row.is_me ? 'bg-amber-500/15 ring-1 ring-amber-500/40' : '';
                  const sl = (row.service_level ?? 0) * 100;
                  return (
                    <tr key={row.user_id} className={highlight}>
                      <td className="px-4 py-3 tabular-nums font-medium text-slate-300">
                        {row.rank}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {row.display_name}
                        {row.is_me && (
                          <span className="ml-2 text-xs font-semibold text-amber-500">(you)</span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums font-semibold ${profitClass(row.total_profit)}`}
                      >
                        {formatMoney(row.total_profit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{sl.toFixed(1)}%</td>
                      <td className="px-4 py-3 tabular-nums">{row.stockout_days}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(row.insurance_spend)}</td>
                      <td className="px-4 py-3">
                        <MiniProfitSpark values={row.daily_profits} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && isSeasonRoute && seasonPayload && (
          <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800 shadow-lg">
            {seasonColumns.length === 0 ? (
              <p className="p-6 text-slate-400">No scored rounds in this room yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-800 px-4 py-3">Rank</th>
                    <th className="sticky left-12 z-10 bg-slate-800 px-4 py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]">
                      Student
                    </th>
                    {seasonColumns.map((r) => (
                      <th key={r.id} className="px-4 py-3 whitespace-nowrap">
                        R{r.round_number}
                      </th>
                    ))}
                    <th className="px-4 py-3 whitespace-nowrap text-amber-500">Season total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {(seasonPayload.standings || []).map((row) => {
                    const highlight =
                      me && row.is_me ? 'bg-amber-500/15 ring-1 ring-amber-500/40' : '';
                    return (
                      <tr key={row.user_id} className={highlight}>
                        <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 tabular-nums font-medium">
                          {row.rank}
                        </td>
                        <td className="sticky left-12 z-10 bg-slate-800 px-4 py-3 font-medium text-slate-100 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)]">
                          {row.display_name}
                          {row.is_me && (
                            <span className="ml-2 text-xs font-semibold text-amber-500">(you)</span>
                          )}
                        </td>
                        {seasonColumns.map((r) => {
                          const cell = row.rounds?.[r.id];
                          const p = cell?.profit;
                          return (
                            <td
                              key={r.id}
                              className={`px-4 py-3 tabular-nums ${profitClass(p)}`}
                            >
                              {p != null ? formatMoney(p) : '—'}
                            </td>
                          );
                        })}
                        <td
                          className={`px-4 py-3 tabular-nums font-semibold ${profitClass(row.season_total)}`}
                        >
                          {formatMoney(row.season_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
