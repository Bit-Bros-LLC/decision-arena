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
  if (std === 0) return x === mean ? 1 : 0;
  const exp = -0.5 * ((x - mean) / std) ** 2;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.E ** exp;
}

function invNorm(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    q = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5; const r = q*q;
    q = ((((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q) / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1-p));
    q = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
  return q;
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Hidden Multiplier</h2>
      <p className="text-slate-300 leading-relaxed">
        In the Safety Stock lesson, you learned that safety stock = z &times; &sigma;. But that formula
        assumes you know <em>exactly</em> when your order will arrive. What if your supplier says
        "5 days" but it actually takes anywhere from 3 to 8?
      </p>
      <p className="text-slate-300 leading-relaxed">
        When lead time varies, you're not just covering demand uncertainty over a fixed window — you're
        covering demand uncertainty over a <strong className="text-amber-400">variable window</strong>.
        The uncertainty <em>compounds</em>.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">The Combined Formula</h3>
        <div className="bg-slate-900 rounded p-3 text-center font-mono text-amber-400 text-sm">
          &sigma;<sub>DLT</sub> = &radic;( LT &times; &sigma;<sub>d</sub>&sup2; + d&#x0304;&sup2; &times; &sigma;<sub>LT</sub>&sup2; )
        </div>
        <ul className="space-y-1 text-sm text-slate-300 mt-3">
          <li><strong className="text-amber-400">&sigma;<sub>d</sub></strong> — Standard deviation of daily demand</li>
          <li><strong className="text-amber-400">&sigma;<sub>LT</sub></strong> — Standard deviation of lead time (in days)</li>
          <li><strong className="text-amber-400">LT</strong> — Average lead time</li>
          <li><strong className="text-amber-400">d&#x0304;</strong> — Average daily demand</li>
        </ul>
        <p className="text-sm text-slate-400 mt-2">
          Notice: d&#x0304; is typically <em>much</em> larger than &sigma;<sub>d</sub>, so even small
          lead-time variability (&sigma;<sub>LT</sub>) can blow up the combined uncertainty.
        </p>
      </div>
    </div>
  );
}

function Section2() {
  const [sigmaD, setSigmaD] = useState(15);
  const [sigmaLT, setSigmaLT] = useState(1);
  const avgDemand = 100;
  const avgLT = 5;

  const sigmaDemandOnly = Math.sqrt(avgLT * sigmaD ** 2);
  const sigmaCombined = Math.sqrt(avgLT * sigmaD ** 2 + avgDemand ** 2 * sigmaLT ** 2);
  const meanDLT = avgDemand * avgLT;

  const demandOnlyData = useMemo(() => {
    const lo = meanDLT - 4 * Math.max(sigmaDemandOnly, 1);
    const hi = meanDLT + 4 * Math.max(sigmaDemandOnly, 1);
    const step = (hi - lo) / 120;
    const d = [];
    for (let x = lo; x <= hi; x += step) {
      d.push({ x: Math.round(x), demandOnly: normalPDF(x, meanDLT, sigmaDemandOnly) });
    }
    return d;
  }, [sigmaD, meanDLT, sigmaDemandOnly]);

  const combinedData = useMemo(() => {
    const lo = meanDLT - 4 * Math.max(sigmaCombined, 1);
    const hi = meanDLT + 4 * Math.max(sigmaCombined, 1);
    const step = (hi - lo) / 120;
    const d = [];
    for (let x = lo; x <= hi; x += step) {
      d.push({
        x: Math.round(x),
        combined: normalPDF(x, meanDLT, sigmaCombined),
        demandOnly: normalPDF(x, meanDLT, sigmaDemandOnly),
      });
    }
    return d;
  }, [sigmaD, sigmaLT, meanDLT, sigmaCombined, sigmaDemandOnly]);

  const pctIncrease = sigmaDemandOnly > 0
    ? (((sigmaCombined - sigmaDemandOnly) / sigmaDemandOnly) * 100).toFixed(0)
    : '∞';

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Expanding Window</h2>
      <p className="text-slate-300 leading-relaxed">
        Adjust both sliders and watch how the "demand during lead time" distribution changes.
        The orange curve ignores lead-time variability. The red curve includes it.
      </p>
      <p className="text-sm text-slate-400">
        Fixed: avg demand = {avgDemand}/day, avg lead time = {avgLT} days, mean demand during LT = {meanDLT}
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Demand Std Dev (&sigma;<sub>d</sub>): <strong className="text-amber-400">{sigmaD}</strong>
            </label>
            <input type="range" min={1} max={40} value={sigmaD}
              onChange={(e) => setSigmaD(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Lead Time Std Dev (&sigma;<sub>LT</sub>): <strong className="text-red-400">{sigmaLT}</strong> days
            </label>
            <input type="range" min={0} max={3} step={0.1} value={sigmaLT}
              onChange={(e) => setSigmaLT(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={combinedData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="x" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="demandOnly" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} name="Demand Uncertainty Only" />
            <Area type="monotone" dataKey="combined" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Combined (Demand + LT)" />
            <ReferenceLine x={meanDLT} stroke="#64748b" strokeDasharray="4 4" />
          </AreaChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-amber-950/30 border border-amber-800/30 rounded p-2">
            <div className="text-lg font-bold text-amber-400">{Math.round(sigmaDemandOnly)}</div>
            <div className="text-xs text-amber-300">&sigma; (demand only)</div>
          </div>
          <div className="bg-red-950/30 border border-red-800/30 rounded p-2">
            <div className="text-lg font-bold text-red-400">{Math.round(sigmaCombined)}</div>
            <div className="text-xs text-red-300">&sigma; (combined)</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded p-2">
            <div className="text-lg font-bold text-slate-200">+{pctIncrease}%</div>
            <div className="text-xs text-slate-400">Uncertainty increase</div>
          </div>
        </div>
      </div>

      {sigmaLT >= 1.5 && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4">
          <p className="text-sm text-red-300">
            <strong>Whoa.</strong> Lead time variability is now the dominant source of uncertainty.
            Even perfect demand forecasting wouldn't save you here — your supplier is the bottleneck.
          </p>
        </div>
      )}
    </div>
  );
}

function Section3() {
  const [sigmaD, setSigmaD] = useState(15);
  const [sigmaLT, setSigmaLT] = useState(1);
  const [targetSL, setTargetSL] = useState(95);
  const avgDemand = 100;
  const avgLT = 5;

  const sigmaCombined = Math.sqrt(avgLT * sigmaD ** 2 + avgDemand ** 2 * sigmaLT ** 2);
  const sigmaDemandOnly = Math.sqrt(avgLT * sigmaD ** 2);
  const z = invNorm(targetSL / 100);
  const ssCombined = Math.max(0, Math.round(z * sigmaCombined));
  const ssDemandOnly = Math.max(0, Math.round(z * sigmaDemandOnly));
  const extraSS = ssCombined - ssDemandOnly;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Double Jeopardy</h2>
      <p className="text-slate-300 leading-relaxed">
        Now set your variability levels and target service level. See how much <em>extra</em> safety
        stock you need when you honestly account for lead time variability.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              &sigma;<sub>d</sub>: <strong className="text-amber-400">{sigmaD}</strong>
            </label>
            <input type="range" min={1} max={40} value={sigmaD}
              onChange={(e) => setSigmaD(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              &sigma;<sub>LT</sub>: <strong className="text-red-400">{sigmaLT}</strong> days
            </label>
            <input type="range" min={0} max={3} step={0.1} value={sigmaLT}
              onChange={(e) => setSigmaLT(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Service Level: <strong className="text-green-400">{targetSL}%</strong>
            </label>
            <input type="range" min={80} max={99.5} step={0.5} value={targetSL}
              onChange={(e) => setTargetSL(Number(e.target.value))} className="w-full accent-green-500" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-amber-950/30 border border-amber-800/30 rounded p-3">
            <div className="text-2xl font-bold text-amber-400">{ssDemandOnly}</div>
            <div className="text-xs text-amber-300">Safety Stock</div>
            <div className="text-xs text-slate-500">(ignoring LT var.)</div>
          </div>
          <div className="bg-red-950/30 border border-red-800/30 rounded p-3">
            <div className="text-2xl font-bold text-red-400">{ssCombined}</div>
            <div className="text-xs text-red-300">Safety Stock</div>
            <div className="text-xs text-slate-500">(with LT var.)</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded p-3">
            <div className="text-2xl font-bold text-slate-100">+{extraSS}</div>
            <div className="text-xs text-slate-400">Extra units needed</div>
            <div className="text-xs text-slate-500">({ssDemandOnly > 0 ? ((extraSS / ssDemandOnly) * 100).toFixed(0) : '—'}% more)</div>
          </div>
        </div>
      </div>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          Ignoring lead time variability is like buying fire insurance while pretending arson doesn't
          exist. If your supplier is unreliable, that variability <em>multiplies</em> your demand
          uncertainty — and your safety stock formula needs to reflect it, or you'll stockout far
          more than your "target" service level suggests.
        </p>
      </div>
    </div>
  );
}

export default function LeadTimeVariability() {
  return (
    <LessonLayout
      slug="lead-time-variability"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
