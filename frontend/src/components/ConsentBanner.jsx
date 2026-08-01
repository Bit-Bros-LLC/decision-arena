import { Link } from 'react-router-dom';

export default function ConsentBanner({ onAccept, onDecline }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700 bg-slate-900/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="consent-banner-title"
      aria-describedby="consent-banner-desc"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p id="consent-banner-title" className="text-sm font-medium text-slate-200">
            Analytics &amp; privacy
          </p>
          <p id="consent-banner-desc" className="text-sm text-slate-300">
            We use Google Analytics to understand how Decision Arena is used and to improve the
            product. This data is <strong className="font-medium text-slate-200">not used for advertising</strong>
            , and we <strong className="font-medium text-slate-200">never sell your data</strong> to third
            parties. Analytics only runs if you click Accept — Decline means no tracking.{' '}
            <Link to="/privacy" className="text-amber-400 underline hover:text-amber-300">
              Privacy policy
            </Link>
            {' · '}
            <a
              href="mailto:info@bitbrosdata.com"
              className="text-amber-400 underline hover:text-amber-300"
            >
              Contact us
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
