/**
 * Driver.js steps for the professor season creator onboarding tour.
 */
export function buildProfessorSeasonTourSteps() {
  return [
    {
      element: '[data-tour="season-rules"]',
      title: 'Season rules',
      description:
        'Set rounds, contract updates, lead-in history, and how long each round runs.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-scenario"]',
      title: 'Demand mode & scenarios',
      description:
        'Pick single, random mix, or custom mix — then choose patterns. Use Full preview on any card to see sample demand before you commit.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-deadline"]',
      title: 'First round deadline',
      description: 'When round 1 closes. Later rounds schedule automatically.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-create"]',
      title: 'Create season',
      description:
        "Create the season — you'll land on the season dashboard to activate and manage rounds.",
      side: 'top',
    },
  ];
}
