import { createContext, useContext } from 'react';

const AnalyticsConsentContext = createContext(null);

export function AnalyticsConsentProvider({ value, children }) {
  return (
    <AnalyticsConsentContext.Provider value={value}>{children}</AnalyticsConsentContext.Provider>
  );
}

export function useAnalyticsConsent() {
  const ctx = useContext(AnalyticsConsentContext);
  if (!ctx) {
    throw new Error('useAnalyticsConsent must be used within AnalyticsConsentProvider');
  }
  return ctx;
}
