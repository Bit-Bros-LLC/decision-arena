/**
 * Driver.js steps for the professor fiscal year creator onboarding tour.
 * @param {boolean} [hasStorySelected=false] — when true, step 1 includes Next (deep link / restart with story picked)
 */
export function buildProfessorSeasonTourSteps(hasStorySelected = false) {
  return [
    {
      element: '[data-tour="season-stories"]',
      title: 'Start from a story',
      description: hasStorySelected
        ? 'Premade fiscal years bundle months, costs, demand timeline, and student news. Click Next to review what this story includes.'
        : 'Premade fiscal years bundle months, costs, demand timeline, and student news. Click **Use this story** on a card — the tour continues automatically.',
      side: 'bottom',
      advanceOnStorySelect: !hasStorySelected,
      showButtons: hasStorySelected ? undefined : ['previous', 'close'],
    },
    {
      element: '[data-tour="season-story-narrative"]',
      title: 'The story',
      description:
        'Students read this narrative for context. It sets the scene for the fiscal year they are managing.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-newsroom"]',
      title: 'Newsroom preview',
      description:
        'Forecasts and events students see month by month. They must decide when to spend a policy review to react to the news.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-story-demand"]',
      title: 'Preview demand chart',
      description:
        'Opens a chart of historical demand plus the fiscal-year timeline students will face. Use it to sanity-check difficulty before you create.',
      side: 'top',
    },
    {
      element: '[data-tour="season-name"]',
      title: 'Fiscal year name',
      description:
        'Auto-fills when you pick a story. Edit it so your class recognizes this fiscal year on the dashboard.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-deadline"]',
      title: 'First month deadline',
      description: 'When month one closes. Later months schedule automatically.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-custom"]',
      title: 'Custom configuration',
      description:
        'Need full control? Expand this to build manually. Mechanical tuning lives under Advanced users.',
      side: 'top',
    },
    {
      element: '[data-tour="season-create"]',
      title: 'Create fiscal year',
      description:
        "Create the fiscal year — you'll land on the fiscal year dashboard to activate and manage months.",
      side: 'top',
    },
  ];
}

/** Selectors that must exist before the tour can start. */
export function getProfessorSeasonTourStartupSelectors(hasStorySelected) {
  const steps = buildProfessorSeasonTourSteps(hasStorySelected);
  if (hasStorySelected) return steps.map((s) => s.element);
  return [steps[0].element];
}
