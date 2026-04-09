import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import LessonLayout from '../../components/LessonLayout';

function Section1() {
  const metrics = [
    {
      name: 'MAE',
      formula: 'avg( |actual - forecast| )',
      desc: 'Average absolute error in the same units as demand. Easy to interpret.',
      caveat: 'Treats overforecasting and underforecasting the same.',
    },
    {
      name: 'MAPE',
      formula: 'avg( |actual - forecast| / actual ) × 100%',
      desc: 'Percentage error — lets you compare across products with different scales.',
      caveat: 'Blows up when actuals are near zero. Penalizes overforecasts more than underforecasts. Widely misused.',
    },
    {
      name: 'RMSE',
      formula: '√( avg( (actual - forecast)² ) )',
      desc: 'Penalizes large errors disproportionately. Good when big misses are much worse than small ones.',
      caveat: 'Hard to interpret in business terms. Scale-dependent.',
    },
    {
      name: 'Bias',
      formula: 'avg( actual - forecast )',
      desc: 'Shows if your forecast systematically over- or under-predicts. Positive = underforecasting.',
      caveat: 'Can be near zero even with terrible forecasts (errors cancel out).',
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Metrics Zoo</h2>
      <p className="text-slate-300 leading-relaxed">
        Before we tear metrics apart, let's understand what each one actually measures.
        Here's the quick field guide:
      </p>

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.name} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-bold text-amber-400 w-14">{m.name}</span>
              <code className="text-xs text-slate-400 font-mono">{m.formula}</code>
            </div>
            <p className="text-sm text-slate-300">{m.desc}</p>
            <p className="text-xs text-red-400/80 mt-1">Caveat: {m.caveat}</p>
          </div>
        ))}
      </div>

      <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4">
        <p className="text-sm text-slate-300">
          <strong className="text-red-400">Critical warning:</strong> None of these metrics tell you
          if you made a <em>good decision</em>. A forecast with 5% MAPE can lead to worse business
          outcomes than one with 15% MAPE. How? Read on.
        </p>
      </div>
    </div>
  );
}

