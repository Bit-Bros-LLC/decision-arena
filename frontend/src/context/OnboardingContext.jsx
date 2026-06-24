import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getUser } from '../api';
import {
  getFinishedTourIds,
  isChecklistCollapsed as readChecklistCollapsed,
  isChecklistDismissed as readChecklistDismissed,
  isChecklistItemDone as readChecklistItemDone,
  restartTour,
  setChecklistCollapsed,
  setChecklistDismissed,
  setChecklistItem,
  setVideoDismissed,
} from '../lib/onboarding';
import { trackEvent } from '../lib/analytics';
import IntroVideoModal from '../components/IntroVideoModal';

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const user = getUser();
  const userId = user?.user_id ?? null;
  const userRole = user?.role ?? 'unknown';

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSource, setVideoSource] = useState('help_menu');
  const [tourRevision, setTourRevision] = useState(0);
  const [checklistRevision, setChecklistRevision] = useState(0);

  const finishedTourIds = useMemo(() => {
    void tourRevision;
    return userId ? getFinishedTourIds(userId) : [];
  }, [userId, tourRevision]);

  const markChecklistItem = useCallback(
    (itemId) => {
      if (!userId) return;
      if (readChecklistItemDone(userId, itemId)) return;
      setChecklistItem(userId, itemId, true);
      trackEvent('onboarding_checklist_item_done', { item_id: itemId, user_role: userRole });
      setChecklistRevision((n) => n + 1);
    },
    [userId, userRole],
  );

  const isChecklistItemDone = useCallback(
    (itemId) => {
      void checklistRevision;
      return userId ? readChecklistItemDone(userId, itemId) : false;
    },
    [userId, checklistRevision],
  );

  const isChecklistDismissed = useCallback(() => {
    void checklistRevision;
    return userId ? readChecklistDismissed(userId) : false;
  }, [userId, checklistRevision]);

  const dismissChecklist = useCallback(() => {
    if (!userId) return;
    setChecklistDismissed(userId, true);
    setChecklistRevision((n) => n + 1);
  }, [userId]);

  const isChecklistCollapsed = useCallback(() => {
    void checklistRevision;
    return userId ? readChecklistCollapsed(userId) : false;
  }, [userId, checklistRevision]);

  const collapseChecklist = useCallback(() => {
    if (!userId) return;
    setChecklistCollapsed(userId, true);
    setChecklistRevision((n) => n + 1);
  }, [userId]);

  const expandChecklist = useCallback(() => {
    if (!userId) return;
    setChecklistCollapsed(userId, false);
    setChecklistRevision((n) => n + 1);
  }, [userId]);

  const openIntroVideo = useCallback(
    (source = 'help_menu') => {
      setVideoSource(source);
      setVideoOpen(true);
      trackEvent('onboarding_video_opened', { source });
      if (userId && !readChecklistItemDone(userId, 'watch_intro')) {
        setChecklistItem(userId, 'watch_intro', true);
        trackEvent('onboarding_checklist_item_done', {
          item_id: 'watch_intro',
          user_role: userRole,
        });
        setChecklistRevision((n) => n + 1);
      }
    },
    [userId, userRole],
  );

  const closeIntroVideo = useCallback(
    (options = {}) => {
      const { dontShowAgain = false } = options;
      if (dontShowAgain && userId) {
        setVideoDismissed(userId, true);
      }
      trackEvent('onboarding_video_dismissed', { dont_show_again: dontShowAgain });
      setVideoOpen(false);
    },
    [userId],
  );

  const handleRestartTour = useCallback(
    (tourId) => {
      if (!userId) return;
      restartTour(userId, tourId);
      setTourRevision((n) => n + 1);
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      userId,
      userRole,
      openIntroVideo,
      closeIntroVideo,
      handleRestartTour,
      finishedTourIds,
      tourRevision,
      markChecklistItem,
      isChecklistItemDone,
      isChecklistDismissed,
      dismissChecklist,
      isChecklistCollapsed,
      collapseChecklist,
      expandChecklist,
      checklistRevision,
    }),
    [
      userId,
      userRole,
      openIntroVideo,
      closeIntroVideo,
      handleRestartTour,
      finishedTourIds,
      tourRevision,
      markChecklistItem,
      isChecklistItemDone,
      isChecklistDismissed,
      dismissChecklist,
      isChecklistCollapsed,
      collapseChecklist,
      expandChecklist,
      checklistRevision,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <IntroVideoModal open={videoOpen} onClose={closeIntroVideo} />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
}
