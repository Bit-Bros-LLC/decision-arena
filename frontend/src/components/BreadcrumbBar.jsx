import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getBreadcrumbsFromPathname } from '../lib/routeBreadcrumbs';
import { useBreadcrumbSnapshot } from '../context/BreadcrumbLabelsContext';

/** @param {Array<{ label: string, to: string | null, overrideId?: string }>} base */
function mergeCrumbs(base, snapshot) {
  const { labels, afterDashboard } = snapshot;
  const withLabels = base.map((c) => ({
    ...c,
    label: c.overrideId && labels[c.overrideId] ? labels[c.overrideId] : c.label,
  }));
  if (!afterDashboard?.length) return withLabels;
  const [first, ...rest] = withLabels;
  const inserted = afterDashboard.map((x) => ({ label: x.label, to: x.to }));
  return [first, ...inserted, ...rest];
}

export default function BreadcrumbBar() {
  const { pathname } = useLocation();
  const snapshot = useBreadcrumbSnapshot();

  const items = useMemo(
    () => mergeCrumbs(getBreadcrumbsFromPathname(pathname), snapshot),
    [pathname, snapshot],
  );

  return (
    <div className="border-b border-slate-700 bg-slate-900/80">
      <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-4 py-2">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {items.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-slate-600 select-none" aria-hidden>
                  ›
                </span>
              )}
              {c.to != null ? (
                <Link to={c.to} className="text-amber-400 hover:text-amber-300 transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className="text-slate-300 font-medium" aria-current="page">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
