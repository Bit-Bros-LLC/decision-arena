import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
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

function normalCDF(x, mean, std) {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.8212560 + t * 1.3302744))));
  return z > 0 ? 1 - p : p;
}

function invNorm(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const pLow = 0.02425; const pHigh = 1 - pLow; let q;
  if (p < pLow) { q = Math.sqrt(-2*Math.log(p)); q = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  else if (p <= pHigh) { q = p-0.5; const r=q*q; q = ((((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q)/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  else { q = Math.sqrt(-2*Math.log(1-p)); q = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  return q;
}

function expectedCost(Q, mean, std, co, cu) {
  const nSteps = 200;
  const lo = mean - 4 * std;
  const hi = mean + 4 * std;
  const dx = (hi - lo) / nSteps;
  let cost = 0;
  for (let i = 0; i <= nSteps; i++) {
    const x = lo + i * dx;
    const pdf = normalPDF(x, mean, std);
    if (Q >= x) cost += co * (Q - x) * pdf * dx;
    else cost += cu * (x - Q) * pdf * dx;
  }
  return cost;
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">One Shot, One Order</h2>
      <p className="text-slate-300 leading-relaxed">
        The <strong className="text-amber-400">newsvendor problem</strong> is the simplest, purest
        form of the inventory decision. You get <em>one chance</em> to order before demand is revealed.
        No reorder, no safety net.
      </p>
      <p className="text-slate-300 leading-relaxed">
        Think newspapers (hence the name): you buy your stack in the morning, sell through the day.
        Unsold copies are worthless. Unmet demand is a lost sale. Same applies to:
      </p>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Seasonal fashion', detail: 'One buying window for the whole season' },
          { label: 'Concert merch', detail: 'Print before the tour, sell at venues' },
          { label: 'Holiday inventory', detail: 'Order in September for December' },
          { label: 'Perishable food', detail: 'Bake today, sell today, trash tonight' },
        ].map((ex) => (
          <div key={ex.label} className="bg-slate-800 border border-slate-700 rounded p-3">
            <div className="text-sm font-medium text-amber-400">{ex.label}</div>
            <div className="text-xs text-slate-400">{ex.detail}</div>
          </div>
        ))}
      </div>

      <p className="text-slate-300 leading-relaxed">
        The question is deceptively simple:{' '}
        <strong className="text-slate-100">how many units should you order?</strong> The answer,
        as you'll see, depends entirely on the demand distribution and the cost asymmetry.
      </p>
    </div>
  );
}

function Section2() {
  const [mean, setMean] = useState(100);
  const [std, setStd] = useState(20);
  const [costOver, setCostOver] = useState(3);
  const [costUnder, setCostUnder] = useState(10);

  const criticalRatio = costUnder / (costOver + costUnder);
  const optimalQ = Math.round(mean + std * invNorm(criticalRatio));

  const costCurve = useMemo(() => {
    const data = [];
    const lo = mean - 3 * std;
    const hi = mean + 3 * std;
    const step = Math.max(1, Math.round((hi - lo) / 80));
    for (let Q = lo; Q <= hi; Q += step) {
      data.push({
        Q: Math.round(Q),
        cost: Math.round(expectedCost(Q, mean, std, costOver, costUnder) * 100) / 100,
      });
    }
    return data;
  }, [mean, std, costOver, costUnder]);

  const minCost = Math.min(...costCurve.map((d) => d.cost));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Build Your Newsvendor</h2>
      <p className="text-slate-300 leading-relaxed">
        Set the demand distribution and cost parameters. The chart shows the <em>expected total cost</em>
        for every possible order quantity — and the optimal Q* that minimizes it.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Demand Mean: <strong className="text-amber-400">{mean}</strong>
            </label>
            <input type="range" min={50} max={200} value={mean}
              onChange={(e) => setMean(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Demand Std Dev: <strong className="text-amber-400">{std}</strong>
            </label>
            <input type="range" min={5} max={50} value={std}
              onChange={(e) => setStd(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Overage Cost (C<sub>o</sub>): <strong className="text-amber-400">${costOver}</strong>
            </label>
            <input type="range" min={1} max={20} value={costOver}
              onChange={(e) => setCostOver(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Underage Cost (C<sub>u</sub>): <strong className="text-red-400">${costUnder}</strong>
            </label>
            <input type="range" min={1} max={50} value={costUnder}
              onChange={(e) => setCostUnder(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={costCurve} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="Q" stroke="#94a3b8" tick={{ fontSize: 11 }}
              label={{ value: 'Order Quantity', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }}
              label={{ value: 'Expected Cost ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }}
              formatter={(val) => [`$${val}`, 'Expected Cost']} />
            <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <ReferenceLine x={optimalQ} stroke="#22c55e" strokeWidth={2}
              label={{ value: `Q* = ${optimalQ}`, fill: '#22c55e', fontSize: 12, fontWeight: 600 }} />
            <ReferenceLine x={mean} stroke="#64748b" strokeDasharray="4 4"
              label={{ value: 'Mean', fill: '#64748b', fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-green-950/30 border border-green-800/30 rounded p-2">
            <div className="text-lg font-bold text-green-400">{optimalQ}</div>
            <div className="text-xs text-green-300">Optimal Q*</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-800/30 rounded p-2">
            <div className="text-lg font-bold text-amber-400">{(criticalRatio * 100).toFixed(1)}%</div>
            <div className="text-xs text-amber-300">Critical Ratio</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded p-2">
            <div className="text-lg font-bold text-slate-200">${minCost.toFixed(2)}</div>
            <div className="text-xs text-slate-400">Min Expected Cost</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <p className="text-sm text-slate-300">
          <strong className="text-slate-100">Notice:</strong> Q* is{' '}
          {optimalQ > mean ? (
            <span>above the mean — because understocking costs more, you should carry extra.</span>
          ) : optimalQ < mean ? (
            <span>below the mean — because overstocking costs more, you should order lean.</span>
          ) : (
            <span>at the mean — costs are symmetric, so the average is optimal.</span>
          )}{' '}
          This is exactly the critical ratio quantile from the Economics of Decisions lesson.
        </p>
      </div>
    </div>
  );
}

function Section3() {
  const [costOver, setCostOver] = useState(3);
  const [costUnder, setCostUnder] = useState(12);
  const mean = 100;
  const std = 20;
  const numTrials = 100;

  const criticalRatio = costUnder / (costOver + costUnder);
  const optimalQ = Math.round(mean + std * invNorm(criticalRatio));

  const results = useMemo(() => {
    const rng = (() => { let s = 123; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();

    const boxMuller = () => {
      const u1 = rng();
      const u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    let newsvendorProfit = 0;
    let pointProfit = 0;
    const trialData = [];

    for (let i = 0; i < numTrials; i++) {
      const demand = Math.max(0, Math.round(mean + std * boxMuller()));

      const nvSold = Math.min(optimalQ, demand);
      const nvWaste = Math.max(0, optimalQ - demand);
      const nvShortage = Math.max(0, demand - optimalQ);
      const nvP = nvSold * 10 - nvWaste * costOver - nvShortage * costUnder;

      const ptSold = Math.min(mean, demand);
      const ptWaste = Math.max(0, mean - demand);
      const ptShortage = Math.max(0, demand - mean);
      const ptP = ptSold * 10 - ptWaste * costOver - ptShortage * costUnder;

      newsvendorProfit += nvP;
      pointProfit += ptP;
      trialData.push({ trial: i + 1, newsvendor: nvP, pointForecast: ptP });
    }

    return { newsvendorProfit, pointProfit, trialData };
  }, [costOver, costUnder, optimalQ]);

  const advantage = results.newsvendorProfit - results.pointProfit;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Point Forecast Trap</h2>
      <p className="text-slate-300 leading-relaxed">
        Same demand distribution, same costs — but now let's race two strategies over {numTrials} days:
        the <strong className="text-green-400">newsvendor-optimal Q*</strong> vs. ordering the{' '}
        <strong className="text-slate-100">point forecast (mean)</strong>. Adjust costs and watch the gap.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Overage Cost: <strong className="text-amber-400">${costOver}</strong>
            </label>
            <input type="range" min={1} max={15} value={costOver}
              onChange={(e) => setCostOver(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Underage Cost: <strong className="text-red-400">${costUnder}</strong>
            </label>
            <input type="range" min={1} max={50} value={costUnder}
              onChange={(e) => setCostUnder(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
        </div>

        <div className="text-center text-sm text-slate-400">
          Newsvendor orders <strong className="text-green-400">{optimalQ}</strong> units/day &nbsp;|&nbsp;
          Point forecast orders <strong className="text-slate-200">{mean}</strong> units/day
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="bg-green-950/30 border border-green-800/30 rounded p-3">
            <div className="text-2xl font-bold text-green-400">${results.newsvendorProfit.toLocaleString()}</div>
            <div className="text-xs text-green-300">Newsvendor Total Profit</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded p-3">
            <div className="text-2xl font-bold text-slate-300">${results.pointProfit.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Point Forecast Total Profit</div>
          </div>
        </div>

        <div className={`text-center p-3 rounded-lg border ${
          advantage > 0
            ? 'bg-green-950/30 border-green-800/40'
            : 'bg-slate-800 border-slate-700'
        }`}>
          <span className="text-sm text-slate-300">
            The distribution-aware newsvendor earns{' '}
            <strong className={advantage > 0 ? 'text-green-400' : 'text-slate-200'}>
              ${Math.abs(advantage).toLocaleString()} {advantage > 0 ? 'more' : 'less'}
            </strong>{' '}
            over {numTrials} days.
          </span>
        </div>
      </div>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          The newsvendor solution doesn't need a better forecast — it needs the <em>same</em> forecast
          expressed as a distribution instead of a single number. The distribution{' '}
          <strong className="text-slate-100">pays for itself</strong> by letting you calibrate your
          order to the economic stakes, not just the expected demand.
        </p>
      </div>
    </div>
  );
}

export default function NewsvendorProblem() {
  return (
    <LessonLayout
      slug="newsvendor-problem"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
