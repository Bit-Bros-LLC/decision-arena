import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function PresetPreviewChart({
  chartData = [],
  boundary = null,
  roundBoundaries = [],
  height = 320,
}) {
  if (!chartData.length || boundary == null) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900/40 text-sm text-slate-500"
        style={{ height }}
      >
        No preview data
      </div>
    );
  }

  return (
    <div className="w-full min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="x" stroke="#94a3b8" fontSize={11} />
          <YAxis stroke="#94a3b8" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px',
            }}
          />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
          {roundBoundaries.map((x, i) => (
            <ReferenceLine
              key={`rb-${i}`}
              x={x}
              stroke="#475569"
              strokeDasharray="2 4"
              ifOverflow="extendDomain"
            />
          ))}
          <ReferenceLine
            x={boundary}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{
              value: 'Fiscal year starts',
              position: 'top',
              fill: '#94a3b8',
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="demandHistorical"
            name="Historical demand"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="demandActual"
            name="Fiscal year demand"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
