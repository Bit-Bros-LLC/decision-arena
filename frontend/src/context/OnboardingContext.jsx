import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getUser } from '../api';
import { getFinishedTourIds, restartTour, setVideoDismissed } from '../lib/onboarding';
import { trackEvent } from '../lib/analytics';
import IntroVideoModal from '../components/IntroVideoModal';

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const user = getUser();
  const userId = user?.id ?? null;
  const userRole = user?.role ?? 'unknown';

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoSource, setVideoSource] = useState('help_menu');
  const [tourRevision, setTourRevision] = useState(0);

  const finishedTourIds = useMemo(() => {
    void tourRevision;
    return userId ? getFinishedTourIds(userId) : [];
  }, [userId, tourRevision]);

  const openIntroVideo = useCallback((source = 'help_menu') => {
    setVideoSource(source);
    setVideoOpen(true);
    trackEvent('onboarding_video_opened', { source });
  }, []);

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
    }),
    [userId, userRole, openIntroVideo, closeIntroVideo, handleRestartTour, finishedTourIds, tourRevision],
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
