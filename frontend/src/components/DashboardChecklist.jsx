import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChecklistItemsForRole } from '../lib/onboarding';
import { useOnboarding } from '../context/OnboardingContext';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * @param {{ rooms: object[], soloSeasons: object[], isProfessor: boolean }} props
 */
export default function DashboardChecklist({ rooms = [], soloSeasons = [], isProfessor = false }) {
  const navigate = useNavigate();
  const {
    userRole,
    openIntroVideo,
    markChecklistItem,
    isChecklistItemDone,
    isChecklistDismissed,
    dismissChecklist,
    isChecklistCollapsed,
    collapseChecklist,
    expandChecklist,
    checklistRevision,
  } = useOnboarding();

  const items = useMemo(() => getChecklistItemsForRole(userRole), [userRole]);

  const doneCount = useMemo(() => {
    void checklistRevision;
    return items.filter((item) => isChecklistItemDone(item.id)).length;
  }, [items, isChecklistItemDone, checklistRevision]);

  const allDone = doneCount === items.length;

  const activeSoloRoundId = useMemo(() => {
    for (const season of soloSeasons) {
      const active = season.rounds?.find((r) => r.status === 'active');
      if (active?.id) return active.id;
    }
    return null;
  }, [soloSeasons]);

  const firstRoomId = rooms[0]?.id ?? null;

  if (isChecklistDismissed()) {
    return null;
  }

  const progressPct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderAction(item) {
    if (isChecklistItemDone(item.id)) return null;

    switch (item.id) {
      case 'watch_intro':
        return (
          <button
            type="button"
            onClick={() => openIntroVideo('checklist')}
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            Watch intro
          </button>
        );
      case 'solo_season':
        return (
          <button
            type="button"
            onClick={() => {
              markChecklistItem('solo_season');
              navigate('/season-sprint/new');
            }}
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            Create solo season
          </button>
        );
      case 'join_room':
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => scrollToId('join-room')}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Join a room
            </button>
            <button
              type="button"
              onClick={() => markChecklistItem('join_room')}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Not in a class
            </button>
          </div>
        );
      case 'submit_policy':
        if (activeSoloRoundId) {
          return (
            <button
              type="button"
              onClick={() => navigate(`/round/${activeSoloRoundId}`)}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Open active round
            </button>
          );
        }
        if (soloSeasons.length > 0) {
          const path = soloSeasons[0].open_path;
          return path ? (
            <button
              type="button"
              onClick={() => navigate(path)}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Open your solo season
            </button>
          ) : null;
        }
        return (
          <span className="text-sm text-slate-500">Start a solo season first</span>
        );
      case 'create_room':
        return (
          <button
            type="button"
            onClick={() => scrollToId('create-room')}
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            Create a room
          </button>
        );
      case 'create_season':
        if (firstRoomId) {
          return (
            <button
              type="button"
              onClick={() => navigate(`/room/${firstRoomId}/create-season`)}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Set up a season
            </button>
          );
        }
        return (
          <span className="text-sm text-slate-500">Create a classroom first</span>
        );
      default:
        return null;
    }
  }

  if (isChecklistCollapsed()) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-slate-800 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h2 className="text-sm font-medium text-slate-100">Getting started</h2>
          <span className="text-sm text-amber-400">
            {doneCount}/{items.length}
          </span>
          {allDone && (
            <span className="text-xs text-emerald-400">All done</span>
          )}
        </div>
        <button
          type="button"
          onClick={expandChecklist}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Expand
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-amber-500/30 bg-slate-800 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-100">Getting started</h2>
          <p className="mt-1 text-sm text-slate-400">
            {isProfessor
              ? 'Set up your classroom and first season.'
              : 'Complete these steps to practice on your own or join a class.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-amber-400">
            {doneCount}/{items.length}
          </span>
          <button
            type="button"
            onClick={collapseChecklist}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            Collapse
          </button>
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {allDone && (
        <p className="mt-4 text-sm text-emerald-400">You&apos;ve completed all getting-started steps.</p>
      )}

      <ul className="mt-5 space-y-3">
        {items.map((item) => {
          const done = isChecklistItemDone(item.id);
          return (
            <li key={item.id} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  done
                    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                    : 'border-slate-600 bg-slate-900 text-transparent'
                }`}
                aria-hidden
              >
                {done && <CheckIcon />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {item.label}
                </p>
                {!done && <div className="mt-1">{renderAction(item)}</div>}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={dismissChecklist}
        className="mt-5 text-sm text-slate-500 underline hover:text-slate-300"
      >
        Dismiss checklist
      </button>
    </section>
  );
}
