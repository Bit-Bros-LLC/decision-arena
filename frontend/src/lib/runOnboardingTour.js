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
 * @property {('next'|'previous'|'close')[]} [showButtons]
 * @property {boolean} [advanceOnStorySelect] - metadata for caller; not used by the runner
 * @property {boolean} [advanceOnModalClose] - metadata for caller; not used by the runner
 * @property {() => void|Promise<void>} [prepareNext] - optional async work before advancing (e.g. open a modal)
 * @property {() => void} [preparePrevious] - optional work before going back (e.g. close a modal)
 */

/**
 * Run a spotlight tour. Marks tour completed or skipped in localStorage.
 * @param {{
 *   userId: string,
 *   userRole: string,
 *   tourId: string,
 *   steps: TourStep[],
 *   onDestroyed?: () => void,
 * }} options
 * @returns {import('driver.js').Driver | null}
 */
export function runOnboardingTour({ userId, userRole, tourId, steps, onDestroyed: onDestroyedCb }) {
  if (!userId || !tourId || !steps?.length) return null;

  trackEvent('onboarding_tour_started', { tour_id: tourId, user_role: userRole });

  let outcome = null;

  function markSkipped(driverInstance) {
    if (!outcome) {
      outcome = 'skipped';
      setTourStatus(userId, tourId, 'skipped');
      trackEvent('onboarding_tour_skipped', { tour_id: tourId, user_role: userRole });
    }
    driverInstance.destroy();
  }

  function markCompleted(driverInstance) {
    outcome = 'completed';
    setTourStatus(userId, tourId, 'completed');
    trackEvent('onboarding_tour_completed', { tour_id: tourId, user_role: userRole });
    driverInstance.destroy();
  }

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
        ...(step.showButtons ? { showButtons: step.showButtons } : {}),
      },
    })),
    onPopoverRender: (popover, { driver: d }) => {
      const skipButton = document.createElement('button');
      skipButton.type = 'button';
      skipButton.className = 'driver-popover-prev-btn driver-popover-skip-btn';
      skipButton.textContent = 'Skip';
      skipButton.addEventListener('click', () => markSkipped(d));
      popover.footerButtons.insertBefore(skipButton, popover.footerButtons.firstChild);
    },
    onNextClick: async (_element, _step, { driver: d }) => {
      const index = d.getActiveIndex?.() ?? 0;
      const prepareNext = steps[index]?.prepareNext;
      if (prepareNext) {
        try {
          await prepareNext();
        } catch {
          // Continue even if prepare fails — target may still appear shortly.
        }
      }
      if (d.hasNextStep()) {
        d.moveNext();
        return;
      }
      markCompleted(d);
    },
    onPrevClick: (_element, _step, { driver: d }) => {
      const index = d.getActiveIndex?.() ?? 0;
      steps[index]?.preparePrevious?.();
      if (d.hasPreviousStep()) {
        d.movePrevious();
      }
    },
    onCloseClick: (_element, _step, { driver: d }) => {
      markSkipped(d);
    },
    onDestroyed: () => {
      if (!outcome) {
        outcome = 'skipped';
        setTourStatus(userId, tourId, 'skipped');
        trackEvent('onboarding_tour_skipped', { tour_id: tourId, user_role: userRole });
      }
      onDestroyedCb?.();
    },
  });

  driverObj.drive();
  return driverObj;
}
