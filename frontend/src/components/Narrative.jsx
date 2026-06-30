function renderBold(segment, keyPrefix) {
  const parts = String(segment).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

/**
 * Renders lightly-formatted narrative prose: paragraphs split on blank lines,
 * with **bold** spans.
 */
export default function Narrative({ text, className = '' }) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\n+/);
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-slate-300 ${className}`}>
      {paragraphs.map((para, i) => (
        <p key={i}>{renderBold(para, i)}</p>
      ))}
    </div>
  );
}
