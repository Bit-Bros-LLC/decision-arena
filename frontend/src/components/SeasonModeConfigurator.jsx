import { Link } from 'react-router-dom';
import { FieldLabel } from './FieldLabel';
import ScenarioPresetCard from './ScenarioPresetCard';
import { SEASON_SPRINT_COPY } from '../lib/seasonSprintCopy';

const DEFAULT_INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

const MODE_EXPLAINER = {
  single: 'Every month uses the same demand pattern — good when you want a consistent challenge.',
  random_mix:
    'Each month randomly draws from the patterns you allow — students face variety without a fixed sequence.',
  custom_mix:
    'You pick the exact pattern for each month — useful for a designed curriculum arc.',
};

/**
 * Shared fiscal year / practice run mode + preset picker (single / random_mix / custom_mix).
 */
export default function SeasonModeConfigurator({
  presets,
  seasonMode,
  onSeasonModeChange,
  scenarioPreset,
  allowedPresets,
  customRoundPresets,
  onCustomRoundPresetChange,
  totalRounds,
  onPresetSelect,
  onPreview,
  scenariosLink = '/scenarios',
  inputClassName = DEFAULT_INPUT_CLASS,
  showModeSelector = true,
  dataTourAnchor,
  scenarioHelp,
}) {
  const showPresetGrid = seasonMode === 'single' || seasonMode === 'random_mix';

  return (
    <div className="space-y-4" {...(dataTourAnchor ? { 'data-tour': dataTourAnchor } : {})}>
      {showModeSelector && (
        <div>
          <FieldLabel label="Demand mode" help={SEASON_SPRINT_COPY.mode[seasonMode]} />
          <select
            value={seasonMode}
            onChange={(e) => onSeasonModeChange(e.target.value)}
            className={inputClassName}
          >
            <option value="single">Single type</option>
            <option value="random_mix">Random mix</option>
            <option value="custom_mix">Custom mix</option>
          </select>
          <p className="mt-2 text-xs text-slate-500">{MODE_EXPLAINER[seasonMode]}</p>
          <div className="mt-2 rounded-lg border border-slate-600/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Quick guide:</span>{' '}
            <span className="text-amber-500/90">Single</span> = one pattern all months ·{' '}
            <span className="text-amber-500/90">Random mix</span> = varied months from your pool ·{' '}
            <span className="text-amber-500/90">Custom mix</span> = you set each month
          </div>
        </div>
      )}

      {scenarioHelp && <p className="text-xs text-slate-500">{scenarioHelp}</p>}

      {seasonMode === 'custom_mix' && (
        <div className="space-y-2">
          <FieldLabel label="Month-by-month patterns" help={SEASON_SPRINT_COPY.roundByRound} />
          {customRoundPresets.map((value, idx) => (
            <label key={idx} className="flex items-center gap-3 text-sm">
              <span className="w-20 text-slate-400">Month {idx + 1}</span>
              <select
                value={value}
                onChange={(e) => onCustomRoundPresetChange(idx, e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {seasonMode === 'custom_mix' ? (
          <details className="group rounded-lg border border-slate-700 bg-slate-900/40">
            <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 marker:content-none">
              <span>Demand patterns (reference)</span>
              <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
            </summary>
            <div className="space-y-3 border-t border-slate-700 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{SEASON_SPRINT_COPY.customMixReference}</p>
                <Link to={scenariosLink} className="text-xs text-amber-500 hover:text-amber-400">
                  Browse all scenarios
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {presets.map((preset) => (
                  <ScenarioPresetCard
                    key={preset.id}
                    preset={preset}
                    selectionMode="none"
                    onPreview={onPreview}
                  />
                ))}
              </div>
            </div>
          </details>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldLabel
                label={
                  seasonMode === 'random_mix'
                    ? 'Allowed demand patterns'
                    : 'Demand pattern'
                }
                help={
                  seasonMode === 'random_mix'
                    ? SEASON_SPRINT_COPY.allowedTypes
                    : SEASON_SPRINT_COPY.basePreset
                }
              />
              <Link to={scenariosLink} className="text-xs text-amber-500 hover:text-amber-400">
                Browse all scenarios
              </Link>
            </div>
            {seasonMode === 'random_mix' && (
              <p className="text-xs text-slate-500">
                Click a card to include or exclude that pattern from the random mix.
              </p>
            )}
            {showPresetGrid && (
              <div className="grid gap-3 sm:grid-cols-2">
                {presets.map((preset) => (
                  <ScenarioPresetCard
                    key={preset.id}
                    preset={preset}
                    selected={seasonMode === 'single' && scenarioPreset === preset.id}
                    toggled={seasonMode === 'random_mix' && allowedPresets.includes(preset.id)}
                    selectionMode={seasonMode === 'random_mix' ? 'toggle' : 'single'}
                    onSelect={onPresetSelect}
                    onPreview={onPreview}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
