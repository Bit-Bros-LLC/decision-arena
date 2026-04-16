import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

export default function RoomView() {
  const { roomId } = useParams();
  const user = getUser();
  const isProfessor = user?.role === 'professor';

  const [room, setRoom] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyDone, setCopyDone] = useState(false);
  const [scoringId, setScoringId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showEndClassConfirm, setShowEndClassConfirm] = useState(false);
  const [endingClass, setEndingClass] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [roomsList, roundsList] = await Promise.all([
        api.getRooms(),
        api.getRoomRounds(roomId),
      ]);
      const found = roomsList.find((r) => r.id === roomId);
      setRoom(found || null);
      setRounds(Array.isArray(roundsList) ? roundsList : []);
    } catch (e) {
      setError(e.message || 'Failed to load room');
      setRoom(null);
      setRounds([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyInvite = async () => {
    if (!room?.invite_code) return;
    try {
      await navigator.clipboard.writeText(room.invite_code);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  };

  const handleScoreRound = async (roundId) => {
    setScoringId(roundId);
    try {
      await api.scoreRound(roundId);
      await load();
    } catch (e) {
      setError(e.message || 'Could not score round');
    } finally {
      setScoringId(null);
    }
  };

  const handleActivateRound = async (roundId) => {
    setActivatingId(roundId);
    try {
      await api.activateRound(roundId);
      await load();
    } catch (e) {
      setError(e.message || 'Could not activate round');
    } finally {
      setActivatingId(null);
    }
  };

  const handleEndClass = async () => {
    setEndingClass(true);
    try {
      await api.completeRoom(roomId);
      setShowEndClassConfirm(false);
      await load();
    } catch (e) {
      setError(e.message || 'Could not end class');
    } finally {
      setEndingClass(false);
    }
  };

  const handleDeleteRound = async (roundId) => {
    if (!window.confirm('Delete this round? All policies and results will be lost.')) return;
    setDeletingId(roundId);
    try {
      await api.deleteRound(roundId);
      await load();
    } catch (e) {
      setError(e.message || 'Could not delete round');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-amber-500">Loading room…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error || 'Room not found or you are not a member.'}</p>
      </div>
    );
  }

  const roomComplete = Boolean(room.completed);

  return (
    <div className="space-y-6">
      {showEndClassConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-class-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-600 bg-slate-800 p-6 shadow-xl">
            <h2 id="end-class-title" className="text-lg font-semibold text-slate-100">
              End class
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Are you sure you want to complete the class? No more rounds will be allowed to be
              created.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={endingClass}
                onClick={() => setShowEndClassConfirm(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={endingClass}
                onClick={handleEndClass}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {endingClass ? 'Ending…' : 'Complete class'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
          {room.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {room.member_count} member{room.member_count === 1 ? '' : 's'}
          {roomComplete && (
            <span className="ml-2 rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Class complete
            </span>
          )}
        </p>
      </div>

        {error && (
          <div
            className="mb-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {isProfessor && room.invite_code && (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-slate-800 p-5 shadow-lg">
            <h2 className="text-sm font-medium uppercase tracking-wide text-amber-500">
              Invite code
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-lg bg-slate-900 px-4 py-2 text-xl font-mono text-amber-400">
                {room.invite_code}
              </code>
              <button
                type="button"
                onClick={copyInvite}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400"
              >
                {copyDone ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            to={`/leaderboard/season/${roomId}`}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-amber-500 transition hover:border-amber-500/50 hover:bg-slate-700"
          >
            Season leaderboard
          </Link>
          {isProfessor && !roomComplete && (
            <Link
              to={`/room/${roomId}/create-round`}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400"
            >
              Create Round
            </Link>
          )}
          {isProfessor && !roomComplete && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setShowEndClassConfirm(true);
              }}
              className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
            >
              End class
            </button>
          )}
        </div>

        <h2 className="mb-4 text-lg font-medium text-slate-100">Rounds</h2>
        {rounds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-8 text-center text-slate-400">
            No rounds yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {rounds.map((r) => {
              const statusColor =
                r.status === 'draft'
                  ? 'text-slate-400'
                  : r.status === 'active'
                    ? 'text-amber-400'
                    : 'text-emerald-400';
              return (
                <li
                  key={r.id}
                  className={`rounded-xl border p-5 shadow-md ${
                    r.status === 'draft'
                      ? 'border-dashed border-slate-600 bg-slate-800/60'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">
                        Round {r.round_number}
                        {r.status === 'draft' && (
                          <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs font-normal text-slate-400">
                            Draft
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm capitalize text-slate-400">
                        Status: <span className={statusColor}>{r.status}</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Deadline: {formatDeadline(r.deadline)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'draft' && isProfessor && (
                        <>
                          <Link
                            to={`/room/${roomId}/edit-round/${r.id}`}
                            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            disabled={activatingId === r.id}
                            onClick={() => handleActivateRound(r.id)}
                            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
                          >
                            {activatingId === r.id ? 'Activating…' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === r.id}
                            onClick={() => handleDeleteRound(r.id)}
                            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                          >
                            {deletingId === r.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </>
                      )}
                      {r.status === 'active' && (
                        <>
                          <Link
                            to={`/round/${r.id}`}
                            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                          >
                            Policy editor
                          </Link>
                          {isProfessor && (
                            <>
                              <button
                                type="button"
                                disabled={scoringId === r.id}
                                onClick={() => handleScoreRound(r.id)}
                                className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                              >
                                {scoringId === r.id ? 'Scoring…' : 'Score Round'}
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === r.id}
                                onClick={() => handleDeleteRound(r.id)}
                                className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                {deletingId === r.id ? 'Deleting…' : 'Delete'}
                              </button>
                            </>
                          )}
                        </>
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
                          {isProfessor && (
                            <button
                              type="button"
                              disabled={deletingId === r.id}
                              onClick={() => handleDeleteRound(r.id)}
                              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {deletingId === r.id ? 'Deleting…' : 'Delete'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
