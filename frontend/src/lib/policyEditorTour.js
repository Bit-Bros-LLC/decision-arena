/**
 * Driver.js steps for the policy-editor onboarding tour.
 * @param {{ dualSourceEnabled: boolean }} options
 */
export function buildPolicyEditorTourSteps({ dualSourceEnabled }) {
  const steps = [
    {
      element: '[data-tour="historical-chart"]',
      title: 'Historical demand',
      description:
        'You only see history. Scoring uses hidden actuals — the real demand your policy will face.',
      side: 'right',
    },
    {
      element: '[data-tour="policy-templates"]',
      title: 'Policy template',
      description: 'Pick Order Up To, Service Level, or Reorder Point.',
      side: 'bottom',
    },
    {
      element: '[data-tour="policy-params"]',
      title: 'Parameters',
      description: 'Tune your policy. The simulation runs it every day.',
      side: 'bottom',
    },
  ];

  if (dualSourceEnabled) {
    steps.push({
      element: '[data-tour="dual-sourcing"]',
      title: 'Dual sourcing',
      description:
        'Optional second lever: single source vs dual source. Dual sourcing costs more per unit but helps orders survive supplier failures.',
      side: 'bottom',
    });
  }

  steps.push(
    {
      element: '[data-tour="backtest"]',
      title: 'Backtest',
      description: 'Test against history as many times as you want.',
      side: 'top',
    },
    {
      element: '[data-tour="submit-policy"]',
      title: 'Submit',
      description:
        'Submit locks your policy until the deadline. Use Undo Submit if you change your mind before then.',
      side: 'top',
    },
  );

  return steps;
}
