import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser, logout } from '../api';

export default function NavBar() {
  const user = getUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!user) return null;

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-lg font-bold text-amber-400 hover:text-amber-300 transition-colors"
        >
          Decision Arena
        </button>
        <button
          onClick={() => navigate('/learn')}
          className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${
            location.pathname.startsWith('/learn')
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          Learn
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold leading-none">
            BETA
          </span>
        </button>
        <button
          onClick={() => navigate('/solo-seasons')}
          className={`text-sm font-medium transition-colors ${
            location.pathname.startsWith('/solo-seasons')
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          Solo-Seasons
        </button>
        {location.pathname !== '/dashboard' && !location.pathname.startsWith('/learn') && (
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            &larr; Back
          </button>
        )}
      </div>

      <div className="flex items-center gap-5">
        <span className="text-slate-400 text-sm hidden sm:block">
          {dateStr} &middot; {timeStr}
        </span>

        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-700"
          title="Account settings"
        >
          <span className="text-slate-200 text-sm font-medium">{user.display_name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            user.role === 'professor'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-sky-500/20 text-sky-400'
          }`}>
            {user.role}
          </span>
        </button>

        <button
          onClick={logout}
          className="text-sm text-slate-400 hover:text-red-400 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
