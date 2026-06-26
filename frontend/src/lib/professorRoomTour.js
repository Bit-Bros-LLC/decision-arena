/**
 * Driver.js steps for the professor room onboarding tour.
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
        'Share the Room ID and invite code with students so they can join your class.',
      side: 'bottom',
    },
    {
      element: '[data-tour="room-create"]',
      title: 'Create season or round',
      description:
        'Seasons auto-generate rounds on a schedule. Classic rounds are hand-built one at a time.',
      side: 'bottom',
    },
    {
      element: activateElement,
      title: 'Activate',
      description: hasDraftRound
        ? 'Students cannot submit policies until you activate this round.'
        : 'Students cannot play until a round or season is active. For seasons, activate from the season dashboard after you create one. For classic rounds, use Activate here.',
      side: 'bottom',
    },
    {
      element: scoreElement,
      title: 'Score and advance',
      description: hasActiveRound
        ? 'After the deadline, score this round. For multi-round seasons, score and advance from the season dashboard.'
        : 'After the deadline, score the round, then advance the season to unlock the next round. Classic ad-hoc rounds use Score Round here.',
      side: 'top',
    },
  ];
}
