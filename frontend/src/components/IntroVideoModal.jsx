import { useEffect, useState } from 'react';
import { toEmbedUrl } from '../lib/videoEmbed';

const INTRO_VIDEO_URL = import.meta.env.VITE_INTRO_VIDEO_URL || '';
const embedSrc = toEmbedUrl(INTRO_VIDEO_URL);

export default function IntroVideoModal({ open, onClose }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) setDontShowAgain(false);
  }, [open]);

  if (!open) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose({ dontShowAgain });
  };

  const handleClose = () => onClose({ dontShowAgain });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-video-title"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-3xl rounded-xl border border-slate-600 bg-slate-800 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4">
          <div>
            <h2 id="intro-video-title" className="text-lg font-semibold text-slate-100">
              Welcome to Decision Arena
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Learn how policies, uncertainty, and daily decisions drive your factory&apos;s performance.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {embedSrc ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
              <iframe
                src={embedSrc}
                title="Decision Arena intro video"
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-slate-600 bg-slate-900/60 px-6 text-center">
              <p className="text-base font-medium text-slate-200">Intro video coming soon</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                A short walkthrough of the game — two daily decisions, policies, hidden actuals, and
                seasons — will appear here once production is complete.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-slate-500 bg-slate-900 text-amber-500 focus:ring-amber-500"
            />
            Don&apos;t show again
          </label>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
