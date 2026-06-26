import { HelpHint } from './HelpHint';

export function FieldLabel({ label, help }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      {help ? <HelpHint text={help} ariaLabel={`About ${label}`} /> : null}
    </div>
  );
}
