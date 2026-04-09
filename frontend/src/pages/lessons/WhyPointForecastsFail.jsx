import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import LessonLayout from '../../components/LessonLayout';

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generateScenarios(baseForecast, numPaths, numDays) {
  const paths = [];
  for (let p = 0; p < numPaths; p++) {
    const rng = seededRandom(42 + p * 17);
    const path = [];
    let drift = (rng() - 0.5) * 20;
    for (let d = 0; d < numDays; d++) {
      drift += (rng() - 0.5) * 8;
      const noise = (rng() - 0.5) * 30;
      path.push(Math.max(10, Math.round(baseForecast[d] + drift + noise)));
    }
    paths.push(path);
  }
  return paths;
}

const NUM_DAYS = 14;
const BASE_DEMAND = Array.from({ length: NUM_DAYS }, (_, i) => 100 + Math.round(10 * Math.sin(i / 2)));
const SCENARIOS = generateScenarios(BASE_DEMAND, 8, NUM_DAYS);
const COLORS = ['#f43f5e', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6', '#eab308'];

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Illusion of Certainty</h2>
      <p className="text-slate-300 leading-relaxed">
        Imagine you're a retail manager ordering inventory for the next two weeks. Your forecasting
        system tells you: <strong className="text-amber-400">"Expect 100 units of demand per day."</strong>
      </p>
      <p className="text-slate-300 leading-relaxed">
        Sounds simple, right? Just order 100 units each day and you're golden. But here's the
        problem — <strong className="text-slate-100">that single number hides a world of uncertainty</strong>.
        Real demand is noisy, volatile, and rarely lands exactly on the forecast.
      </p>
      <p className="text-slate-300 leading-relaxed">
        A <em className="text-amber-400">point forecast</em> gives you one number — the expected value.
        But it tells you nothing about <em>how wrong</em> it could be, or <em>in which direction</em>.
        It's like a weather forecast that says "72°F" without mentioning the hurricane approaching.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mt-4">
        <p className="text-sm text-slate-400 italic">
          "All models are wrong, but some are useful." — George Box
        </p>
        <p className="text-sm text-slate-400 mt-2">
          A point forecast isn't useless — but treating it as <em>the truth</em> is where things go wrong.
        </p>
      </div>
    </div>
  );
}

function Section2() {
  const [revealed, setRevealed] = useState(false);

  const chartData = useMemo(() => {
    return BASE_DEMAND.map((val, i) => {
      const point = { day: `Day ${i + 1}`, forecast: val };
      if (revealed) {
        SCENARIOS.forEach((s, si) => {
          point[`actual_${si}`] = s[i];
        });
      }
      return point;
    });
  }, [revealed]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">See It For Yourself</h2>
      <p className="text-slate-300 leading-relaxed">
        Below is your "perfect" point forecast — a smooth, confident line. Looks great on a slide
        deck. But what actually happens when reality shows up?
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #475569',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={false}
              name="Point Forecast"
            />
            {revealed &&
              SCENARIOS.map((_, si) => (
                <Line
                  key={si}
                  type="monotone"
                  dataKey={`actual_${si}`}
                  stroke={COLORS[si]}
                  strokeWidth={1.5}
                  strokeDasharray={si % 2 === 0 ? undefined : '4 2'}
                  dot={false}
                  name={`Scenario ${si + 1}`}
                  opacity={0.7}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-center">
        <button
          onClick={() => setRevealed(!revealed)}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            revealed
              ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              : 'bg-amber-600 text-white hover:bg-amber-500'
          }`}
        >
          {revealed ? 'Hide Reality' : 'Reveal Reality'}
        </button>
      </div>

      {revealed && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4">
          <p className="text-sm text-red-300">
            <strong>Whoa.</strong> Every colored line is a plausible demand scenario. The gold
            "forecast" line sits in the middle — but actual demand scatters wildly around it.
            If you ordered exactly the forecast, you'd be wrong almost every day.
          </p>
        </div>
      )}
    </div>
  );
}

function Section3() {
  const [orderQty, setOrderQty] = useState(100);

  const results = useMemo(() => {
    let stockouts = 0;
    let overstockDays = 0;
    let totalWaste = 0;
    let totalShortage = 0;
    const totalDays = SCENARIOS.length * NUM_DAYS;

    SCENARIOS.forEach((scenario) => {
      scenario.forEach((actual) => {
        if (orderQty < actual) {
          stockouts++;
          totalShortage += actual - orderQty;
        } else {
          overstockDays++;
          totalWaste += orderQty - actual;
        }
      });
    });

    return {
      stockoutPct: ((stockouts / totalDays) * 100).toFixed(1),
      overstockPct: ((overstockDays / totalDays) * 100).toFixed(1),
      avgWaste: (totalWaste / totalDays).toFixed(1),
      avgShortage: (totalShortage / totalDays).toFixed(1),
    };
  }, [orderQty]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Try It: Pick Your Order Quantity</h2>
      <p className="text-slate-300 leading-relaxed">
        You saw 8 demand scenarios. Now decide — how many units would you order each day? Drag the
        slider and watch how stockouts vs. waste change across all scenarios.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Daily Order Quantity: <strong className="text-amber-400">{orderQty} units</strong>
          </label>
          <input
            type="range"
            min={50}
            max={170}
            value={orderQty}
            onChange={(e) => setOrderQty(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>50 (aggressive)</span>
            <span>100 (forecast)</span>
            <span>170 (conservative)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-950/30 border border-red-800/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-red-400">{results.stockoutPct}%</div>
            <div className="text-xs text-red-300 mt-1">Days with stockouts</div>
            <div className="text-xs text-slate-500 mt-0.5">Avg shortage: {results.avgShortage} units</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{results.overstockPct}%</div>
            <div className="text-xs text-amber-300 mt-1">Days overstocked</div>
            <div className="text-xs text-slate-500 mt-0.5">Avg waste: {results.avgWaste} units</div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <p className="text-sm text-slate-300">
          <strong className="text-slate-100">Key insight:</strong> There is no single order quantity
          that eliminates both stockouts <em>and</em> waste. The "right" answer depends on how much
          each type of mistake costs you — which is exactly what the next lessons cover.
        </p>
      </div>
    </div>
  );
}

export default function WhyPointForecastsFail() {
  return (
    <LessonLayout
      slug="why-point-forecasts-fail"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
