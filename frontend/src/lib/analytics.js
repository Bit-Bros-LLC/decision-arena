const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
const CONSENT_KEY = 'da_analytics_consent';

let initialized = false;

function isBrowser() {
  return typeof window !== 'undefined';
}

export function getAnalyticsConsent() {
  if (!isBrowser()) return 'unknown';
  const stored = window.localStorage.getItem(CONSENT_KEY);
  return stored === 'granted' || stored === 'denied' ? stored : 'unknown';
}

export function setAnalyticsConsent(consent) {
  if (!isBrowser()) return;
  window.localStorage.setItem(CONSENT_KEY, consent);
}

export function shouldEnableAnalytics() {
  return Boolean(import.meta.env.PROD && GA_MEASUREMENT_ID && getAnalyticsConsent() === 'granted');
}

function ensureGtag() {
  if (!isBrowser()) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
}

function injectGtagScript() {
  if (!isBrowser()) return;
  if (document.querySelector('script[data-ga-loader="true"]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.setAttribute('data-ga-loader', 'true');
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (initialized) return true;
  if (!shouldEnableAnalytics()) return false;

  ensureGtag();
  injectGtagScript();

  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  initialized = true;
  return true;
}

export function revokeAnalytics() {
  if (!isBrowser()) return;
  setAnalyticsConsent('denied');
  if (initialized && window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
}

export function trackPageView(path) {
  if (!initAnalytics()) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(name, params = {}) {
  if (!initAnalytics()) return;
  window.gtag('event', name, params);
}
