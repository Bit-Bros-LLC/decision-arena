import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getUser } from '../api';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { isTourDone, TOUR_IDS } from '../lib/onboarding';
import { buildProfessorRoomTourSteps } from '../lib/professorRoomTour';
import { runOnboardingTour } from '../lib/runOnboardingTour';

function PillSegment({ active, children, onClick, dataTour }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-tour={dataTour}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-slate-700 text-slate-100 shadow-sm'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function seasonBadgeColor(status) {
  if (status === 'active') return 'text-amber-400';
  if (status === 'completed') return 'text-emerald-400';
  return 'text-slate-400';
}

function SeasonCard({ season, roomId, openLabel, standingsLabel }) {
  const scored = season.rounds.filter((r) => r.status === 'scored').length;
  const active = season.rounds.find((r) => r.status === 'active');
  return (
    <li className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-100">{season.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Preset: <span className="text-slate-300">{season.scenario_preset}</span> ·{' '}
            {season.total_rounds} months · {season.contract_updates_allowed} policy reviews
          </p>
          <p className="mt-0.5 text-xs">
            Status: <span className={seasonBadgeColor(season.status)}>{season.status}</span> ·{' '}
            {scored}/{season.total_rounds} scored
            {active && (
              <>
                {' '}
                · Month <span className="text-amber-400">{active.round_number}</span> active
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/room/${roomId}/season/${season.id}`}
            className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
          >
            {openLabel}
          </Link>
          <Link
            to={`/leaderboard/season/${season.id}`}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-amber-500/40 hover:text-amber-400"
          >
            {standingsLabel}
          </Link>
        </div>
      </div>
    </li>
  );
}

export default function RoomView() {
  const { roomId } = useParams();
  const user = getUser();
  const isProfessor = user?.role === 'professor';

  const [room, setRoom] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyDone, setCopyDone] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');

  const { userId, userRole, tourRevision } = useOnboarding();
  const tourStartedRef = useRef(false);

  useBreadcrumbLabels({ labels: room?.name ? { room: room.name } : {} });

  const fiscalYears = useMemo(
    () => seasons.filter((s) => !s.is_practice_run && !s.source_template_id),
    [seasons],
  );
  const practiceRuns = useMemo(
    () => seasons.filter((s) => Boolean(s.is_practice_run)),
    [seasons],
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [roomsList, seasonsList] = await Promise.all([
        api.getRooms(),
        api.listRoomSeasons(roomId).catch(() => []),
      ]);
      const found = roomsList.find((r) => r.id === roomId);
      setRoom(found || null);
      setSeasons(Array.isArray(seasonsList) ? seasonsList : []);
    } catch (e) {
      setError(e.message || 'Failed to load classroom');
      setRoom(null);
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    tourStartedRef.current = false;
  }, [roomId, tourRevision]);

  useEffect(() => {
    if (!userId || !isProfessor || loading || !room) return;
    if (room.professor_id !== user?.user_id) return;
    if (isTourDone(userId, TOUR_IDS.PROFESSOR_ROOM)) return;
    if (tourStartedRef.current) return;

    setActiveTab('activity');

    const steps = buildProfessorRoomTourSteps({
      hasInviteCode: Boolean(room.invite_code),
    });

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 15;

    function tryStartTour() {
      if (cancelled || tourStartedRef.current) return;

      const missing = steps.some((step) => !document.querySelector(step.element));
      if (missing) {
        if (attempt < maxAttempts) {
          attempt += 1;
          setTimeout(tryStartTour, 100);
        }
        return;
      }

      const firstElement = document.querySelector(steps[0].element);
      firstElement?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

      tourStartedRef.current = true;
      runOnboardingTour({
        userId,
        userRole,
        tourId: TOUR_IDS.PROFESSOR_ROOM,
        steps,
      });
    }

    const frameId = requestAnimationFrame(tryStartTour);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [
    userId,
    userRole,
    tourRevision,
    roomId,
    isProfessor,
    loading,
    room,
    user?.user_id,
  ]);

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

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-amber-500">Loading classroom…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="p-6">
        <p className="text-red-400">{error || 'Classroom not found or you are not a member.'}</p>
      </div>
    );
  }

  const roomComplete = Boolean(room.completed);
  const showActivity = !isProfessor || activeTab === 'activity';
  const showAdmin = isProfessor && activeTab === 'admin';

  return (
    <div className="space-y-6">
      <div
        data-tour="room-header"
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="min-w-0">
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
        {isProfessor && (
          <div
            data-tour="room-tabs"
            className="inline-flex shrink-0 rounded-lg border border-slate-600 bg-slate-900/80 p-1"
            role="tablist"
            aria-label="Classroom sections"
          >
            <PillSegment active={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>
              Activity
            </PillSegment>
            <PillSegment
              active={activeTab === 'admin'}
              onClick={() => setActiveTab('admin')}
              dataTour="room-admin-tab"
            >
              Class Admin
            </PillSegment>
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

      {showActivity && (
        <div className="space-y-8" role="tabpanel" aria-label="Activity">
          <div data-tour="room-create" className="flex flex-wrap items-center gap-3">
            {isProfessor && !roomComplete && (
              <Link
                to={`/room/${roomId}/create-season`}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400"
              >
                Create fiscal year
              </Link>
            )}
            {!roomComplete && (
              <Link
                to={`/room/${roomId}/season-sprint/new`}
                className="rounded-lg border border-emerald-500/40 px-4 py-2 text-sm text-emerald-400 transition hover:bg-emerald-500/10"
              >
                Create {room.name} practice run
              </Link>
            )}
          </div>

          <div data-tour="room-activate">
            <h2 className="mb-4 text-lg font-medium text-slate-100">Fiscal years</h2>
            {fiscalYears.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-6 text-center text-sm text-slate-400">
                {isProfessor
                  ? 'No fiscal years yet. Create one to run a multi-month class competition.'
                  : 'No class fiscal years yet. Your professor may publish one from Create fiscal year.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {fiscalYears.map((s) => (
                  <SeasonCard
                    key={s.id}
                    season={s}
                    roomId={roomId}
                    openLabel="Open fiscal year"
                    standingsLabel="Fiscal year standings"
                  />
                ))}
              </ul>
            )}
          </div>

          <div data-tour="room-practice">
            <h2 className="mb-4 text-lg font-medium text-slate-100">Practice runs</h2>
            <p className="mb-3 text-xs text-slate-500">
              Individual practice runs in this classroom. Owners can advance their own runs; professors
              can see every run.
            </p>
            {practiceRuns.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-6 text-center text-sm text-slate-400">
                No practice runs yet. Start one with Create practice run above.
              </p>
            ) : (
              <ul className="space-y-3">
                {practiceRuns.map((s) => (
                  <SeasonCard
                    key={s.id}
                    season={s}
                    roomId={roomId}
                    openLabel="Open practice run"
                    standingsLabel="Standings"
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showAdmin && (
        <div className="space-y-8" role="tabpanel" aria-label="Class Admin">
          {room.invite_code ? (
            <div
              data-tour="room-invite"
              className="rounded-xl border border-amber-500/30 bg-slate-800 p-5 shadow-lg"
            >
              <h2 className="text-sm font-medium uppercase tracking-wide text-amber-500">
                Invite code
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <code className="rounded-lg bg-slate-900 px-4 py-2 font-mono text-xl text-amber-400">
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
          ) : (
            <p className="text-sm text-slate-400">No invite code available for this classroom.</p>
          )}
        </div>
      )}
    </div>
  );
}
