import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser, updateCachedUser } from '../api';
import { logout } from '../auth';
import { useAnalyticsConsent } from '../context/AnalyticsConsentContext';

export default function AccountSettings() {
  const user = getUser();
  const { consent, acceptAnalytics, declineAnalytics } = useAnalyticsConsent();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [profileMsg, setProfileMsg] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const isProfessor = user?.role === 'professor';

  async function handleNameSave(e) {
    e.preventDefault();
    setProfileMsg(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileMsg({ type: 'error', text: 'Name cannot be empty' });
      return;
    }
    setSavingName(true);
    try {
      const res = await api.updateProfile({ display_name: trimmed });
      updateCachedUser({ display_name: res.display_name });
      setProfileMsg({ type: 'success', text: 'Display name updated!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update name' });
    } finally {
      setSavingName(false);
    }
  }

  function MsgBanner({ msg }) {
    if (!msg) return null;
    const isErr = msg.type === 'error';
    return (
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          isErr
            ? 'border-red-500/40 bg-red-950/40 text-red-300'
            : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
        }`}
        role="alert"
      >
        {msg.text}
      </div>
    );
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Signed in as <span className="text-slate-200">{user?.display_name}</span>{' '}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              isProfessor ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'
            }`}
          >
            {user?.role}
          </span>
        </p>
      </div>

      {/* ---- Display Name ---- */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h2 className="text-lg font-medium text-slate-100">Display Name</h2>
        <form onSubmit={handleNameSave} className="mt-4 space-y-4">
          <MsgBanner msg={profileMsg} />
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300">
              Name
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingName ? 'Saving…' : 'Update Name'}
          </button>
        </form>
      </section>

      {/* ---- Change Password ---- */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h2 className="text-lg font-medium text-slate-100">Authentication</h2>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-400">
            Passwords, MFA, and account recovery are managed in ZITADEL rather than in Decision
            Arena.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg border border-slate-600 px-5 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* ---- Privacy & Analytics ---- */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h2 className="text-lg font-medium text-slate-100">Privacy &amp; Analytics</h2>
        <p className="mt-1 text-sm text-slate-400">
          We use Google Analytics to improve Decision Arena. Data is not used for advertising and
          we never sell your data.{' '}
          <Link to="/privacy" className="text-amber-400 underline hover:text-amber-300">
            Read our privacy policy
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-300">
            Analytics:{' '}
            <span
              className={`font-medium ${
                consent === 'granted'
                  ? 'text-emerald-400'
                  : consent === 'denied'
                    ? 'text-slate-400'
                    : 'text-amber-400'
              }`}
            >
              {consent === 'granted' ? 'Enabled' : consent === 'denied' ? 'Disabled' : 'Not set'}
            </span>
          </span>
          {consent !== 'granted' && (
            <button
              type="button"
              onClick={acceptAnalytics}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
            >
              Enable analytics
            </button>
          )}
          {consent !== 'denied' && (
            <button
              type="button"
              onClick={declineAnalytics}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            >
              Disable analytics
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
