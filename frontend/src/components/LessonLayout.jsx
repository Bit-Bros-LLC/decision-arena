import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import lessons from '../data/lessons';

export default function LessonLayout({ slug, children, sections }) {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  const lesson = lessons.find((l) => l.slug === slug);
  const lessonIdx = lessons.findIndex((l) => l.slug === slug);
  const nextLesson = lessons[lessonIdx + 1] || null;
  const totalSections = sections?.length || 1;
  const isLastSection = currentSection >= totalSections - 1;

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      await api.completeLesson(slug);
      setCompleted(true);
    } catch {
      // silent
    } finally {
      setCompleting(false);
    }
  }, [slug]);

  const goNext = () => {
    if (!isLastSection) {
      setCurrentSection((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goPrev = () => {
    if (currentSection > 0) {
      setCurrentSection((p) => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/learn')}
          className="text-sm text-slate-400 hover:text-amber-400 transition-colors mb-3 inline-block"
        >
          &larr; Back to Learn
        </button>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{lesson?.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{lesson?.title}</h1>
            <span className="text-xs text-slate-500">~{lesson?.estimatedMinutes} min</span>
          </div>
        </div>
      </div>

      {/* Section progress */}
      {totalSections > 1 && (
        <div className="flex items-center gap-2">
          {sections.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentSection(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= currentSection ? 'bg-amber-500' : 'bg-slate-700'
              }`}
              title={`Section ${i + 1}`}
            />
          ))}
          <span className="text-xs text-slate-500 ml-2 whitespace-nowrap">
            {currentSection + 1} / {totalSections}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="prose-custom">
        {sections ? sections[currentSection] : children}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <button
          onClick={goPrev}
          disabled={currentSection === 0}
          className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Previous
        </button>

        <div className="flex gap-3">
          {!isLastSection ? (
            <button
              onClick={goNext}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
            >
              Next &rarr;
            </button>
          ) : completed ? (
            <div className="flex items-center gap-3">
              <span className="text-green-400 text-sm font-medium">✓ Completed!</span>
              {nextLesson && (
                <button
                  onClick={() => navigate(`/learn/${nextLesson.slug}`)}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
                >
                  Next Lesson &rarr;
                </button>
              )}
              {!nextLesson && (
                <button
                  onClick={() => navigate('/learn')}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors"
                >
                  Back to Learn
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {completing ? 'Saving...' : 'Mark Complete ✓'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
