import { Children, cloneElement, useId } from 'react';

/**
 * Styled in-app tooltip (replaces native `title`). Shows on hover and when the trigger is focused.
 */
export function UITooltip({ content, children, placement = 'bottom', fullWidth = false }) {
  const id = useId();
  const child = Children.only(children);

  const posClasses =
    placement === 'top'
      ? 'bottom-full left-1/2 z-[100] mb-2 w-max max-w-[min(100vw-2rem,22rem)] -translate-x-1/2'
      : fullWidth
        ? 'left-0 top-full z-50 mt-2 w-full max-w-none'
        : 'left-0 top-full z-50 mt-2 w-max max-w-[min(100vw-2rem,22rem)]';

  const prev = child.props['aria-describedby'];
  const ariaDescribedBy = prev ? `${prev} ${id}` : id;

  return (
    <span className={`group/tooltip relative ${fullWidth ? 'block w-full' : 'inline-flex'}`}>
      {cloneElement(child, { 'aria-describedby': ariaDescribedBy })}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute ${posClasses} rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-left text-sm leading-relaxed text-slate-200 shadow-2xl ring-1 ring-black/20 transition-opacity duration-150 ease-out opacity-0 invisible group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100`}
      >
        {content}
      </span>
    </span>
  );
}
