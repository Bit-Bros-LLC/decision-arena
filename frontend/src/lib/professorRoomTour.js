/**
 * Driver.js steps for the professor classroom onboarding tour.
 * @param {{ hasInviteCode?: boolean, hasDraftRound?: boolean, hasActiveRound?: boolean }} options
 */
export function buildProfessorRoomTourSteps({
  hasInviteCode = true,
  hasDraftRound = false,
  hasActiveRound = false,
} = {}) {
  const inviteElement = hasInviteCode ? '[data-tour="room-invite"]' : '[data-tour="room-header"]';
  const activateElement = hasDraftRound
    ? '[data-tour="room-activate-btn"]'
    : '[data-tour="room-activate"]';
  const scoreElement = hasActiveRound
    ? '[data-tour="room-score-btn"]'
    : '[data-tour="room-score"]';

  return [
    {
      element: inviteElement,
      title: 'Invite code',
      description:
        'Share the invite code with students so they can join your class. Classroom ID is optional.',
      side: 'bottom',
    },
    {
      element: '[data-tour="room-create"]',
      title: 'Create fiscal year or month',
      description:
        'Create fiscal year opens the story picker — premade narratives are the fastest path. Standalone months are hand-built one at a time.',
      side: 'bottom',
    },
    {
      element: activateElement,
      title: 'Activate',
      description: hasDraftRound
        ? 'Students cannot submit policies until you activate this month.'
        : 'Students cannot play until a month or fiscal year is active. For fiscal years, activate from the fiscal year dashboard after you create one. For standalone months, use Activate here.',
      side: 'bottom',
    },
    {
      element: scoreElement,
      title: 'Score and advance',
      description: hasActiveRound
        ? 'After the deadline, score this month. For multi-month fiscal years, score and advance from the fiscal year dashboard.'
        : 'After the deadline, score the month, then advance the fiscal year to unlock the next month. Standalone months use Score Month here.',
      side: 'top',
    },
  ];
}
