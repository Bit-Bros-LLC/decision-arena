import { lazy } from 'react';

const lessons = [
  {
    slug: 'enter-the-arena',
    title: 'Enter the Arena',
    description:
      'How the Decision Factory metaphor maps to daily play — policies, uncertainty, and hidden actuals.',
    order: 0,
    startHere: true,
    icon: '🏭',
    estimatedMinutes: 3,
    component: lazy(() => import('../pages/lessons/EnterTheArena')),
  },
  {
    slug: 'why-point-forecasts-fail',
    title: 'Why Point Forecasts Fail',
    description:
      'Discover why single-number demand predictions lead to costly surprises — and why uncertainty is the norm, not the exception.',
    order: 1,
    icon: '🎯',
    estimatedMinutes: 6,
    component: lazy(() => import('../pages/lessons/WhyPointForecastsFail')),
  },
  {
    slug: 'probabilistic-forecasting',
    title: 'Probabilistic Forecasting',
    description:
      'Move beyond point estimates. Learn how probability distributions capture the full range of what demand could look like.',
    order: 2,
    icon: '📊',
    estimatedMinutes: 7,
    component: lazy(() => import('../pages/lessons/ProbabilisticForecasting')),
  },
  {
    slug: 'economics-of-decisions',
    title: 'Economics of Decisions',
    description:
      'Not all mistakes are equal. Explore why the cost of ordering too much vs. too little should drive your decisions.',
    order: 3,
    icon: '⚖️',
    estimatedMinutes: 8,
    component: lazy(() => import('../pages/lessons/EconomicsOfDecisions')),
  },
  {
    slug: 'safety-stock',
    title: 'Safety Stock',
    description:
      'Understand the buffer between you and a stockout — how service-level targets translate into real inventory on the shelf.',
    order: 4,
    icon: '🛡️',
    estimatedMinutes: 6,
    component: lazy(() => import('../pages/lessons/SafetyStock')),
  },
  {
    slug: 'demand-patterns',
    title: 'Demand Patterns',
    description:
      'Not all demand looks the same. Learn to spot trend, seasonality, and intermittence — and why the residual noise is the true uncertainty.',
    order: 5,
    icon: '🔍',
    estimatedMinutes: 7,
    component: lazy(() => import('../pages/lessons/DemandPatterns')),
  },
  {
    slug: 'lead-time-variability',
    title: 'Lead Time Variability',
    description:
      'Demand uncertainty is only half the story. When your supplier is also unpredictable, the uncertainty multiplies.',
    order: 6,
    icon: '⏳',
    estimatedMinutes: 7,
    component: lazy(() => import('../pages/lessons/LeadTimeVariability')),
  },
  {
    slug: 'bullwhip-effect',
    title: 'The Bullwhip Effect',
    description:
      'A 5% demand bump at retail becomes a 40% order spike at the factory. Watch small signals amplify into chaos.',
    order: 7,
    icon: '🌊',
    estimatedMinutes: 7,
    component: lazy(() => import('../pages/lessons/BullwhipEffect')),
  },
  {
    slug: 'newsvendor-problem',
    title: 'The Newsvendor Problem',
    description:
      'The classic one-shot ordering problem — done right with a full distribution, not a point forecast.',
    order: 8,
    icon: '📰',
    estimatedMinutes: 8,
    component: lazy(() => import('../pages/lessons/NewsvendorProblem')),
  },
  {
    slug: 'why-simulate',
    title: 'Why Simulate?',
    description:
      'When formulas hit their limits, let the computer play it out a thousand times. Monte Carlo thinking for the real world.',
    order: 9,
    icon: '🎲',
    estimatedMinutes: 7,
    component: lazy(() => import('../pages/lessons/WhySimulate')),
  },
  {
    slug: 'forecast-evaluation',
    title: 'Forecast Evaluation',
    description:
      'Metrics are tools, not goals. Learn why chasing MAPE can destroy your P&L — and what to measure instead.',
    order: 10,
    icon: '📏',
    estimatedMinutes: 8,
    component: lazy(() => import('../pages/lessons/ForecastEvaluation')),
  },
];

export default lessons;
