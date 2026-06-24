import { useEffect } from 'react';
import PresetPreviewChart from './PresetPreviewChart';

export default function PresetPreviewModal({
  open,
  onClose,
  title,
  subtitle,
  chartData = [],
  boundary = null,
  roundBoundaries = [],
  loading = false,
  error = null,
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="preset-preview-modal-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          {loading && (
            <div className="flex h-80 items-center justify-center text-sm text-slate-400">
              Generating preview…
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          {!loading && !error && (
            <PresetPreviewChart
              chartData={chartData}
              boundary={boundary}
              roundBoundaries={roundBoundaries}
            />
          )}
        </div>
      </div>
    </div>
  );
}
