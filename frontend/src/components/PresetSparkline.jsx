import { Line, LineChart, ReferenceLine, ResponsiveContainer } from 'recharts';

export default function PresetSparkline({
  data = [],
  boundary = null,
  loading = false,
  error = null,
  height = 72,
}) {
  if (loading) {
    return (
      <div
        className="animate-pulse rounded bg-slate-700/60"
        style={{ height }}
        aria-hidden="true"
      />
    );
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded border border-red-500/30 bg-red-500/5 px-2 text-center text-[10px] text-red-400"
        style={{ height }}
      >
        Preview unavailable
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        className="rounded border border-dashed border-slate-600 bg-slate-900/40"
        style={{ height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          {boundary != null && (
            <ReferenceLine x={boundary} stroke="#475569" strokeDasharray="2 2" />
          )}
          <Line
            type="monotone"
            dataKey="demand"
            stroke="#38bdf8"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
