import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import LessonLayout from '../../components/LessonLayout';

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateSeries(type, n = 60) {
  const rng = seededRng(type === 'stationary' ? 11 : type === 'trending' ? 22 : type === 'seasonal' ? 33 : 44);
  const data = [];
  for (let i = 0; i < n; i++) {
    let val;
    if (type === 'stationary') {
      val = 100 + (rng() - 0.5) * 30;
    } else if (type === 'trending') {
      val = 60 + i * 1.2 + (rng() - 0.5) * 20;
    } else if (type === 'seasonal') {
      val = 100 + 35 * Math.sin((2 * Math.PI * i) / 14) + (rng() - 0.5) * 15;
    } else {
      val = rng() < 0.6 ? 0 : 20 + rng() * 60;
    }
    data.push({ day: i + 1, demand: Math.max(0, Math.round(val)) });
  }
  return data;
}

const SERIES = {
  stationary: generateSeries('stationary'),
  trending: generateSeries('trending'),
  seasonal: generateSeries('seasonal'),
  intermittent: generateSeries('intermittent'),
};

const LABELS = {
  stationary: { title: 'Stationary', color: '#f59e0b', desc: 'Stable mean, random noise around a constant level.' },
  trending: { title: 'Trending', color: '#3b82f6', desc: 'Demand drifts upward (or downward) over time.' },
  seasonal: { title: 'Seasonal', color: '#22c55e', desc: 'Repeating cycle — peaks and valleys on a regular cadence.' },
  intermittent: { title: 'Intermittent', color: '#ef4444', desc: 'Lots of zeros punctuated by sporadic bursts.' },
};

function MiniChart({ data, color, title }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <div className="text-sm font-medium mb-1" style={{ color }}>{title}</div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <Line type="monotone" dataKey="demand" stroke={color} strokeWidth={1.5} dot={false} />
          <XAxis dataKey="day" hide />
          <YAxis hide domain={[0, 'auto']} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Not All Demand Looks the Same</h2>
      <p className="text-slate-300 leading-relaxed">
        Before you can model uncertainty, you need to recognize the <em>shape</em> of what you're
        dealing with. Demand data comes in wildly different flavors, and each one requires a different
        forecasting approach.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {Object.entries(LABELS).map(([key, meta]) => (
          <MiniChart key={key} data={SERIES[key]} color={meta.color} title={meta.title} />
        ))}
      </div>

      <div className="space-y-2">
        {Object.entries(LABELS).map(([key, meta]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <span className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
            <span className="text-slate-300"><strong className="text-slate-100">{meta.title}:</strong> {meta.desc}</span>
          </div>
        ))}
      </div>

      <p className="text-slate-300 leading-relaxed">
        Throwing the same forecasting method at all four of these would be like using a hammer for
        every home repair. Sometimes you need a screwdriver.
      </p>
    </div>
  );
}

