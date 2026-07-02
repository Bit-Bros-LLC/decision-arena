import { FieldLabel } from './FieldLabel';
import { COST_TOOLTIPS } from '../lib/costTooltips';

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

/**
 * Dual sourcing toggle and optional premium / rescue fields.
 */
export default function DualSourceFields({
  costs,
  onCostChange,
  showToggle = true,
  showSubFields = true,
  toggleLabel = 'Enable dual sourcing',
  inputClassName = INPUT_CLASS,
  dataTourAnchor,
}) {
  const dualEnabled = Boolean(costs.dual_source_enabled);

  return (
    <div className="space-y-4" {...(dataTourAnchor ? { 'data-tour': dataTourAnchor } : {})}>
      {showToggle && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={dualEnabled}
            onChange={(e) => onCostChange('dual_source_enabled', e.target.checked)}
            className="rounded border-slate-600 accent-amber-500"
          />
          <FieldLabel
            label={toggleLabel}
            help={COST_TOOLTIPS['Dual sourcing enabled']}
          />
        </label>
      )}
      {showSubFields && dualEnabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel
              label="Dual-source premium / unit"
              help={COST_TOOLTIPS['Dual-source premium / unit']}
            />
            <input
              type="number"
              step="0.5"
              min="0"
              value={costs.dual_source_premium_per_unit}
              onChange={(e) => onCostChange('dual_source_premium_per_unit', e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <FieldLabel
              label="Supplier rescue % (0.5–1)"
              help={COST_TOOLTIPS['Supplier rescue %']}
            />
            <input
              type="number"
              step="0.05"
              min="0.5"
              max="1"
              value={costs.dual_source_rescue_pct}
              onChange={(e) => onCostChange('dual_source_rescue_pct', e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
