/**
 * Driver.js steps for the professor fiscal year creator onboarding tour.
 * Order matches the create-season form top → bottom (after story select),
 * with an auto-opened demand preview modal as step 1.
 *
 * @param {boolean} [hasStorySelected=false] — when true, step 0 includes Next (deep link / restart with story picked)
 */

/** Index of the demand-preview modal step (after stories). */
export const PROFESSOR_SEASON_DEMAND_PREVIEW_STEP = 1;

export function buildProfessorSeasonTourSteps(hasStorySelected = false) {
  return [
    {
      element: '[data-tour="season-stories"]',
      title: 'Start from a story',
      description: hasStorySelected
        ? 'Premade fiscal years bundle months, costs, demand timeline, and a full story briefing for you. Click Next to preview demand for this story.'
        : 'Premade fiscal years bundle months, costs, demand timeline, and a full story briefing for you. Click **Use this story** on a card — a demand preview opens and the tour continues automatically.',
      side: 'bottom',
      advanceOnStorySelect: !hasStorySelected,
      showButtons: hasStorySelected ? undefined : ['previous', 'close'],
    },
    {
      element: '[data-tour="season-demand-preview"]',
      title: 'Demand preview',
      description:
        'Historical demand (amber) plus the fiscal-year timeline students will face. Close this chart when you are ready to continue.',
      side: 'left',
      advanceOnModalClose: true,
      showButtons: ['previous', 'close'],
    },
    {
      element: '[data-tour="season-custom"]',
      title: 'Custom configuration',
      description:
        'Need full control? Expand this to build manually. Mechanical tuning lives under Advanced users.',
      side: 'bottom',
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
      element: '[data-tour="season-story-narrative"]',
      title: 'The story (you only)',
      description:
        'Professor briefing only — students never see this full arc, so the year stays a challenge. Use it to understand what will happen before you create.',
      side: 'bottom',
    },
    {
      element: '[data-tour="season-newsroom"]',
      title: 'Newsroom preview',
      description:
        'Full year briefing for you. Students only unlock news as each month arrives — typically current events and upcoming forecasts — then decide whether a policy review is worth it.',
      side: 'bottom',
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

/**
 * Selectors that must exist before the tour can start.
 * Excludes the demand-preview modal (only mounted while open).
 */
export function getProfessorSeasonTourStartupSelectors(hasStorySelected) {
  if (!hasStorySelected) {
    return ['[data-tour="season-stories"]'];
  }
  return [
    '[data-tour="season-stories"]',
    '[data-tour="season-custom"]',
    '[data-tour="season-name"]',
    '[data-tour="season-deadline"]',
    '[data-tour="season-story-narrative"]',
    '[data-tour="season-newsroom"]',
    '[data-tour="season-create"]',
  ];
}