function Section2() {
  const [trendStrength, setTrendStrength] = useState(50);
  const [seasonStrength, setSeasonStrength] = useState(50);
  const [noiseStrength, setNoiseStrength] = useState(50);
  const [showTrend, setShowTrend] = useState(false);
  const [showSeasonal, setShowSeasonal] = useState(false);
  const [showResidual, setShowResidual] = useState(false);

  const n = 60;
  const rng = useMemo(() => {
    const r = seededRng(77);
    return Array.from({ length: n }, () => r());
  }, []);

  const chartData = useMemo(() => {
    const trendScale = trendStrength / 50;
    const seasonScale = seasonStrength / 50;
    const noiseScale = noiseStrength / 50;

    return Array.from({ length: n }, (_, i) => {
      const trend = trendScale * i * 0.8;
      const seasonal = seasonScale * 30 * Math.sin((2 * Math.PI * i) / 14);
      const noise = noiseScale * (rng[i] - 0.5) * 40;
      const total = 100 + trend + seasonal + noise;
      return {
        day: i + 1,
        demand: Math.max(0, Math.round(total)),
        trend: Math.round(100 + trend),
        seasonal: Math.round(seasonal),
        residual: Math.round(noise),
      };
    });
  }, [trendStrength, seasonStrength, noiseStrength, rng]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Spot the Pattern</h2>
      <p className="text-slate-300 leading-relaxed">
        Adjust the sliders to mix trend, seasonality, and noise. Then toggle the decomposition
        overlays to see how "noisy" data actually has structure hiding inside.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Trend: <strong className="text-blue-400">{trendStrength}%</strong>
            </label>
            <input type="range" min={0} max={100} value={trendStrength}
              onChange={(e) => setTrendStrength(Number(e.target.value))} className="w-full accent-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Seasonality: <strong className="text-green-400">{seasonStrength}%</strong>
            </label>
            <input type="range" min={0} max={100} value={seasonStrength}
              onChange={(e) => setSeasonStrength(Number(e.target.value))} className="w-full accent-green-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Noise: <strong className="text-red-400">{noiseStrength}%</strong>
            </label>
            <input type="range" min={0} max={100} value={noiseStrength}
              onChange={(e) => setNoiseStrength(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'trend', label: 'Show Trend', active: showTrend, set: setShowTrend, color: 'blue' },
            { key: 'seasonal', label: 'Show Seasonal', active: showSeasonal, set: setShowSeasonal, color: 'green' },
            { key: 'residual', label: 'Show Residual', active: showResidual, set: setShowResidual, color: 'red' },
          ].map(({ key, label, active, set, color }) => (
            <button key={key} onClick={() => set(!active)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? `bg-${color}-600/20 border-${color}-500/50 text-${color}-400`
                  : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200'
              }`}
            >
              {active ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="demand" stroke="#f59e0b" strokeWidth={2} dot={false} name="Demand" />
            {showTrend && <Line type="monotone" dataKey="trend" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Trend" />}
            {showSeasonal && <Line type="monotone" dataKey="seasonal" stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Seasonal" />}
            {showResidual && <Line type="monotone" dataKey="residual" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Residual Noise" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Section3() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Why This Matters for Decisions</h2>
      <p className="text-slate-300 leading-relaxed">
        Here's the crucial connection: when you decompose demand into trend + seasonality + noise,
        the <strong className="text-red-400">residual noise</strong> is the <em>true uncertainty</em>.
      </p>
      <p className="text-slate-300 leading-relaxed">
        A seasonal product isn't "uncertain" because demand changes from summer to winter — that's
        <em> predictable</em>. The uncertainty is what's left <em>after</em> you account for the pattern.
        If you mistake the predictable swing for randomness, you'll either massively overstock in the
        off-season or panic-order during peak.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Pattern Recognition Cheat Sheet</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-800 rounded p-3">
            <div className="text-blue-400 font-medium">If you see a trend...</div>
            <div className="text-slate-400">Don't use a simple average — it'll always lag behind. Use exponential smoothing or regression that tracks the drift.</div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <div className="text-green-400 font-medium">If you see seasonality...</div>
            <div className="text-slate-400">Model the cycle explicitly. Your safety stock should be based on the deseasonalized residuals, not the raw series.</div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <div className="text-red-400 font-medium">If demand is intermittent...</div>
            <div className="text-slate-400">Normal distributions don't work here. You need methods that handle zero-inflated demand (like Croston's method).</div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <div className="text-amber-400 font-medium">If it looks stationary...</div>
            <div className="text-slate-400">Great — simpler models work fine. Focus your energy on quantifying the noise width and choosing the right quantile to order at.</div>
          </div>
        </div>
      </div>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          Recognizing the pattern in your data is the first step to properly quantifying uncertainty.
          Separate what's predictable from what's truly random — then build your safety stock and
          policies around the <em>random part</em>, not the whole series.
        </p>
      </div>
    </div>
  );
}

export default function DemandPatterns() {
  return (
    <LessonLayout
      slug="demand-patterns"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
