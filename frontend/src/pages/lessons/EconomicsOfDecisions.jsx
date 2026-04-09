import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import LessonLayout from '../../components/LessonLayout';

function normalPDF(x, mean, std) {
  const exp = -0.5 * ((x - mean) / std) ** 2;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.E ** exp;
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Not All Mistakes Are Equal</h2>
      <p className="text-slate-300 leading-relaxed">
        Here's a scenario: you run a hospital pharmacy. You're deciding how many units of a critical
        medication to stock for tomorrow.
      </p>
      <p className="text-slate-300 leading-relaxed">
        If you order <strong className="text-amber-400">too many</strong>, the extras expire and you
        lose $2 per unit. Annoying, but manageable.
      </p>
      <p className="text-slate-300 leading-relaxed">
        If you order <strong className="text-red-400">too few</strong>, patients don't get their
        medication. Emergency procurement costs $50 per unit, plus potential health consequences.
      </p>
      <p className="text-slate-300 leading-relaxed">
        The cost of being short is <strong className="text-slate-100">25 times</strong> the cost of
        having excess. This <em className="text-amber-400">asymmetry</em> should dramatically shift
        where you set your order quantity — yet most people still anchor on the "expected" demand.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Real-World Asymmetry Examples</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-800 rounded p-3">
            <div className="text-amber-400 font-medium">Perishable Groceries</div>
            <div className="text-slate-400">Overstock: donate/trash ($1 loss). Understock: lost sale + unhappy customer ($5 loss).</div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <div className="text-amber-400 font-medium">Airplane Seats</div>
            <div className="text-slate-400">Overbook: pay rebooking ($800). Underbook: empty seat ($0 revenue on $400 ticket).</div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <div className="text-amber-400 font-medium">Server Capacity</div>
            <div className="text-slate-400">Over-provision: wasted cloud spend ($). Under-provision: site goes down ($$$$).</div>
          </div>
          <div className="bg-slate-800 rounded p-3">
            <div className="text-amber-400 font-medium">Fashion Retail</div>
            <div className="text-slate-400">Overstock: deep discounts (50% off). Understock: missed trend, lost brand buzz.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section2() {
  const [costOver, setCostOver] = useState(2);
  const [costUnder, setCostUnder] = useState(10);

  const criticalRatio = costUnder / (costOver + costUnder);
  const mean = 100;
  const std = 20;

  // Find optimal Q via critical ratio on normal distribution (inverse CDF approximation)
  const optimalQ = useMemo(() => {
    const p = criticalRatio;
    // Rational approx for inverse normal
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
    let q;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      q = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      const r = q * q;
      q = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      q = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    return Math.round(mean + std * q);
  }, [criticalRatio]);

  const distData = useMemo(() => {
    const lo = mean - 3.5 * std;
    const hi = mean + 3.5 * std;
    const step = (hi - lo) / 100;
    const data = [];
    for (let x = lo; x <= hi; x += step) {
      data.push({
        x: Math.round(x),
        density: normalPDF(x, mean, std),
      });
    }
    return data;
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Critical Ratio</h2>
      <p className="text-slate-300 leading-relaxed">
        The <strong className="text-amber-400">critical ratio</strong> (or newsvendor ratio) tells you
        the optimal quantile to order at, based purely on the cost asymmetry:
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-center">
        <div className="text-slate-400 text-sm mb-1">Critical Ratio =</div>
        <div className="text-2xl font-mono text-amber-400">
          C<sub>u</sub> / (C<sub>o</sub> + C<sub>u</sub>) = {costUnder} / ({costOver} + {costUnder}) ={' '}
          <span className="text-white">{(criticalRatio * 100).toFixed(1)}%</span>
        </div>
        <div className="text-sm text-slate-500 mt-1">
          You should order at the <strong className="text-amber-400">{(criticalRatio * 100).toFixed(1)}th</strong> percentile
        </div>
      </div>

      <p className="text-slate-300 leading-relaxed">
        Adjust the costs below and watch how the optimal order quantity shifts on the distribution.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Overstocking Cost (C<sub>o</sub>): <strong className="text-amber-400">${costOver}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={30}
              value={costOver}
              onChange={(e) => setCostOver(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Understocking Cost (C<sub>u</sub>): <strong className="text-red-400">${costUnder}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              value={costUnder}
              onChange={(e) => setCostUnder(Number(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={distData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="density" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />
            <ReferenceLine x={mean} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Mean', fill: '#64748b', fontSize: 11 }} />
            <ReferenceLine x={optimalQ} stroke="#22c55e" strokeWidth={2} label={{ value: `Order: ${optimalQ}`, fill: '#22c55e', fontSize: 12, fontWeight: 600 }} />
          </AreaChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-amber-950/30 border border-amber-800/30 rounded p-2">
            <div className="text-lg font-bold text-amber-400">${costOver}</div>
            <div className="text-xs text-amber-300">Cost per excess unit</div>
          </div>
          <div className="bg-green-950/30 border border-green-800/30 rounded p-2">
            <div className="text-lg font-bold text-green-400">{optimalQ}</div>
            <div className="text-xs text-green-300">Optimal Order Qty</div>
          </div>
          <div className="bg-red-950/30 border border-red-800/30 rounded p-2">
            <div className="text-lg font-bold text-red-400">${costUnder}</div>
            <div className="text-xs text-red-300">Cost per short unit</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section3() {
  const scenarios = [
    { label: 'Symmetric ($5 / $5)', co: 5, cu: 5 },
    { label: 'Mild asymmetry ($2 / $10)', co: 2, cu: 10 },
    { label: 'Heavy asymmetry ($1 / $25)', co: 1, cu: 25 },
    { label: 'Extreme ($1 / $50)', co: 1, cu: 50 },
  ];

  const data = scenarios.map((s) => ({
    name: s.label,
    ratio: Math.round((s.cu / (s.co + s.cu)) * 100),
    co: s.co,
    cu: s.cu,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Big Picture</h2>
      <p className="text-slate-300 leading-relaxed">
        Look at how the optimal percentile shifts as cost asymmetry increases:
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 11 }} unit="%" />
            <YAxis dataKey="name" type="category" width={180} stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }}
              formatter={(val) => `${val}th percentile`}
            />
            <Bar dataKey="ratio" radius={[0, 4, 4, 0]} name="Order at percentile">
              {data.map((entry, i) => (
                <Cell key={i} fill={['#64748b', '#f59e0b', '#f97316', '#ef4444'][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-slate-300 leading-relaxed">
        When costs are symmetric (50th percentile), you order at the median — the point forecast.
        But as the cost of understocking grows relative to overstocking, the optimal order pushes
        further into the right tail.
      </p>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          The "right" decision isn't just about predicting demand accurately — it's about understanding
          the <em>economic consequences</em> of being wrong in each direction. A good forecast combined
          with the wrong decision framework is still a bad outcome. <strong className="text-slate-100">
          Decisions, not forecasts, drive profits.</strong>
        </p>
      </div>
    </div>
  );
}

export default function EconomicsOfDecisions() {
  return (
    <LessonLayout
      slug="economics-of-decisions"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
