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
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import LessonLayout from '../../components/LessonLayout';

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function stdDev(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function Section1() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Supply Chain Telephone Game</h2>
      <p className="text-slate-300 leading-relaxed">
        Imagine a customer buys 5% more this week. The retailer notices and thinks "demand is
        going up!" so they order 15% more — a little buffer, just in case.
      </p>
      <p className="text-slate-300 leading-relaxed">
        The distributor sees the retailer's 15% increase and panics: "Whoa, big spike!" They order
        30% more from the manufacturer. The manufacturer sees a 30% jump and cranks production up
        50%.
      </p>
      <p className="text-slate-300 leading-relaxed">
        A <strong className="text-amber-400">5% real signal</strong> has become a{' '}
        <strong className="text-red-400">50% order swing</strong> at the factory. This is the{' '}
        <em className="text-amber-400">Bullwhip Effect</em> — and it happens in virtually every supply
        chain on the planet.
      </p>

      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Why Does It Happen?</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          <li><strong className="text-amber-400">Demand signal processing</strong> — Each tier forecasts from its own orders, not true customer demand.</li>
          <li><strong className="text-amber-400">Order batching</strong> — Weekly or monthly ordering creates lumpy signals.</li>
          <li><strong className="text-amber-400">Rationing & shortage gaming</strong> — When supply is tight, everyone inflates orders.</li>
          <li><strong className="text-amber-400">Price fluctuations</strong> — Promotions cause "forward buying" that distorts demand patterns.</li>
        </ul>
      </div>
    </div>
  );
}

function Section2() {
  const [customerVar, setCustomerVar] = useState(10);
  const [reactionMultiplier, setReactionMultiplier] = useState(1.5);

  const tiers = ['Customer', 'Retailer', 'Distributor', 'Manufacturer'];
  const TIER_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];
  const numWeeks = 26;

  const tierData = useMemo(() => {
    const rng = seededRng(42);
    const customer = Array.from({ length: numWeeks }, () =>
      100 + (rng() - 0.5) * 2 * customerVar
    );

    const amplify = (input, mult) => {
      const result = [input[0]];
      for (let i = 1; i < input.length; i++) {
        const change = input[i] - input[i - 1];
        result.push(result[i - 1] + change * mult);
      }
      return result;
    };

    const retailer = amplify(customer, reactionMultiplier);
    const distributor = amplify(retailer, reactionMultiplier);
    const manufacturer = amplify(distributor, reactionMultiplier);

    return [customer, retailer, distributor, manufacturer];
  }, [customerVar, reactionMultiplier]);

  const lineData = useMemo(() =>
    Array.from({ length: numWeeks }, (_, i) => ({
      week: `W${i + 1}`,
      Customer: Math.round(tierData[0][i]),
      Retailer: Math.round(tierData[1][i]),
      Distributor: Math.round(tierData[2][i]),
      Manufacturer: Math.round(tierData[3][i]),
    })),
  [tierData]);

  const varData = useMemo(() =>
    tiers.map((name, i) => ({
      name,
      variability: Math.round(stdDev(tierData[i])),
    })),
  [tierData]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Watch It Amplify</h2>
      <p className="text-slate-300 leading-relaxed">
        Adjust customer demand variability and how aggressively each tier overreacts.
        Watch the order signal explode as it travels upstream.
      </p>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Customer Variability: <strong className="text-green-400">&plusmn;{customerVar}%</strong>
            </label>
            <input type="range" min={2} max={25} value={customerVar}
              onChange={(e) => setCustomerVar(Number(e.target.value))} className="w-full accent-green-500" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Reaction Multiplier: <strong className="text-red-400">{reactionMultiplier}x</strong>
            </label>
            <input type="range" min={1} max={3} step={0.1} value={reactionMultiplier}
              onChange={(e) => setReactionMultiplier(Number(e.target.value))} className="w-full accent-red-500" />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={lineData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="week" stroke="#94a3b8" tick={{ fontSize: 10 }} interval={3} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }} />
            {tiers.map((tier, i) => (
              <Line key={tier} type="monotone" dataKey={tier} stroke={TIER_COLORS[i]}
                strokeWidth={i === 0 ? 2.5 : 1.5} dot={false}
                strokeDasharray={i > 0 ? '4 2' : undefined} />
            ))}
            <Legend />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-2">
          <p className="text-xs text-slate-500 mb-2 text-center">Order variability (std dev) by tier</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={varData} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="variability" radius={[0, 4, 4, 0]}>
                {varData.map((_, i) => (
                  <Cell key={i} fill={TIER_COLORS[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {reactionMultiplier >= 2 && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-4">
          <p className="text-sm text-red-300">
            <strong>The whip is cracking.</strong> At {reactionMultiplier}x reaction, the manufacturer
            sees {Math.round(varData[3].variability / Math.max(varData[0].variability, 1))}x the
            variability of actual customer demand. That's a planning nightmare.
          </p>
        </div>
      )}
    </div>
  );
}

function Section3() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Taming the Whip</h2>
      <p className="text-slate-300 leading-relaxed">
        The bullwhip isn't inevitable. There are proven strategies to dampen the amplification:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { title: 'Share POS Data', desc: 'Give every tier access to actual customer demand — not just the inflated orders from the tier below.', color: 'green' },
          { title: 'Reduce Batch Sizes', desc: 'Order more frequently in smaller quantities. Daily orders create smoother signals than monthly bulk orders.', color: 'blue' },
          { title: 'Stabilize Prices', desc: 'Eliminate promotions that cause forward-buying. Everyday low prices = everyday smooth demand.', color: 'amber' },
          { title: 'Shorten Lead Times', desc: 'Less time between order and delivery means less forecasting horizon, which means less overreaction.', color: 'purple' },
          { title: 'Vendor-Managed Inventory', desc: 'Let the supplier see your inventory and replenish directly. Removes an entire layer of distortion.', color: 'cyan' },
          { title: 'Dampened Ordering', desc: 'Deliberately under-react to demand changes. Order a fraction of the perceived change, not the full swing.', color: 'red' },
        ].map((item) => (
          <div key={item.title} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className={`text-sm font-medium text-${item.color}-400`}>{item.title}</div>
            <div className="text-xs text-slate-400 mt-1">{item.desc}</div>
          </div>
        ))}
      </div>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-amber-300 mb-1">Key Takeaway</h3>
        <p className="text-sm text-slate-300">
          The demand data you see in your inventory system may look wildly volatile — but much of
          that volatility is <em>artificial</em>, amplified by the bullwhip. Before you crank up
          safety stock to handle "high variability," ask: is this <em>real</em> demand uncertainty,
          or is it the supply chain overreacting to itself?
        </p>
      </div>
    </div>
  );
}

export default function BullwhipEffect() {
  return (
    <LessonLayout
      slug="bullwhip-effect"
      sections={[<Section1 key="s1" />, <Section2 key="s2" />, <Section3 key="s3" />]}
    />
  );
}
