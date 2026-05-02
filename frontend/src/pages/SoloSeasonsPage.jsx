import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

function SeasonListItem({ season, listTitle }) {
  const navigate = useNavigate();
  const scored = season.rounds.filter((r) => r.status === 'scored').length;
  const active = season.rounds.find((r) => r.status === 'active');
  return (
    <li className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-100">{listTitle}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {season.total_rounds} rounds · {scored}/{season.total_rounds} scored
            {season.room_name && (
              <>
                {' '}
                · <span className="text-slate-400">{season.room_name}</span>
              </>
            )}
          </p>
          {active && (
            <p className="mt-0.5 text-xs text-amber-400">Round {active.round_number} active</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(season.open_path)}
          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
        >
          Open season
        </button>
      </div>
    </li>
  );
}

export default function SoloSeasonsPage() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [list, roomList] = await Promise.all([
          api.listMySoloSeasons(),
          api.getRooms().catch(() => []),
        ]);
        if (!cancelled) {
          setSeasons(Array.isArray(list) ? list : []);
          setRooms(Array.isArray(roomList) ? roomList : []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load solo seasons');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { privateSeasons, classSeasons } = useMemo(() => {
    const priv = [];
    const cls = [];
    for (const s of seasons) {
      if (s.season_scope === 'sandbox') {
        priv.push(s);
      } else if (s.source_template_id) {
        cls.push(s);
      } else {
        // Defensive: other solo-linked rows go with class if they have a room
        if (s.room_id) cls.push(s);
        else priv.push(s);
      }
    }
    return { privateSeasons: priv, classSeasons: cls };
  }, [seasons]);

  const classSeasonTitle = (s) => {
    if (s.source_template_id && s.template_name && s.sprint_attempt != null) {
      return `${s.template_name} · Attempt ${s.sprint_attempt}`;
    }
    return s.name;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Solo-Seasons</h1>
        <p className="mt-1 text-sm text-slate-400">
          Private practice runs are only for you. Class solo seasons are started inside a room your
          professor can see.
        </p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">Start a new run</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => navigate('/season-sprint/new')}
            className="w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
          >
            Create private solo season
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Only you — not shown to your professor or classmates.</p>

        {rooms.length > 0 && (
          <div className="mt-6 border-t border-slate-600/80 pt-6">
            <h3 className="text-sm font-medium text-slate-300">In your classrooms</h3>
            <p className="mt-1 text-xs text-slate-500">
              You can also start a season inside a class. Your professor can see these runs and compare
              results with your section.
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    to={`/room/${room.id}/season-sprint/new`}
                    className="inline-flex rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10"
                  >
                    Create {room.name} solo season
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rooms.length === 0 && !loading && (
          <p className="mt-4 text-xs text-slate-500">
            Join a class from the dashboard to start a class solo season your professor can see.
          </p>
        )}
      </section>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && privateSeasons.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-slate-100">Private solo seasons</h2>
          <p className="mb-3 text-sm text-slate-400">Practice runs that are not shared with your classes.</p>
          <ul className="space-y-3">
            {privateSeasons.map((season) => (
              <SeasonListItem key={season.id} season={season} listTitle={season.name} />
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && classSeasons.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-slate-100">Class solo seasons</h2>
          <p className="mb-3 text-sm text-slate-400">
            Season sprints you started in a class room. Your professor can see these in the class.
          </p>
          <ul className="space-y-3">
            {classSeasons.map((season) => (
              <SeasonListItem
                key={season.id}
                season={season}
                listTitle={classSeasonTitle(season)}
              />
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && seasons.length === 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <p className="text-slate-300">You have not started any solo seasons yet. Use the buttons above.</p>
        </div>
      )}
    </div>
  );
}
