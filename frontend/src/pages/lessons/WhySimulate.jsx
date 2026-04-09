import { useState, useMemo, useCallback } from 'react';
import {
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

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">When Formulas Aren't Enough</h2>
      <p className="text-slate-300 leading-relaxed">
        Safety stock formulas are elegant. They assume demand is normally distributed, lead times are
        constant, and your ordering policy is simple. But real supply chains have:
      </p>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Minimum order quantities', detail: 'Can\'t order 1 unit — the supplier requires 50+.' },
          { label: 'Capacity constraints', detail: 'Your warehouse holds 500 max, regardless of what the formula says.' },
          { label: 'Correlated demand', detail: 'When one product spikes, so do three others.' },
          { label: 'Non-normal distributions', detail: 'Intermittent demand with lots of zeros isn\'t a bell curve.' },
          { label: 'Multi-echelon effects', detail: 'Your safety stock interacts with your supplier\'s safety stock.' },
          { label: 'Black swan events', detail: 'Supplier bankruptcies, port closures, pandemics — no formula predicts these.' },
        ].map((item) => (
          <div key={item.label} className="bg-slate-800 border border-slate-700 rounded p-3">
            <div className="text-sm font-medium text-amber-400">{item.label}</div>
            <div className="text-xs text-slate-400 mt-1">{item.detail}</div>
          </div>
        ))}
      </div>

      <p className="text-slate-300 leading-relaxed">
        When the math gets messy, there's a universal backup plan:{' '}
        <strong className="text-amber-400">simulate it</strong>. Generate thousands of possible
        scenarios, run your policy against each one, and look at the <em>distribution</em> of outcomes.
      </p>
    </div>
  );
}

