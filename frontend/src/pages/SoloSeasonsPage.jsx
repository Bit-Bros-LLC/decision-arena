import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

function SeasonListItem({ season, listTitle }) {
  const navigate = useNavigate();
  const scored = season.rounds.filter((r) => r.status === 'scored').length;
  const active = season.rounds.find((r) => r.status === 'active');
  return (
    <li className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-slate-100">{listTitle}</p>
          <p className="mt-1 text-sm text-slate-400">
            {season.total_rounds} months · {scored}/{season.total_rounds} scored
            {season.room_name && (
              <>
                {' '}
                · <span className="text-slate-400">{season.room_name}</span>
              </>
            )}
          </p>
          {active && (
            <p className="mt-0.5 text-xs text-amber-400">Month {active.round_number} active</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(season.open_path)}
          className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-sm text-amber-500 hover:bg-amber-500/10"
        >
          Open practice run
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
        if (!cancelled) setError(err.message || 'Failed to load practice runs');
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
        if (s.room_id) cls.push(s);
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
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Practice runs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Private practice runs are only for you. Classroom practice runs are started inside a classroom your
          professor manages.
        </p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
        <h2 className="text-lg font-medium text-slate-100">Start a new practice run</h2>
        <div className="mt-4 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate('/season-sprint/new')}
            className="w-fit rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
          >
            Create private practice run
          </button>
        </div>

        {rooms.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-medium text-slate-300">In your classrooms</h3>
            <p className="text-sm text-slate-400">
              You can also start a practice run inside a class. Your professor can see these runs and compare
              results.
            </p>
            <ul className="flex flex-col gap-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <Link
                    to={`/room/${room.id}/season-sprint/new`}
                    className="inline-flex rounded-lg border border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10"
                  >
                    Create {room.name} practice run
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {rooms.length === 0 && !loading && (
          <p className="mt-4 text-sm text-slate-500">
            Join a class from the dashboard to start a classroom practice run your professor can see.
          </p>
        )}
      </section>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && privateSeasons.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-slate-100">Private practice runs</h2>
          <ul className="space-y-3">
            {privateSeasons.map((season) => (
              <SeasonListItem key={season.id} season={season} listTitle={season.name} />
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && classSeasons.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-slate-100">Classroom practice runs</h2>
          <p className="mb-3 text-sm text-slate-400">
            Case studies you started in a classroom. Your professor can see these in the class.
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
          <p className="text-slate-300">You have not started any practice runs yet. Use the buttons above.</p>
        </div>
      )}
    </div>
  );
}
