import { Link } from 'react-router-dom';
import LessonLayout from '../../components/LessonLayout';
import { useOnboarding } from '../../context/OnboardingContext';

function Section1() {
  const { openIntroVideo } = useOnboarding();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">The Decision Factory</h2>
      <p className="text-slate-300 leading-relaxed">
        Modern organizations are, at their core,{' '}
        <strong className="text-amber-400">factories for producing decisions</strong>. Every
        process, meeting, and system exists to turn information into action under uncertainty.
        Decision Arena is a practice factory — a safe place to run that loop every day.
      </p>

      <h2 className="text-xl font-semibold text-slate-100 pt-2">Two daily levers</h2>
      <p className="text-slate-300 leading-relaxed">
        Each simulated day you face two levers. First,{' '}
        <strong className="text-slate-100">how much to order</strong> — driven by your policy
        template and its parameters. Second, when dual sourcing is enabled,{' '}
        <strong className="text-slate-100">single source vs dual source</strong> — trading higher
        unit cost for resilience when suppliers fail.
      </p>

      <h2 className="text-xl font-semibold text-slate-100 pt-2">Policies</h2>
      <p className="text-slate-300 leading-relaxed">
        Pick a policy template — <em className="text-amber-400">Order Up To</em>,{' '}
        <em className="text-amber-400">Service Level</em>, or{' '}
        <em className="text-amber-400">Reorder Point</em> — then tune it with sliders. The
        simulation runs your policy every day, placing orders and updating inventory automatically.
      </p>

      <h2 className="text-xl font-semibold text-slate-100 pt-2">History vs hidden actuals</h2>
      <p className="text-slate-300 leading-relaxed">
        You only see <strong className="text-slate-100">historical demand</strong>. Backtest as
        many times as you want against that history. When you submit, scoring runs your policy
        against <strong className="text-amber-400">hidden actuals</strong> — the real demand your
        factory will face. That gap between what you know and what happens is the heart of the game.
      </p>

      <div className="mt-6 rounded-lg border border-slate-600 bg-slate-800/60 p-5 space-y-4">
        <p className="text-sm font-medium text-slate-200">Ready to play?</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openIntroVideo('learn')}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 transition-colors"
          >
            Watch the intro
          </button>
          <Link
            to="/season-sprint/new"
            className="rounded-lg border border-slate-500 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 transition-colors"
          >
            Start a solo season
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EnterTheArena() {
  return <LessonLayout slug="enter-the-arena" sections={[<Section1 key="s1" />]} />;
}