function Section2() {
  const [simCount, setSimCount] = useState(0);
  const [allResults, setAllResults] = useState([]);

  const runBatch = useCallback((n) => {
    const rng = (() => {
      let s = Date.now() % 2147483647 || 1;
      return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    })();

    const boxMuller = () => {
      const u1 = rng();
      const u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    const mean = 100;
    const std = 20;
    const orderQty = 110;
    const sellPrice = 10;
    const costOver = 3;
    const costUnder = 8;
    const days = 30;

    const newResults = [];
    for (let i = 0; i < n; i++) {
      let totalProfit = 0;
      for (let d = 0; d < days; d++) {
        const demand = Math.max(0, Math.round(mean + std * boxMuller()));
        const sold = Math.min(orderQty, demand);
        const waste = Math.max(0, orderQty - demand);
        const shortage = Math.max(0, demand - orderQty);
        totalProfit += sold * sellPrice - waste * costOver - shortage * costUnder;
      }
      newResults.push(totalProfit);
    }

    setAllResults((prev) => [...prev, ...newResults]);
    setSimCount((prev) => prev + n);
  }, []);

  const reset = useCallback(() => {
    setAllResults([]);
    setSimCount(0);
  }, []);

  const histogram = useMemo(() => {
    if (allResults.length === 0) return [];
    const min = Math.min(...allResults);
    const max = Math.max(...allResults);
    const bins = 20;
    const binWidth = (max - min) / bins || 1;
    const counts = Array(bins).fill(0);
    allResults.forEach((v) => {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      counts[idx]++;
    });
    return counts.map((count, i) => ({
      range: `$${Math.round(min + i * binWidth).toLocaleString()}`,
      rangeVal: Math.round(min + i * binWidth),
      count,
      pct: ((count / allResults.length) * 100).toFixed(1),
    }));
  }, [allResults]);

  const stats = useMemo(() => {
    if (allResults.length === 0) return null;
    const sorted = [...allResults].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p5 = sorted[Math.floor(sorted.length * 0.05)] || sorted[0];
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    return { mean: Math.round(mean), p5: Math.round(p5), p95: Math.round(p95), min: Math.round(min), max: Math.round(max) };
  }, [allResults]);

  const firstResult = allResults.length > 0 ? allResults[0] : null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Build a Distribution From Scratch</h2>
      <p className="text-slate-300 leading-relaxed">
        Imagine you're testing a policy: order 110 units/day for 30 days with uncertain demand.
        Click the buttons to run simulations and watch the profit distribution materialize.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {[1, 10, 100, 1000].map((n) => (
            <button key={n} onClick={() => runBatch(n)}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors">
              +{n.toLocaleString()} sim{n > 1 ? 's' : ''}
            </button>
          ))}
          <button onClick={reset}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors ml-auto">
            Reset
          </button>
          <span className="text-sm text-slate-400">
            Total: <strong className="text-amber-400">{simCount.toLocaleString()}</strong> simulations
          </span>
        </div>

        {simCount === 0 ? (
          <div className="text-center py-16 text-slate-500">
            Click a button above to start simulating...
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={histogram} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="range" stroke="#94a3b8" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(histogram.length / 8))} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }}
                  formatter={(val, name) => [val, 'Simulations']} labelFormatter={(val) => `Profit: ${val}`} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {histogram.map((entry, i) => (
                    <Cell key={i} fill={firstResult !== null && entry.rangeVal <= firstResult && (i === histogram.length - 1 || histogram[i + 1].rangeVal > firstResult) ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
                {stats && <ReferenceLine x={histogram.find((h) => h.rangeVal >= stats.mean)?.range} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 4" />}
              </BarChart>
            </ResponsiveContainer>

            {stats && (
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="bg-red-950/30 border border-red-800/30 rounded p-2">
                  <div className="text-sm font-bold text-red-400">${stats.min.toLocaleString()}</div>
                  <div className="text-xs text-red-300">Worst</div>
                </div>
                <div className="bg-amber-950/30 border border-amber-800/30 rounded p-2">
                  <div className="text-sm font-bold text-amber-400">${stats.p5.toLocaleString()}</div>
                  <div className="text-xs text-amber-300">P5</div>
                </div>
                <div className="bg-green-950/30 border border-green-800/30 rounded p-2">
                  <div className="text-sm font-bold text-green-400">${stats.mean.toLocaleString()}</div>
                  <div className="text-xs text-green-300">Mean</div>
                </div>
                <div className="bg-blue-950/30 border border-blue-800/30 rounded p-2">
                  <div className="text-sm font-bold text-blue-400">${stats.p95.toLocaleString()}</div>
                  <div className="text-xs text-blue-300">P95</div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-2">
                  <div className="text-sm font-bold text-slate-200">${stats.max.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">Best</div>
                </div>
              </div>
            )}

            {firstResult !== null && simCount >= 10 && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <p className="text-sm text-slate-300">
                  Your very first simulation returned{' '}
                  <strong className="text-red-400">${firstResult.toLocaleString()}</strong>{' '}
                  (the red bar). If you'd stopped there, you'd think that <em>was</em> the answer.
                  But with {simCount.toLocaleString()} simulations, you can see the full range
                  from ${stats?.min.toLocaleString()} to ${stats?.max.toLocaleString()}.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section3() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Thinking in Distributions, Not Points</h2>
      <p className="text-slate-300 leading-relaxed">
        Here's the mental model shift that simulation forces on you:
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-950/20 border border-red-800/30 rounded p-3">
            <div className="text-sm font-medium text-red-400 mb-1">Point Thinking</div>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>"What will my profit be?"</li>
              <li>"Will this policy work?"</li>
              <li>"Is 95% service level enough?"</li>
            </ul>
          </div>
          <div className="bg-green-950/20 border border-green-800/30 rounded p-3">
            <div className="text-sm font-medium text-green-400 mb-1">Distribution Thinking</div>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>"What's the range of possible profits?"</li>
              <li>"How often does this policy fail badly?"</li>
              <li>"What's my downside in the worst 5% of cases?"</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-slate-300 leading-relaxed">
        When you backtest in Decision Arena, you're running a simulation against one scenario. That's
        useful — but it's <em>one draw</em> from the distribution. A policy that looks great on one
        scenario might be terrible on another.
      </p>
      <p className="text-slate-300 leading-relaxed">
        The lesson: don't ask <em>"what will happen?"</em> — ask{' '}
        <strong className="text-amber-400">
          "what's the range of what could happen, and can I live with the worst case?"
        </strong>
      </p>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          Simulation is the universal tool for decision-making under uncertainty. It doesn't require
          elegant math or simplifying assumptions. Generate scenarios, run your policy, observe the
          distribution of outcomes. The tails will tell you things the average never could.
        </p>
      </div>
    </div>
  );
}

export default function WhySimulate() {
  return (
    <LessonLayout
      slug="why-simulate"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
