import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeLogin } from '../auth';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function finishLogin() {
      try {
        await completeLogin(window.location.search);
        if (active) navigate('/dashboard', { replace: true });
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Unable to complete sign-in');
      }
    }

    finishLogin();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-amber-400">
          Decision Arena
        </h1>
        <p className="mt-4 text-center text-sm text-slate-300">
          {error ? 'We could not finish your sign-in.' : 'Completing your ZITADEL sign-in…'}
        </p>
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
