const KIND_STYLES = {
  forecast: {
    label: 'Forecast',
    badge: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
  },
  event: {
    label: 'Event',
    badge: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  },
};

function kindStyle(kind) {
  return KIND_STYLES[kind] || { label: 'News', badge: 'text-slate-300 border-slate-500/30 bg-slate-500/10' };
}

function NewsCard({ item, upcoming }) {
  const style = kindStyle(item.kind);
  return (
    <li
      className={`rounded-lg border p-3 ${
        upcoming ? 'border-sky-500/40 bg-sky-500/5' : 'border-slate-700 bg-slate-900/60'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.badge}`}>
          {style.label}
        </span>
        {upcoming ? (
          <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
            Upcoming · month {item.about_round}
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">Month {item.about_round}</span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-slate-100">{item.headline}</p>
      {item.body && <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.body}</p>}
    </li>
  );
}

/**
 * Renders timed "news" hints for a narrative season.
 *
 * - When `activeRoundNumber` is a number (student view), only items whose
 *   `reveal_round <= activeRoundNumber` are shown; items about a future round
 *   render as "Upcoming" forecasts.
 * - When `activeRoundNumber` is null (preview / professor), every item is shown.
 */
export default function StoryNews({ news, activeRoundNumber = null, emptyText = 'No news yet.' }) {
  const items = Array.isArray(news) ? news : [];
  const isPreview = activeRoundNumber == null;

  const visible = isPreview
    ? [...items]
    : items.filter((n) => Number(n.reveal_round) <= Number(activeRoundNumber));

  visible.sort((a, b) => {
    const r = Number(a.reveal_round) - Number(b.reveal_round);
    if (r !== 0) return r;
    return Number(a.about_round) - Number(b.about_round);
  });

  if (visible.length === 0) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {visible.map((item, i) => (
        <NewsCard
          key={`${item.reveal_round}-${item.about_round}-${i}`}
          item={item}
          upcoming={!isPreview && Number(item.about_round) > Number(activeRoundNumber)}
        />
      ))}
    </ul>
  );
}
