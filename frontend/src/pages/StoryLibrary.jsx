import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import StoryNews from '../components/StoryNews';
import Narrative from '../components/Narrative';
import PresetPreviewModal from '../components/PresetPreviewModal';
import { BADGE_COLORS, transformPreviewResponse } from '../lib/presetPreview';

export default function StoryLibrary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromRoomId = searchParams.get('room');

  const [stories, setStories] = useState([]);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);

  const [modalStory, setModalStory] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalChart, setModalChart] = useState({ chartData: [], boundary: null, roundBoundaries: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listStoryPackages();
        if (!cancelled) {
          setStories(Array.isArray(list) ? list : []);
          if (Array.isArray(list) && list.length > 0) setOpenId(list[0].id);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load stories');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPreview = async (story) => {
    setModalStory(story);
    setModalError(null);
    setModalLoading(true);
    try {
      const res = await api.previewStoryPackage(story.id);
      const transformed = transformPreviewResponse(res);
      setModalChart({
        chartData: transformed.chartData,
        boundary: transformed.boundary,
        roundBoundaries: transformed.roundBoundaries,
      });
    } catch (err) {
      setModalError(err.message || 'Could not generate preview');
    } finally {
      setModalLoading(false);
    }
  };

  const useStory = (story) => {
    if (fromRoomId) {
      navigate(`/room/${fromRoomId}/create-season?story=${story.id}`);
    } else {
      navigate('/dashboard');
    }
  };

  const open = stories.find((s) => s.id === openId) || null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Story library</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ready-made narrative seasons. Each story pre-builds every setting plus a storyline and
          timed student news. Pick one and you're ready to launch.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/dashboard" className="text-amber-500 hover:text-amber-400">
            ← Dashboard
          </Link>
          {fromRoomId && (
            <Link to={`/room/${fromRoomId}/create-season`} className="text-amber-500 hover:text-amber-400">
              ← Back to season creator
            </Link>
          )}
          <Link to="/scenarios" className="text-amber-500 hover:text-amber-400">
            Demand scenario library
          </Link>
        </div>
        {!fromRoomId && (
          <p className="mt-2 text-xs text-slate-500">
            Open a class first to launch a story season. Browsing here is read-only.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          {stories.map((story) => {
            const selected = story.id === openId;
            const badgeClass = BADGE_COLORS[story.difficulty] || 'text-slate-300 border-slate-500/30 bg-slate-500/10';
            return (
              <button
                type="button"
                key={story.id}
                onClick={() => setOpenId(story.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selected
                    ? 'border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/40'
                    : 'border-slate-700 bg-slate-800 hover:bg-slate-700/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">{story.title}</h3>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeClass}`}>
                    {story.difficulty}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{story.summary}</p>
              </button>
            );
          })}
        </div>

        {open && (
          <div className="space-y-5 rounded-xl border border-slate-700 bg-slate-800 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">{open.title}</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openPreview(open)}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
                >
                  Preview demand
                </button>
                <button
                  type="button"
                  onClick={() => useStory(open)}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                >
                  Use this story
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Rounds', open.total_rounds],
                ['Contract changes', open.contract_updates_allowed],
                ['Round length', `${open.round_duration_days}d`],
                ['Start inventory', open.starting_inventory],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="text-sm font-medium text-amber-500">The story</h3>
              <Narrative text={open.narrative} className="mt-2" />
            </div>

            <div>
              <h3 className="text-sm font-medium text-amber-500">Newsroom</h3>
              <p className="mt-1 text-xs text-slate-500">
                Students see each item as its round arrives. Forecasts preview upcoming months.
              </p>
              <div className="mt-2">
                <StoryNews news={open.news} activeRoundNumber={null} />
              </div>
            </div>
          </div>
        )}
      </div>

      <PresetPreviewModal
        open={Boolean(modalStory)}
        onClose={() => setModalStory(null)}
        title={modalStory ? `${modalStory.title} — demand timeline` : ''}
        subtitle="Amber = historical lead-in students see on day one; sky = the full authored season timeline. Vertical lines mark round boundaries."
        chartData={modalChart.chartData}
        boundary={modalChart.boundary}
        roundBoundaries={modalChart.roundBoundaries}
        loading={modalLoading}
        error={modalError}
      />
    </div>
  );
}
