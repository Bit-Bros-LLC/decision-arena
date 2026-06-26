import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getUser } from '../api';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import Narrative from '../components/Narrative';
import StoryNews from '../components/StoryNews';

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
  const [undoBusy, setUndoBusy] = useState(false);
  const [myState, setMyState] = useState(null);
  const [roundProfitById, setRoundProfitById] = useState({});
  const [roomDisplayName, setRoomDisplayName] = useState(null);

  useEffect(() => {
    if (!roomId) {
      setRoomDisplayName(null);
      return;
    }
    let cancelled = false;
    api
      .getRooms()
      .then((list) => {
        const found = list.find((r) => r.id === roomId);
        if (!cancelled) setRoomDisplayName(found?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setRoomDisplayName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useBreadcrumbLabels({
    labels: {
      ...(roomId && roomDisplayName ? { room: roomDisplayName } : {}),
      ...(season?.name ? { season: season.name } : {}),
    },
  });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const s = await api.getSeason(seasonId);
      setSeason(s);
      const scoredRounds = Array.isArray(s?.rounds)
        ? s.rounds.filter((r) => r.status === 'scored')
        : [];
      if (scoredRounds.length > 0) {
        const settled = await Promise.all(
          scoredRounds.map((r) =>
            api
              .getMyResults(r.id)
              .then((res) => [r.id, Number(res?.total_profit)])
              .catch(() => [r.id, null]),
          ),
        );
        setRoundProfitById(Object.fromEntries(settled));
      } else {
        setRoundProfitById({});
      }
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
    const isSoloOwnerSeason =
      season?.owner_user_id === user?.user_id &&
      (season?.season_scope === 'sandbox' || Boolean(season?.source_template_id));

    if (isSoloOwnerSeason && activeRound?.id) {
      let hasPolicy = false;
      try {
        const policy = await api.getMyPolicy(activeRound.id);
        hasPolicy = Boolean(policy);
      } catch {
        hasPolicy = false;
      }
      if (!hasPolicy) {
        const proceed = window.confirm(
          `Round ${activeRound.round_number} has no policy submitted. Continuing will score this round without your policy and then advance. Continue anyway?`,
        );
        if (!proceed) return;
      }
    } else {
      if (!window.confirm('Score the current round and advance to the next?')) {
        return;
      }
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

  const handleUndoLatestScore = async () => {
    if (!window.confirm('Undo the latest scored round and reopen it for editing?')) {
      return;
    }
    setUndoBusy(true);
    setError(null);
    try {
      await api.undoLatestSeasonAdvance(seasonId);
      await load();
    } catch (err) {
      setError(err.message || 'Could not undo latest score');
    } finally {
      setUndoBusy(false);
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
  const latestScoredRoundNumber = season.rounds
    .filter((r) => r.status === 'scored')
    .reduce((max, r) => Math.max(max, Number(r.round_number) || 0), 0);
  const isPrivateSoloSeason = season.season_scope === 'sandbox';
  const isClassSeason = season.season_scope === 'room';
  const canManageSeason = isProfessor || isPrivateSoloSeason;
  const canUndoLatestSoloScore =
    season.owner_user_id === user?.user_id &&
    (season.season_scope === 'sandbox' || Boolean(season.source_template_id)) &&
    latestScoredRoundNumber > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
              {season.name}
            </h1>
            {isClassSeason && (
              <Link
                to={`/leaderboard/season/${seasonId}`}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-amber-400 transition hover:border-amber-500/50 hover:bg-slate-700"
              >
                Season standings
              </Link>
            )}
          </div>
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
        {canManageSeason && (
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

      {(season.narrative || (season.news && season.news.length > 0)) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {season.narrative && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-500">
                The story so far
              </h2>
              <Narrative text={season.narrative} className="mt-2" />
            </div>
          )}
          {season.news && season.news.length > 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-500">
                Newsroom
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Watch for forecasts about upcoming months — they can help you decide when to spend a
                contract change.
              </p>
              <div className="mt-3">
                <StoryNews
                  news={season.news}
                  activeRoundNumber={
                    isProfessor
                      ? null
                      : activeRound?.round_number ??
                        (season.status === 'completed' ? season.total_rounds : 0)
                  }
                  emptyText="No news yet — check back once the season starts."
                />
              </div>
            </div>
          )}
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
              {myState.active_round_number > 1
                ? myState.active_round_unlocked
                  ? 'This active round is unlocked for policy edits.'
                  : myState.can_unlock_active_round
                    ? 'Spend one contract update token in the policy editor to unlock edits this round.'
                    : 'This round is locked and no contract updates remain.'
                : 'Round 1 is always editable; later rounds are locked until you spend a contract update.'}
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
                        {r.status === 'active' && !isProfessor && myState?.active_round_id === r.id
                          ? myState.active_round_unlocked
                            ? 'Unlocked this round'
                            : 'Locked (inherited)'
                          : 'Locked by default'}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Status: <span className={statusColor(r.status)}>{r.status}</span>
                  </p>
                  {r.status === 'scored' && (
                    <p className="mt-1 text-xs text-slate-400">
                      Financial impact:{' '}
                      <span
                        className={
                          typeof roundProfitById[r.id] === 'number'
                            ? roundProfitById[r.id] >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                            : 'text-slate-500'
                        }
                      >
                        {typeof roundProfitById[r.id] === 'number'
                          ? `$${roundProfitById[r.id].toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}`
                          : 'Not available'}
                      </span>
                    </p>
                  )}
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
                      {canUndoLatestSoloScore && Number(r.round_number) === latestScoredRoundNumber && (
                        <button
                          type="button"
                          disabled={undoBusy}
                          onClick={handleUndoLatestScore}
                          className="rounded-lg border border-red-500/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {undoBusy ? 'Undoing…' : 'Undo score'}
                        </button>
                      )}
                      <Link
                        to={`/round/${r.id}/results`}
                        className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                      >
                        Results
                      </Link>
                      {isClassSeason && (
                        <Link
                          to={`/leaderboard/${r.id}`}
                          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                        >
                          Leaderboard
                        </Link>
                      )}
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
