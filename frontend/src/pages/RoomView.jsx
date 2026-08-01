import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getUser } from '../api';
import { FieldLabel } from '../components/FieldLabel';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { isTourDone, TOUR_IDS } from '../lib/onboarding';
import { buildProfessorRoomTourSteps } from '../lib/professorRoomTour';
import { runOnboardingTour } from '../lib/runOnboardingTour';
import { SEASON_SPRINT_COPY } from '../lib/seasonSprintCopy';

export default function RoomView() {
  const { roomId } = useParams();
  const user = getUser();
  const isProfessor = user?.role === 'professor';

  const [room, setRoom] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyDone, setCopyDone] = useState(false);
  const [scoringId, setScoringId] = useState(null);
  const [activatingId, setActivatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showEndClassConfirm, setShowEndClassConfirm] = useState(false);
  const [endingClass, setEndingClass] = useState(false);
  const [soloTemplates, setSoloTemplates] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [templateMode, setTemplateMode] = useState('random_mix');
  const [templateError, setTemplateError] = useState('');

  const { userId, userRole, tourRevision } = useOnboarding();
  const tourStartedRef = useRef(false);

  useBreadcrumbLabels({ labels: room?.name ? { room: room.name } : {} });

  const adhocRounds = useMemo(
    () => rounds.filter((r) => !r.season_id),
    [rounds],
  );
  const draftRound = useMemo(
    () => adhocRounds.find((r) => r.status === 'draft') ?? null,
    [adhocRounds],
  );
  const activeAdhocRound = useMemo(
    () => adhocRounds.find((r) => r.status === 'active') ?? null,
    [adhocRounds],
  );
  const sharedSeasons = useMemo(
    () => seasons.filter((s) => !s.source_template_id),
    [seasons],
  );
  const fiscalYearsToShow = isProfessor ? seasons : sharedSeasons;

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [roomsList, roundsList, seasonsList, templatesList] = await Promise.all([
        api.getRooms(),
        api.getRoomRounds(roomId),
        api.listRoomSeasons(roomId).catch(() => []),
        api.listRoomSoloTemplates(roomId).catch(() => []),
      ]);
      const found = roomsList.find((r) => r.id === roomId);
      setRoom(found || null);
      setRounds(Array.isArray(roundsList) ? roundsList : []);
      setSeasons(Array.isArray(seasonsList) ? seasonsList : []);
      setSoloTemplates(Array.isArray(templatesList) ? templatesList : []);
    } catch (e) {
      setError(e.message || 'Failed to load classroom');
      setRoom(null);
      setRounds([]);
      setSeasons([]);
      setSoloTemplates([]);
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

    const hasInviteCode = Boolean(room.invite_code);
    const steps = buildProfessorRoomTourSteps({
      hasInviteCode,
      hasDraftRound: Boolean(draftRound),
      hasActiveRound: Boolean(activeAdhocRound),
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
    draftRound,
    activeAdhocRound,
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

  const handleScoreRound = async (roundId) => {
    setScoringId(roundId);
    try {
      await api.scoreRound(roundId);
      await load();
    } catch (e) {
      setError(e.message || 'Could not score month');
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
      setError(e.message || 'Could not activate month');
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
    if (!window.confirm('Delete this month? All policies and results will be lost.')) return;
    setDeletingId(roundId);
    try {
      await api.deleteRound(roundId);
      await load();
    } catch (e) {
      setError(e.message || 'Could not delete month');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateTemplate = async () => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      setTemplateError('Please enter a case study name');
      return;
    }
    setTemplateError('');
    try {
      await api.createRoomSoloTemplate(roomId, {
        name: trimmedName,
        season_mode: templateMode,
        total_rounds: 5,
        contract_updates_allowed: 1,
        round_duration_days: 30,
        historical_leadin_days: 60,
        scenario_preset: 'steady',
        scenario_config: {},
        mix_config: templateMode === 'random_mix' ? {} : { round_presets: ['steady', 'steady', 'steady', 'steady', 'steady'] },
        costs: {
          holding_per_unit: 1,
          stockout_penalty: 10,
          ordering_fixed: 20,
          per_unit_cost: 5,
          selling_price: 15,
          dual_source_enabled: false,
          dual_source_premium_per_unit: 2,
          dual_source_rescue_pct: 1,
        },
        starting_inventory: 100,
        is_published: true,
        scenario_seed: 42,
      });
      await load();
    } catch (e) {
      setTemplateError(e.message || 'Could not create case study');
    }
  };

  const handleInstantiateTemplate = async (templateId) => {
    setTemplateError('');
    try {
      const season = await api.instantiateRoomSoloTemplate(roomId, templateId);
      window.location.href = `/room/${roomId}/season/${season.id}`;
    } catch (e) {
      setTemplateError(e.message || 'Could not start case study');
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
              Are you sure you want to complete the class? No more standalone months will be allowed to be
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

      <div data-tour="room-header">
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
          <div
            data-tour="room-invite"
            className="mb-8 rounded-xl border border-amber-500/30 bg-slate-800 p-5 shadow-lg"
          >
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

        <div data-tour="room-create" className="mb-6 flex flex-wrap items-center gap-3">
          {isProfessor && !roomComplete && (
            <Link
              to={`/room/${roomId}/create-season`}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-amber-400"
            >
              Create fiscal year
            </Link>
          )}
          <Link
            to={`/room/${roomId}/season-sprint/new`}
            className="rounded-lg border border-emerald-500/40 px-4 py-2 text-sm text-emerald-400 transition hover:bg-emerald-500/10"
          >
            Create {room.name} practice run
          </Link>
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

        <div data-tour="room-activate" className="mb-8">
            <h2 className="mb-4 text-lg font-medium text-slate-100">Fiscal years</h2>
            {fiscalYearsToShow.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-6 text-center text-sm text-slate-400">
                {isProfessor
                  ? 'No fiscal years yet. Create one to run a multi-month class competition.'
                  : 'No class fiscal years yet. Your professor may publish one from Create fiscal year.'}
              </p>
            ) : (
            <ul className="space-y-3">
              {fiscalYearsToShow.map((s) => {
                const scored = s.rounds.filter((r) => r.status === 'scored').length;
                const active = s.rounds.find((r) => r.status === 'active');
                const isTemplateRun = Boolean(s.source_template_id);
                const listTitle =
                  isTemplateRun && s.template_name && s.sprint_attempt != null
                    ? `${s.template_name} · Attempt ${s.sprint_attempt}`
                    : s.name;
                const standingsTo = isTemplateRun
                  ? `/leaderboard/room/${roomId}/template/${s.source_template_id}/cohort`
                  : `/leaderboard/season/${s.id}`;
                const badgeColor =
                  s.status === 'active'
                    ? 'text-amber-400'
                    : s.status === 'completed'
                      ? 'text-emerald-400'
                      : 'text-slate-400';
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-md"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">{listTitle}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Preset: <span className="text-slate-300">{s.scenario_preset}</span> ·{' '}
                          {s.total_rounds} months · {s.contract_updates_allowed} policy reviews
                        </p>
                        <p className="mt-0.5 text-xs">
                          Status: <span className={badgeColor}>{s.status}</span> · {scored}/
                          {s.total_rounds} scored
                          {active && (
                            <>
                              {' '}
                              · Month <span className="text-amber-400">{active.round_number}</span>{' '}
                              active
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/room/${roomId}/season/${s.id}`}
                          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
                        >
                          Open fiscal year
                        </Link>
                        <Link
                          to={standingsTo}
                          className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-sm text-slate-200 transition hover:border-amber-500/40 hover:text-amber-400"
                        >
                          Fiscal year standings
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
          </div>

        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h2 className="text-lg font-medium text-slate-100">Case studies</h2>
          <p className="text-xs text-slate-500">Professor can publish shared case studies. Students run them asynchronously on their own copies.</p>
          {isProfessor && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1">
                  <FieldLabel label="Case study name" help={SEASON_SPRINT_COPY.templateName} />
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={SEASON_SPRINT_COPY.templateNamePlaceholder}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="min-w-[10rem]">
                  <FieldLabel label="Mode" help={SEASON_SPRINT_COPY.templateMode} />
                  <select
                    value={templateMode}
                    onChange={(e) => setTemplateMode(e.target.value)}
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="random_mix">Random mix</option>
                    <option value="custom_mix">Custom mix</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCreateTemplate}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400"
                >
                  Publish case study
                </button>
              </div>
              <p className="text-xs text-slate-500">{SEASON_SPRINT_COPY.templateHelper}</p>
            </div>
          )}
          {templateError && <p className="mt-2 text-sm text-red-400">{templateError}</p>}
          <div className="mt-3 space-y-2">
            {soloTemplates.length === 0 && <p className="text-sm text-slate-500">No case studies yet.</p>}
            {soloTemplates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 p-2">
                <p className="text-sm text-slate-200">{t.name} · {t.total_rounds} months · {t.season_mode}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/leaderboard/room/${roomId}/template/${t.id}/cohort`}
                    className="rounded border border-slate-500/50 px-3 py-1 text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-amber-400"
                  >
                    Cohort standings
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleInstantiateTemplate(t.id)}
                    className="rounded border border-amber-500/40 px-3 py-1 text-sm text-amber-400 hover:bg-amber-500/10"
                  >
                    Start my run
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div data-tour="room-score">
        <h2 className="mb-4 text-lg font-medium text-slate-100">Standalone months</h2>
        {adhocRounds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-8 text-center text-slate-400">
            {fiscalYearsToShow.length > 0
              ? 'No standalone months. Open a fiscal year above to see its months.'
              : 'No months yet.'}
          </p>
        ) : (
          <ul className="space-y-4">
            {adhocRounds.map((r) => {
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
                        Month {r.round_number}
                        {r.status === 'draft' && (
                          <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs font-normal text-slate-400">
                            Draft
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm capitalize text-slate-400">
                        Status: <span className={statusColor}>{r.status}</span>
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
                            data-tour={draftRound?.id === r.id ? 'room-activate-btn' : undefined}
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
                                data-tour={activeAdhocRound?.id === r.id ? 'room-score-btn' : undefined}
                                className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                              >
                                {scoringId === r.id ? 'Scoring…' : 'Score Month'}
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
    </div>
  );
}
