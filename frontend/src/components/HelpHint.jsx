import { UITooltip } from './UITooltip';

export function HelpHint({ text, ariaLabel = 'More information' }) {
  return (
    <UITooltip content={text} placement="top">
      <button
        type="button"
        className="ml-0.5 inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-500 text-[10px] font-semibold leading-none text-slate-400 hover:border-amber-500/60 hover:text-amber-400"
        aria-label={ariaLabel}
      >
        ?
      </button>
    </UITooltip>
  );
}
