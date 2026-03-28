import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  const navigate = useNavigate();
  const user = getUser();
  const isProfessor = user?.role === 'professor';

  const [room, setRoom] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyDone, setCopyDone] = useState(false);
  const [scoringId, setScoringId] = useState(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
          {room.name}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {room.member_count} member{room.member_count === 1 ? '' : 's'}
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
          {isProfessor && (
            <Link
              to={`/room/${roomId}/create-round`}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400"
            >
              Create Round
            </Link>
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
              const active = r.status === 'active';
              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">
                        Round {r.round_number}
                      </p>
                      <p className="mt-1 text-sm capitalize text-slate-400">
                        Status:{' '}
                        <span
                          className={
                            active ? 'text-amber-400' : 'text-emerald-400'
                          }
                        >
                          {r.status}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Deadline: {formatDeadline(r.deadline)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {active && (
                        <>
                          <Link
                            to={`/round/${r.id}`}
                            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                          >
                            Policy editor
                          </Link>
                          {isProfessor && (
                            <button
                              type="button"
                              disabled={scoringId === r.id}
                              onClick={() => handleScoreRound(r.id)}
                              className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                            >
                              {scoringId === r.id ? 'Scoring…' : 'Score Round'}
                            </button>
                          )}
                        </>
                      )}
                      {!active && (
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
              );
            })}
          </ul>
        )}
    </div>
  );
}
