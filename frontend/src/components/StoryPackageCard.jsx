import { BADGE_COLORS } from '../lib/presetPreview';

export default function StoryPackageCard({
  story,
  selected = false,
  onSelect,
  onPreview,
  previewDisabled = false,
  ctaLabel = 'Use this story',
}) {
  const badgeClass = BADGE_COLORS[story.difficulty] || 'text-slate-300 border-slate-500/30 bg-slate-500/10';
  return (
    <div
      className={`flex h-full flex-col rounded-xl border p-4 transition ${
        selected
          ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/40'
          : 'border-slate-700 bg-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-100">{story.title}</h3>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
          {story.difficulty}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{story.summary}</p>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-slate-400">
        <div className="flex justify-between"><dt>Months</dt><dd className="tabular-nums text-slate-200">{story.total_rounds}</dd></div>
        <div className="flex justify-between"><dt>Policy reviews</dt><dd className="tabular-nums text-slate-200">{story.contract_updates_allowed}</dd></div>
        <div className="flex justify-between"><dt>Month length</dt><dd className="tabular-nums text-slate-200">{story.round_duration_days}d</dd></div>
        <div className="flex justify-between"><dt>Start inventory</dt><dd className="tabular-nums text-slate-200">{story.starting_inventory}</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(story)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              selected
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                : 'border border-amber-500/60 text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            {selected ? 'Selected' : ctaLabel}
          </button>
        )}
        {onPreview && (
          <button
            type="button"
            onClick={() => onPreview(story)}
            disabled={previewDisabled}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          >
            Preview demand
          </button>
        )}
      </div>
    </div>
  );
}
