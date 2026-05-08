export default function ConsentBanner({ onAccept, onDecline }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700 bg-slate-900/95 p-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-300">
          We use Google Analytics to understand product usage and improve Decision Arena.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
