import { lazy } from 'react';

const lessons = [
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
];

export default lessons;
