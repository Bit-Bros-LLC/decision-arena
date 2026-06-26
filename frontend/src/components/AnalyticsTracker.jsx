import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

export default function AnalyticsTracker({ consent }) {
  const location = useLocation();

  useEffect(() => {
    if (consent !== 'granted') return;
    trackPageView(`${location.pathname}${location.search}`);
  }, [consent, location.pathname, location.search]);

  return null;
}
