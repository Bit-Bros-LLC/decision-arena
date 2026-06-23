import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { setTourStatus } from './onboarding';
import { trackEvent } from './analytics';

/**
 * @typedef {Object} TourStep
 * @property {string} element - CSS selector or `[data-tour="…"]`
 * @property {string} title
 * @property {string} description
 * @property {'top'|'right'|'bottom'|'left'} [side]
 * @property {'start'|'center'|'end'} [align]
 */

/**
 * Run a spotlight tour. Marks tour completed or skipped in localStorage.
 * @param {{ userId: string, userRole: string, tourId: string, steps: TourStep[] }} options
 * @returns {import('driver.js').Driver | null}
 */
export function runOnboardingTour({ userId, userRole, tourId, steps }) {
  if (!userId || !tourId || !steps?.length) return null;

  trackEvent('onboarding_tour_started', { tour_id: tourId, user_role: userRole });

  let outcome = null;

  const driverObj = driver({
    showProgress: true,
    allowClose: true,
    overlayColor: '#0f172a',
    overlayOpacity: 0.75,
    stagePadding: 8,
    stageRadius: 8,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    progressText: '{{current}} of {{total}}',
    steps: steps.map((step) => ({
      element: step.element,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side ?? 'bottom',
        align: step.align ?? 'start',
      },
    })),
    onNextClick: (_element, _step, { driver: d }) => {
      if (d.hasNextStep()) {
        d.moveNext();
        return;
      }
      outcome = 'completed';
      setTourStatus(userId, tourId, 'completed');
      trackEvent('onboarding_tour_completed', { tour_id: tourId, user_role: userRole });
      d.destroy();
    },
    onCloseClick: (_element, _step, { driver: d }) => {
      if (!outcome) {
        outcome = 'skipped';
        setTourStatus(userId, tourId, 'skipped');
        trackEvent('onboarding_tour_skipped', { tour_id: tourId, user_role: userRole });
      }
      d.destroy();
    },
    onDestroyed: () => {
      if (!outcome) {
        setTourStatus(userId, tourId, 'skipped');
        trackEvent('onboarding_tour_skipped', { tour_id: tourId, user_role: userRole });
      }
    },
  });

  driverObj.drive();
  return driverObj;
}
