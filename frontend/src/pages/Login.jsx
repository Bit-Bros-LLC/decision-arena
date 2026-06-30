import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuth } from '../api';
import { trackEvent } from '../lib/analytics';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({
              email,
              password,
              display_name: displayName,
              role,
            });
      setAuth(data);
      trackEvent(mode === 'login' ? 'login_success' : 'registration_success', { role: data.role });
      navigate('/dashboard');
    } catch (err) {
      if (mode === 'login' && err.status === 401) {
        setError('Invalid Password/Login. Try again');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
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
            Sign in to join the arena
          </p>

          <div className="mt-8 flex rounded-lg bg-slate-900/80 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-300"
                role="alert"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                placeholder="you@school.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {mode === 'register' && (
              <>
                <div>
                  <label
                    htmlFor="display_name"
                    className="block text-sm font-medium text-slate-300"
                  >
                    Display name
                  </label>
                  <input
                    id="display_name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Dr. Smith"
                  />
                </div>
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-slate-300">
                    Role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="student">Student</option>
                    <option value="professor">Professor</option>
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>
        </div>
      </div>

      <p className="pb-6 text-center text-xs text-slate-500">
        Created by{' '}
        <a
          href="https://bitbrosdata.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-amber-400 transition"
        >
          Bit Bros LLC
        </a>
      </p>
    </div>
  );
}
