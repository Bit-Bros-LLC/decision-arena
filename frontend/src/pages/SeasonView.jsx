import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getUser } from '../api';

function formatDeadline(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function statusColor(status) {
  if (status === 'active') return 'text-amber-400';
  if (status === 'scored') return 'text-emerald-400';
  return 'text-slate-400';
}

export default function SeasonView() {
  const { roomId, seasonId } = useParams();
  const user = getUser();
  const isProfessor = user?.role === 'professor';

  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [myState, setMyState] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await api.getSeason(seasonId);
      setSeason(s);
      try {
        const state = await api.getSeasonState(seasonId);
        setMyState(state);
      } catch {
        setMyState(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load season');
      setSeason(null);
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.activateSeason(seasonId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not activate season');
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async () => {
    if (!window.confirm('Score the current round and advance to the next? Students without a contract-update signal will inherit their last policy.')) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.advanceSeason(seasonId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not advance');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-amber-500">Loading season…</p>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error || 'Season not found.'}</p>
      </div>
    );
  }

  const activeRound = season.rounds.find((r) => r.status === 'active');
  const scoredCount = season.rounds.filter((r) => r.status === 'scored').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/room/${roomId}`} className="text-xs text-slate-400 hover:text-amber-400">
            ← Back to room
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
            {season.name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Preset: <span className="text-slate-200">{season.scenario_preset}</span> ·{' '}
            {season.total_rounds} rounds · {season.round_duration_days} days each ·{' '}
            {season.contract_updates_allowed} contract updates allowed
          </p>
          <p className="mt-1 text-sm">
            Status:{' '}
            <span className={statusColor(season.status)}>{season.status}</span> ·{' '}
            {scoredCount} of {season.total_rounds} rounds scored
          </p>
        </div>
        {isProfessor && (
          <div className="flex flex-wrap gap-2">
            {season.status === 'draft' && (
              <button
                type="button"
                disabled={busy}
                onClick={handleActivate}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Starting…' : 'Start season'}
              </button>
            )}
            {season.status === 'active' && (
              <button
                type="button"
                disabled={busy || !activeRound}
                onClick={handleAdvance}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {busy ? 'Advancing…' : `Score & advance (Round ${activeRound?.round_number ?? '?'})`}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {!isProfessor && myState && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-500">
            Your contract updates
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            <span className="font-mono text-amber-400">
              {myState.contract_updates_remaining}
            </span>{' '}
            of {myState.contract_updates_allowed} remaining ({myState.contract_updates_used} used)
          </p>
          {myState.active_round_id && (
            <p className="mt-2 text-xs text-slate-400">
              {myState.next_round_id
                ? myState.next_round_signaled
                  ? 'You have unlocked the next round for editing.'
                  : 'Signal a contract update during the active round to unlock editing in the next one.'
                : 'Last round of the season — no more contract updates possible.'}
            </p>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-medium text-slate-100">Rounds</h2>
        <ul className="space-y-3">
          {season.rounds.map((r) => (
            <li
              key={r.id}
              className={`rounded-xl border p-4 shadow-md ${
                r.status === 'active'
                  ? 'border-amber-500/40 bg-slate-800'
                  : r.status === 'scored'
                    ? 'border-emerald-500/30 bg-slate-800/70'
                    : 'border-dashed border-slate-600 bg-slate-800/50'
              }`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    Round {r.round_number}
                    {r.locked_for_updates && r.status !== 'scored' && (
                      <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs font-normal text-slate-400">
                        Locked by default
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Status: <span className={statusColor(r.status)}>{r.status}</span> · Deadline:{' '}
                    {formatDeadline(r.deadline)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === 'active' && (
                    <Link
                      to={`/round/${r.id}`}
                      className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                    >
                      Policy editor
                    </Link>
                  )}
                  {r.status === 'scored' && (
                    <>
                      <Link
                        to={`/round/${r.id}/results`}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        Results
                      </Link>
                      <Link
                        to={`/leaderboard/${r.id}`}
                        className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                      >
                        Leaderboard
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