function Section2() {
  const [costUnder, setCostUnder] = useState(15);
  const costOver = 3;
  const numDays = 50;

  const data = useMemo(() => {
    const rng = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const boxMuller = () => {
      const u1 = rng(); const u2 = rng();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };

    const days = [];
    for (let i = 0; i < numDays; i++) {
      const actual = Math.max(20, Math.round(100 + 20 * boxMuller()));

      // Forecaster A: low MAPE but biased low (underforecasts by ~8%)
      const forecastA = Math.round(actual * (0.92 + 0.03 * boxMuller()));
      // Forecaster B: higher MAPE but unbiased
      const forecastB = Math.round(actual * (1.0 + 0.12 * boxMuller()));

      days.push({ actual, forecastA, forecastB });
    }
    return days;
  }, []);

  const metricsA = useMemo(() => {
    let sumAbsErr = 0, sumPctErr = 0, sumBias = 0;
    let profit = 0;
    data.forEach(({ actual, forecastA }) => {
      const err = Math.abs(actual - forecastA);
      sumAbsErr += err;
      sumPctErr += err / actual;
      sumBias += actual - forecastA;
      const sold = Math.min(forecastA, actual);
      const waste = Math.max(0, forecastA - actual);
      const shortage = Math.max(0, actual - forecastA);
      profit += sold * 10 - waste * costOver - shortage * costUnder;
    });
    return {
      mae: (sumAbsErr / data.length).toFixed(1),
      mape: ((sumPctErr / data.length) * 100).toFixed(1),
      bias: (sumBias / data.length).toFixed(1),
      profit: Math.round(profit),
    };
  }, [data, costUnder]);

  const metricsB = useMemo(() => {
    let sumAbsErr = 0, sumPctErr = 0, sumBias = 0;
    let profit = 0;
    data.forEach(({ actual, forecastB }) => {
      const err = Math.abs(actual - forecastB);
      sumAbsErr += err;
      sumPctErr += err / actual;
      sumBias += actual - forecastB;
      const sold = Math.min(forecastB, actual);
      const waste = Math.max(0, forecastB - actual);
      const shortage = Math.max(0, actual - forecastB);
      profit += sold * 10 - waste * costOver - shortage * costUnder;
    });
    return {
      mae: (sumAbsErr / data.length).toFixed(1),
      mape: ((sumPctErr / data.length) * 100).toFixed(1),
      bias: (sumBias / data.length).toFixed(1),
      profit: Math.round(profit),
    };
  }, [data, costUnder]);

  const aWins = metricsA.profit > metricsB.profit;

  const comparisonData = [
    { metric: 'MAPE', A: parseFloat(metricsA.mape), B: parseFloat(metricsB.mape) },
    { metric: 'MAE', A: parseFloat(metricsA.mae), B: parseFloat(metricsB.mae) },
  ];

  const profitData = [
    { name: 'Forecaster A', profit: metricsA.profit },
    { name: 'Forecaster B', profit: metricsB.profit },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The MAPE Trap</h2>
      <p className="text-slate-300 leading-relaxed">
        Two forecasters compete. You're hiring one to run your ordering. Here are their stats
        over {numDays} days:
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-950/20 border border-blue-800/30 rounded-lg p-4">
          <h3 className="text-sm font-bold text-blue-400 mb-2">Forecaster A</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>MAPE:</span>
              <strong className="text-blue-400">{metricsA.mape}%</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>MAE:</span>
              <strong className="text-blue-400">{metricsA.mae}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Bias:</span>
              <strong className={parseFloat(metricsA.bias) > 0 ? 'text-red-400' : 'text-green-400'}>
                {parseFloat(metricsA.bias) > 0 ? '+' : ''}{metricsA.bias}
              </strong>
            </div>
          </div>
        </div>
        <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-4">
          <h3 className="text-sm font-bold text-green-400 mb-2">Forecaster B</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>MAPE:</span>
              <strong className="text-green-400">{metricsB.mape}%</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>MAE:</span>
              <strong className="text-green-400">{metricsB.mae}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Bias:</span>
              <strong className={parseFloat(metricsB.bias) > 0 ? 'text-red-400' : 'text-green-400'}>
                {parseFloat(metricsB.bias) > 0 ? '+' : ''}{metricsB.bias}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <p className="text-slate-300 leading-relaxed">
        Forecaster A has the <em>better</em> MAPE and MAE. But Forecaster A is{' '}
        <strong className="text-red-400">biased low</strong> — they consistently underforecast.
        Forecaster B is noisier but <strong className="text-green-400">unbiased</strong>.
      </p>
      <p className="text-slate-300 leading-relaxed">
        Now adjust the cost of understocking and see who actually makes you more money:
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">
            Understocking Cost (C<sub>u</sub>): <strong className="text-red-400">${costUnder}</strong>
            <span className="text-slate-500 text-xs ml-2">(Overstocking fixed at ${costOver})</span>
          </label>
          <input type="range" min={1} max={40} value={costUnder}
            onChange={(e) => setCostUnder(Number(e.target.value))} className="w-full accent-red-500" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-center">
          <div className={`rounded-lg p-3 border ${aWins ? 'bg-blue-950/30 border-blue-800/40' : 'bg-slate-800 border-slate-700'}`}>
            <div className="text-2xl font-bold text-blue-400">${metricsA.profit.toLocaleString()}</div>
            <div className="text-xs text-blue-300">Forecaster A Profit</div>
            <div className="text-xs text-slate-500">({metricsA.mape}% MAPE)</div>
          </div>
          <div className={`rounded-lg p-3 border ${!aWins ? 'bg-green-950/30 border-green-800/40' : 'bg-slate-800 border-slate-700'}`}>
            <div className="text-2xl font-bold text-green-400">${metricsB.profit.toLocaleString()}</div>
            <div className="text-xs text-green-300">Forecaster B Profit</div>
            <div className="text-xs text-slate-500">({metricsB.mape}% MAPE)</div>
          </div>
        </div>

        <div className={`text-center p-3 rounded-lg border ${
          !aWins ? 'bg-green-950/30 border-green-800/40' : 'bg-blue-950/30 border-blue-800/40'
        }`}>
          <p className="text-sm text-slate-300">
            {!aWins ? (
              <>
                The "worse" Forecaster B earns{' '}
                <strong className="text-green-400">${(metricsB.profit - metricsA.profit).toLocaleString()} more</strong>{' '}
                despite having higher MAPE. Bias direction matters more than accuracy.
              </>
            ) : (
              <>
                At this cost level, Forecaster A's bias isn't punished enough. Try increasing
                the understocking cost to see the trap spring.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function Section3() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Metrics Serve Decisions, Not the Other Way Around</h2>
      <p className="text-slate-300 leading-relaxed">
        Here's what just happened: you saw a forecaster with <em>objectively better accuracy metrics</em>
        produce <em>objectively worse business results</em>. This isn't a trick — it's how the real
        world works when costs are asymmetric.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Why Metrics Mislead</h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">1.</span>
            <span><strong className="text-slate-100">MAPE is asymmetric by construction.</strong> It penalizes overforecasting more than underforecasting — the exact opposite of what most businesses need.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">2.</span>
            <span><strong className="text-slate-100">Bias direction matters enormously.</strong> If understocking is 5x worse than overstocking, a consistently-low forecaster will destroy your P&L even with "good" MAPE.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">3.</span>
            <span><strong className="text-slate-100">Error distribution matters more than average error.</strong> Two forecasters with the same MAE can have wildly different tail risks. One has small consistent errors; the other is usually perfect but occasionally catastrophically wrong.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-red-400 mt-0.5">4.</span>
            <span><strong className="text-slate-100">Optimizing for MAPE optimizes for the wrong thing.</strong> You end up with forecasts that look great on a dashboard and terrible in the warehouse.</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">What to Do Instead</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li><strong className="text-amber-400">Track bias separately.</strong> Know which direction your forecast leans — and whether that lean aligns with your cost structure.</li>
          <li><strong className="text-amber-400">Evaluate with decision metrics.</strong> Don't just measure forecast accuracy — measure total profit, service level, or total cost under the policy driven by that forecast.</li>
          <li><strong className="text-amber-400">Use quantile scores for probabilistic forecasts.</strong> If you're producing distributions (as you should be), evaluate at the quantile that matters for your decision.</li>
          <li><strong className="text-amber-400">Never let a single metric drive behavior.</strong> A dashboard with only MAPE will cause forecast manipulation. Pair it with bias, coverage, and economic outcome metrics.</li>
        </ul>
      </div>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          Forecast accuracy is not the goal — <strong className="text-slate-100">decision quality is
          the goal</strong>. Evaluate your forecasts by the quality of decisions they enable, not by
          how close they land to the actual. If you optimize for MAPE, you'll get a great MAPE and a
          terrible P&L. Don't be that company.
        </p>
      </div>
    </div>
  );
}

export default function ForecastEvaluation() {
  return (
    <LessonLayout
      slug="forecast-evaluation"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
