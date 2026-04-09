import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import LessonLayout from '../../components/LessonLayout';

function normalPDF(x, mean, std) {
  const exp = -0.5 * ((x - mean) / std) ** 2;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.E ** exp;
}

function normalCDF(x, mean, std) {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

function quantile(p, mean, std) {
  // Rational approximation for inverse normal
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    q =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    q =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    q =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  return mean + std * q;
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Beyond the Single Number</h2>
      <p className="text-slate-300 leading-relaxed">
        In the last lesson you saw that a point forecast — a single number — hides the range of
        what could actually happen. So what's the alternative?
      </p>
      <p className="text-slate-300 leading-relaxed">
        A <strong className="text-amber-400">probabilistic forecast</strong> doesn't give you one number.
        Instead, it gives you a <em>distribution</em> — a full picture of every possible demand value
        and how likely each one is.
      </p>
      <p className="text-slate-300 leading-relaxed">
        Think of it like this: instead of saying "demand will be 100 units," a probabilistic forecast says
        "there's a 10% chance demand is below 80, a 50% chance it's below 100, and a 90% chance it's below 125."
      </p>
      <p className="text-slate-300 leading-relaxed">
        This is massively more useful because it tells you about the <strong className="text-slate-100">
        tails</strong> — the unlikely-but-costly extreme outcomes that point forecasts completely ignore.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Key Vocabulary</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li><strong className="text-amber-400">Mean (μ)</strong> — The center of the distribution. This is your "best guess."</li>
          <li><strong className="text-amber-400">Standard Deviation (σ)</strong> — How spread out the distribution is. Higher = more uncertainty.</li>
          <li><strong className="text-amber-400">Quantile</strong> — A threshold value where a certain % of outcomes fall below. The 90th percentile (P90) means 90% of demand will be at or below that value.</li>
        </ul>
      </div>
    </div>
  );
}

function Section2() {
  const [mean, setMean] = useState(100);
  const [std, setStd] = useState(20);

  const chartData = useMemo(() => {
    const lo = mean - 4 * std;
    const hi = mean + 4 * std;
    const step = (hi - lo) / 120;
    const data = [];
    for (let x = lo; x <= hi; x += step) {
      data.push({
        x: Math.round(x * 10) / 10,
        density: normalPDF(x, mean, std),
      });
    }
    return data;
  }, [mean, std]);

  const p10 = quantile(0.1, mean, std);
  const p50 = quantile(0.5, mean, std);
  const p90 = quantile(0.9, mean, std);
  const probBetween = (normalCDF(p90, mean, std) - normalCDF(p10, mean, std)) * 100;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Shape the Distribution</h2>
      <p className="text-slate-300 leading-relaxed">
        Play with the sliders below to see how the mean and standard deviation change the shape
        of a demand distribution. Watch how the quantile markers move.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Mean (μ): <strong className="text-amber-400">{mean}</strong>
            </label>
            <input
              type="range"
              min={50}
              max={200}
              value={mean}
              onChange={(e) => setMean(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Std Dev (σ): <strong className="text-amber-400">{std}</strong>
            </label>
            <input
              type="range"
              min={5}
              max={50}
              value={std}
              onChange={(e) => setStd(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="x"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{ value: 'Demand', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(val) => val.toFixed(5)}
            />
            <Area type="monotone" dataKey="density" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
            <ReferenceLine x={Math.round(p10)} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'P10', fill: '#ef4444', fontSize: 11 }} />
            <ReferenceLine x={Math.round(p50)} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'P50', fill: '#22c55e', fontSize: 11 }} />
            <ReferenceLine x={Math.round(p90)} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'P90', fill: '#3b82f6', fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-red-950/30 border border-red-800/30 rounded p-2">
            <div className="text-lg font-bold text-red-400">{Math.round(p10)}</div>
            <div className="text-xs text-red-300">P10 (10th %ile)</div>
          </div>
          <div className="bg-green-950/30 border border-green-800/30 rounded p-2">
            <div className="text-lg font-bold text-green-400">{Math.round(p50)}</div>
            <div className="text-xs text-green-300">P50 (Median)</div>
          </div>
          <div className="bg-blue-950/30 border border-blue-800/30 rounded p-2">
            <div className="text-lg font-bold text-blue-400">{Math.round(p90)}</div>
            <div className="text-xs text-blue-300">P90 (90th %ile)</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <p className="text-sm text-slate-300">
          <strong className="text-slate-100">Notice:</strong> {probBetween.toFixed(0)}% of demand
          falls between P10 ({Math.round(p10)}) and P90 ({Math.round(p90)}). When σ is small, this
          range is tight — low uncertainty. Crank σ up and the range explodes. That's the uncertainty
          a point forecast hides from you.
        </p>
      </div>
    </div>
  );
}

function Section3() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">From Distribution to Decision</h2>
      <p className="text-slate-300 leading-relaxed">
        Now here's the million-dollar question: if you have a full probability distribution of demand,
        <em> which quantile should you order at?</em>
      </p>
      <p className="text-slate-300 leading-relaxed">
        If you order at the <strong className="text-red-400">P10</strong>, you'll have enough stock only
        10% of the time — you'll stockout 90% of days. Cheap on inventory, brutal on lost sales.
      </p>
      <p className="text-slate-300 leading-relaxed">
        If you order at the <strong className="text-blue-400">P90</strong>, you'll satisfy demand 90%
        of the time — but you'll carry excess inventory on most days.
      </p>
      <p className="text-slate-300 leading-relaxed">
        The "right" quantile to order at depends on something critical:{' '}
        <strong className="text-amber-400">the relative cost of overstocking vs. understocking</strong>.
        That's the economics of decisions — and it's the topic of an upcoming lesson.
      </p>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          A probabilistic forecast gives you the <em>full menu</em> of possibilities. Your job as a
          decision-maker is to pick the right point on that distribution based on the business context.
          The forecast provides information — the decision is yours.
        </p>
      </div>
    </div>
  );
}

export default function ProbabilisticForecasting() {
  return (
    <LessonLayout
      slug="probabilistic-forecasting"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
