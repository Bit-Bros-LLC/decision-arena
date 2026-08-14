/**
 * Driver.js steps for the professor classroom onboarding tour.
 * Targets Activity tab elements by default (set activeTab to 'activity' before starting).
 * @param {{ hasInviteCode?: boolean }} options
 */
export function buildProfessorRoomTourSteps({ hasInviteCode = true } = {}) {
  return [
    {
      element: '[data-tour="room-create"]',
      title: 'Create fiscal year',
      description:
        'Create fiscal year opens the story picker — premade narratives are the fastest path for a multi-month class competition. You can also start a short practice run from here.',
      side: 'bottom',
    },
    {
      element: '[data-tour="room-activate"]',
      title: 'Fiscal years',
      description:
        'Open a fiscal year to activate months, collect student policies, then score and advance. Students cannot play until a month is active inside that fiscal year dashboard.',
      side: 'bottom',
    },
    {
      element: '[data-tour="room-practice"]',
      title: 'Practice runs',
      description:
        'Classroom practice runs live here. Each student (or you) can start their own run; you can see every run in the class.',
      side: 'top',
    },
    {
      element: hasInviteCode
        ? '[data-tour="room-admin-tab"]'
        : '[data-tour="room-tabs"]',
      title: 'Class Admin',
      description: hasInviteCode
        ? 'Use the switch at the top right for Class Admin — the invite code students use to join lives there.'
        : 'Use the switch at the top right for Class Admin.',
      side: 'left',
    },
  ];
}
