import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import lessons from '../data/lessons';

export default function LearnHub() {
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLessonProgress()
      .then((rows) => {
        const map = {};
        rows.forEach((r) => {
          if (r.completed) map[r.lesson_slug] = r;
        });
        setProgress(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completedCount = lessons.filter((l) => progress[l.slug]).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Learn</h1>
        <p className="text-slate-400 mt-1">
          Interactive lessons on supply-chain decision making under uncertainty.
        </p>
      </div>

      {/* Progress bar */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-300">Your Progress</span>
          <span className="text-sm text-slate-400">
            {completedCount} of {lessons.length} completed
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2.5">
          <div
            className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
            style={{
              width: `${lessons.length > 0 ? (completedCount / lessons.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Lesson grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading lessons...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lessons.map((lesson) => {
            const done = !!progress[lesson.slug];
            return (
              <Link
                key={lesson.slug}
                to={`/learn/${lesson.slug}`}
                className={`group relative block rounded-lg border p-5 transition-all hover:scale-[1.01] ${
                  done
                    ? 'border-green-600/40 bg-green-900/10 hover:border-green-500/60'
                    : 'border-slate-700 bg-slate-800/60 hover:border-amber-500/50'
                }`}
              >
                {done && (
                  <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-600 text-xs text-white">
                    ✓
                  </span>
                )}

                <div className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{lesson.icon}</span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-slate-100 group-hover:text-amber-400 transition-colors">
                      {lesson.title}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                      {lesson.description}
                    </p>
                    <span className="inline-block mt-2 text-xs text-slate-500">
                      ~{lesson.estimatedMinutes} min
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
