import { FieldLabel } from './FieldLabel';
import DualSourceFields from './DualSourceFields';
import { COST_TOOLTIPS } from '../lib/costTooltips';
import { SEASON_CREATOR_COPY } from '../lib/seasonCreatorCopy';
import { SEASON_SPRINT_COPY } from '../lib/seasonSprintCopy';
import { monthDurationWarning } from '../lib/seasonDuration';
import { PRESET_CONFIG_FIELDS } from '../lib/presetPreview';

const DEFAULT_INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

const COST_FIELDS = [
  ['holding_per_unit', 'Holding / unit'],
  ['stockout_penalty', 'Stockout penalty'],
  ['ordering_fixed', 'Ordering (fixed)'],
  ['per_unit_cost', 'Per-unit cost'],
  ['selling_price', 'Selling price'],
];

/**
 * Collapsible "Advanced users" mechanical settings for season / practice run setup.
 */
export default function SeasonAdvancedSettings({
  costs,
  onCostChange,
  roundDuration,
  onRoundDurationChange,
  leadinDays,
  onLeadinDaysChange,
  startingInventory,
  onStartingInventoryChange,
  showDualSourceToggle = false,
  showDualSourceSubFields = false,
  dualSourceToggleLabel,
  presetTuning,
  inputClassName = DEFAULT_INPUT_CLASS,
  summaryText,
  dataTourAnchor,
}) {
  const copy = summaryText ?? SEASON_SPRINT_COPY.advancedUsers;
  const durationWarning = monthDurationWarning(roundDuration);

  const configFields =
    presetTuning?.seasonMode === 'single' && presetTuning?.presetId
      ? PRESET_CONFIG_FIELDS[presetTuning.presetId] || []
      : [];

  return (
    <details
      className="group rounded-lg border border-slate-700 bg-slate-900/40"
      {...(dataTourAnchor ? { 'data-tour': dataTourAnchor } : {})}
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 marker:content-none">
        <span>Advanced users</span>
        <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
      </summary>
      <div className="space-y-6 border-t border-slate-700 px-4 py-4">
        <p className="text-xs text-slate-500">{copy}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel label="Month length (days)" help={SEASON_CREATOR_COPY.roundDuration} />
            <input
              type="number"
              min={1}
              max={90}
              value={roundDuration}
              onChange={(e) => onRoundDurationChange(e.target.value)}
              className={inputClassName}
            />
            {durationWarning && <p className="mt-1 text-xs text-amber-400">{durationWarning}</p>}
          </div>
          <div>
            <FieldLabel
              label="Historical lead-in (days)"
              help={SEASON_CREATOR_COPY.historicalLeadin}
            />
            <input
              type="number"
              min={0}
              max={365}
              value={leadinDays}
              onChange={(e) => onLeadinDaysChange(e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <FieldLabel label="Starting inventory" help={SEASON_CREATOR_COPY.startingInventory} />
            <input
              type="number"
              min={0}
              value={startingInventory}
              onChange={(e) => onStartingInventoryChange(e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-amber-500">Cost parameters</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {COST_FIELDS.map(([key, label]) => (
              <div key={key}>
                <FieldLabel label={label} help={COST_TOOLTIPS[label]} />
                <input
                  type="number"
                  step="1"
                  value={costs[key]}
                  onChange={(e) => onCostChange(key, e.target.value)}
                  className={inputClassName}
                />
              </div>
            ))}
          </div>
        </fieldset>

        {(showDualSourceToggle || showDualSourceSubFields) && (
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-amber-500">Dual sourcing</legend>
            <DualSourceFields
              costs={costs}
              onCostChange={onCostChange}
              showToggle={showDualSourceToggle}
              showSubFields={showDualSourceSubFields}
              toggleLabel={dualSourceToggleLabel ?? 'Enable dual sourcing for students'}
              inputClassName={inputClassName}
            />
          </fieldset>
        )}

        {configFields.length > 0 && presetTuning?.presetName && (
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium text-amber-500">
              {presetTuning.presetName} · tuning
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {configFields.map((f) => (
                <div key={f.key}>
                  <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
                    <span>{f.label}</span>
                    <span className="font-mono text-amber-400">
                      {presetTuning.scenarioConfig[f.key] ?? f.default}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={presetTuning.scenarioConfig[f.key] ?? f.default}
                    onChange={(e) => presetTuning.onScenarioFieldChange(f.key, e.target.value)}
                    className="mt-2 w-full accent-amber-500"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </details>
  );
}
