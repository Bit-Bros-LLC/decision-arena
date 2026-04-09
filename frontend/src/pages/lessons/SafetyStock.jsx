import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
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

function invNorm(p) {
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
  return q;
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Buffer Between You and Disaster</h2>
      <p className="text-slate-300 leading-relaxed">
        You know demand is uncertain. You know stockouts are costly. So how do you protect yourself?
        The answer is <strong className="text-amber-400">safety stock</strong> — extra inventory held
        specifically to buffer against demand variability.
      </p>
      <p className="text-slate-300 leading-relaxed">
        Think of it like an emergency fund for your inventory. You don't <em>expect</em> to need it,
        but when demand spikes beyond your forecast, safety stock is what stands between you and empty
        shelves.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">The Formula</h3>
        <div className="bg-slate-900 rounded p-3 text-center font-mono text-amber-400">
          Safety Stock = z × σ
        </div>
        <ul className="space-y-1 text-sm text-slate-300">
          <li><strong className="text-amber-400">z</strong> — The "z-score" from your desired service level (e.g., z = 1.28 for 90%, z = 1.645 for 95%)</li>
          <li><strong className="text-amber-400">σ</strong> — Standard deviation of demand (your forecast uncertainty)</li>
        </ul>
        <p className="text-sm text-slate-400">
          Higher service level target → higher z → more safety stock → higher inventory cost.
          It's always a tradeoff.
        </p>
      </div>

      <p className="text-slate-300 leading-relaxed">
        The key insight: safety stock grows <em>exponentially</em> as you push toward extreme
        service levels. Going from 90% to 95% is relatively cheap. Going from 99% to 99.9% is
        enormously expensive.
      </p>
    </div>
  );
}

function Section2() {
  const [serviceLevel, setServiceLevel] = useState(95);
  const [sigma, setSigma] = useState(20);

  const z = useMemo(() => invNorm(serviceLevel / 100), [serviceLevel]);
  const safetyStockUnits = Math.max(0, Math.round(z * sigma));
  const holdingCostPerUnit = 0.5;
  const dailyHoldingCost = (safetyStockUnits * holdingCostPerUnit).toFixed(2);

  const curveData = useMemo(() => {
    const points = [];
    for (let sl = 50; sl <= 99.9; sl += 0.5) {
      const zVal = invNorm(sl / 100);
      points.push({
        serviceLevel: sl,
        safetyStock: Math.max(0, Math.round(zVal * sigma)),
      });
    }
    return points;
  }, [sigma]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Exponential Climb</h2>
      <p className="text-slate-300 leading-relaxed">
        Drag the slider to set your target service level and see how safety stock responds.
        Pay close attention to what happens above 95%.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Service Level: <strong className="text-amber-400">{serviceLevel}%</strong>
            </label>
            <input
              type="range"
              min={50}
              max={99.9}
              step={0.1}
              value={serviceLevel}
              onChange={(e) => setServiceLevel(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Demand Std Dev (σ): <strong className="text-amber-400">{sigma}</strong>
            </label>
            <input
              type="range"
              min={5}
              max={60}
              value={sigma}
              onChange={(e) => setSigma(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={curveData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="serviceLevel"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{ value: 'Service Level %', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{ value: 'Safety Stock (units)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }}
              formatter={(val, name) => [`${val} units`, 'Safety Stock']}
              labelFormatter={(val) => `${val}% service level`}
            />
            <Area type="monotone" dataKey="safetyStock" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
            <ReferenceLine
              x={serviceLevel}
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-blue-950/30 border border-blue-800/30 rounded p-2">
            <div className="text-lg font-bold text-blue-400">{z.toFixed(2)}</div>
            <div className="text-xs text-blue-300">z-score</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-800/30 rounded p-2">
            <div className="text-lg font-bold text-amber-400">{safetyStockUnits}</div>
            <div className="text-xs text-amber-300">Safety Stock Units</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded p-2">
            <div className="text-lg font-bold text-slate-200">${dailyHoldingCost}</div>
            <div className="text-xs text-slate-400">Daily Holding Cost</div>
          </div>
        </div>
      </div>

      {serviceLevel >= 99 && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4">
          <p className="text-sm text-red-300">
            <strong>Warning zone!</strong> At {serviceLevel}% service level, you need {safetyStockUnits} units
            of safety stock. That last few percent of protection is astronomically expensive.
            Most businesses find the sweet spot between 90–98%.
          </p>
        </div>
      )}
    </div>
  );
}

function Section3() {
  const sigma = 20;

  const tradeoffData = useMemo(() => {
    const points = [];
    for (let sl = 80; sl <= 99.5; sl += 0.5) {
      const z = invNorm(sl / 100);
      const ss = Math.max(0, z * sigma);
      const holdingCost = ss * 0.5;
      const stockoutRisk = (100 - sl);
      const stockoutCostRate = stockoutRisk * 2;
      points.push({
        sl: sl,
        holding: Math.round(holdingCost * 100) / 100,
        stockoutCost: Math.round(stockoutCostRate * 100) / 100,
        total: Math.round((holdingCost + stockoutCostRate) * 100) / 100,
      });
    }
    return points;
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Finding the Sweet Spot</h2>
      <p className="text-slate-300 leading-relaxed">
        Safety stock isn't free. More buffer means higher holding costs (storage, capital tied up,
        spoilage). Less buffer means more stockouts. The chart below shows how these two costs
        trade off:
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={tradeoffData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="sl"
              stroke="#94a3b8"
              tick={{ fontSize: 11 }}
              label={{ value: 'Service Level %', position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Cost ($)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(val) => `${val}% SL`}
            />
            <Line type="monotone" dataKey="holding" stroke="#f59e0b" strokeWidth={2} dot={false} name="Holding Cost" />
            <Line type="monotone" dataKey="stockoutCost" stroke="#ef4444" strokeWidth={2} dot={false} name="Stockout Cost" />
            <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Total Cost" />
          </LineChart>
        </ResponsiveContainer>

        <div className="flex justify-center gap-6 mt-2 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> Holding Cost</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> Stockout Cost</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block border-dashed" /> Total Cost</span>
        </div>
      </div>

      <p className="text-slate-300 leading-relaxed">
        The green dashed line (total cost) has a minimum — that's the economically optimal service
        level. Push past it and you're spending more on inventory holding than you're saving in
        avoided stockouts.
      </p>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          Safety stock is your insurance policy against demand uncertainty. But like all insurance,
          it has a premium. The optimal level balances the cost of holding extra inventory against
          the cost of stockouts. <strong className="text-slate-100">There is no "zero risk" — only
          intelligent risk management.</strong>
        </p>
      </div>
    </div>
  );
}

export default function SafetyStock() {
  return (
    <LessonLayout
      slug="safety-stock"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
