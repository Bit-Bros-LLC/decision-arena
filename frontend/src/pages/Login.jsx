import { useState } from 'react';
import { beginLogin } from '../auth';

export default function Login() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setError('');
    setSubmitting(true);
    try {
      await beginLogin();
    } catch (err) {
      setError(err.message || 'Unable to start ZITADEL sign-in');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-amber-400">
            Decision Arena
          </h1>
          <p className="mt-1 text-center text-sm text-slate-400">
            Sign in with your approved ZITADEL account
          </p>

          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
            Access is managed centrally. If you do not already have an approved account, contact
            an administrator.
          </div>

          {error && (
            <div
              className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Redirecting to ZITADEL…' : 'Continue to Sign In'}
          </button>
        </div>
      </div>

      <p className="pb-6 text-center text-xs text-slate-500">
        Created by{' '}
        <a
          href="https://bitbrosdata.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 transition hover:text-amber-400"
        >
          Bit Bros LLC
        </a>
      </p>
    </div>
  );
}
