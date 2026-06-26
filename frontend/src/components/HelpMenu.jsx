import { useEffect, useRef, useState } from 'react';
import { TOUR_LABELS } from '../lib/onboarding';
import { useOnboarding } from '../context/OnboardingContext';

export default function HelpMenu() {
  const { openIntroVideo, handleRestartTour, finishedTourIds } = useOnboarding();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-sm font-medium transition-colors ${
          open ? 'text-amber-400' : 'text-slate-400 hover:text-amber-300'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Help
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-600 bg-slate-800 py-2 shadow-xl"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700/80"
            onClick={() => {
              openIntroVideo('help_menu');
              setOpen(false);
            }}
          >
            Watch intro video
          </button>

          <div className="my-2 border-t border-slate-700" />

          <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Restart tours
          </p>

          {finishedTourIds.length === 0 ? (
            <p className="px-4 py-2 text-xs text-slate-500">
              Guided tours will appear here after you complete or skip them.
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {finishedTourIds.map((tourId) => (
                <li key={tourId}>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/80"
                    onClick={() => {
                      handleRestartTour(tourId);
                      setOpen(false);
                    }}
                  >
                    <span>{TOUR_LABELS[tourId] || tourId}</span>
                    <span className="shrink-0 text-xs text-amber-400/90">Restart</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
