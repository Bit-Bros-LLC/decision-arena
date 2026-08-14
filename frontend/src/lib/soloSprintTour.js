/**
 * Driver.js steps for the solo practice run builder onboarding tour.
 */
export function buildSoloSprintTourSteps() {
  return [
    {
      element: '[data-tour="sprint-name"]',
      title: 'Practice run name',
      description: 'Give your run a name you will recognize on your dashboard.',
      side: 'bottom',
    },
    {
      element: '[data-tour="sprint-basics"]',
      title: 'Months & contract updates',
      description:
        'Choose how many months to play and how many times you can change your supply contract.',
      side: 'bottom',
    },
    {
      element: '[data-tour="sprint-dual-source"]',
      title: 'Dual sourcing',
      description:
        'Optional second lever during play. Defaults apply — adjust premium and rescue % under Advanced users.',
      side: 'bottom',
    },
    {
      element: '[data-tour="sprint-scenario"]',
      title: 'Demand mode',
      description:
        'Pick single, random mix, or custom mix. For custom mix, assign each month right below the dropdown.',
      side: 'bottom',
    },
    {
      element: '[data-tour="sprint-advanced"]',
      title: 'Advanced users',
      description:
        'Holding costs, lead-in history, starting inventory, and preset tuning live here. Defaults work for most practice runs.',
      side: 'top',
    },
    {
      element: '[data-tour="sprint-create"]',
      title: 'Start practice run',
      description: 'Create the run — then open month one and tune your policy.',
      side: 'top',
    },
  ];
}
