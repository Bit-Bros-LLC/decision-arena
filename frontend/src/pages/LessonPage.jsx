import { Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import lessons from '../data/lessons';

export default function LessonPage() {
  const { slug } = useParams();
  const lesson = lessons.find((l) => l.slug === slug);

  if (!lesson) return <Navigate to="/learn" replace />;

  const Component = lesson.component;

  return (
    <Suspense
      fallback={
        <div className="text-center py-20 text-slate-400">Loading lesson...</div>
      }
    >
      <Component />
    </Suspense>
  );
}
