import { BADGE_COLORS } from '../lib/presetPreview';
import { usePresetPreview } from '../hooks/usePresetPreview';
import PresetSparkline from './PresetSparkline';

export default function ScenarioPresetCard({
  preset,
  selected = false,
  toggled = false,
  selectionMode = 'single',
  onSelect,
  onPreview,
  previewOverrides,
}) {
  const { sparklineData, boundary, loading, error } = usePresetPreview(preset?.id, {
    overrides: previewOverrides,
  });

  const isHighlighted =
    selectionMode === 'toggle' ? toggled : selectionMode === 'single' ? selected : false;

  const handleCardClick = () => {
    if (selectionMode === 'none') {
      onPreview?.(preset);
      return;
    }
    onSelect?.(preset);
  };

  const handlePreviewClick = (e) => {
    e.stopPropagation();
    onPreview?.(preset);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={`group relative cursor-pointer rounded-lg border p-3 text-left transition ${
        isHighlighted
          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
          : 'border-slate-600 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">{preset.name}</span>
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider ${
            BADGE_COLORS[preset.badge] || 'text-slate-400 border-slate-500/40 bg-slate-500/10'
          }`}
        >
          {preset.badge}
        </span>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">
        {preset.description}
      </p>

      <div className="mt-2">
        <PresetSparkline
          data={sparklineData}
          boundary={boundary}
          loading={loading}
          error={error}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handlePreviewClick}
          className="text-xs font-medium text-amber-500 hover:text-amber-400"
        >
          Full preview
        </button>
        {selectionMode === 'single' && selected && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Active
          </span>
        )}
        {selectionMode === 'toggle' && toggled && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
            Included
          </span>
        )}
      </div>
    </div>
  );
}
