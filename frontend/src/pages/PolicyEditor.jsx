import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { api, getUser } from '../api';
import { HelpHint } from '../components/HelpHint';
import { UITooltip } from '../components/UITooltip';
import { COST_TOOLTIPS } from '../lib/costTooltips';
import { trackEvent } from '../lib/analytics';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { runOnboardingTour } from '../lib/runOnboardingTour';
import { isTourDone, TOUR_IDS } from '../lib/onboarding';
import { buildPolicyEditorTourSteps } from '../lib/policyEditorTour';
import StoryNews from '../components/StoryNews';

const TEMPLATES = [
  {
    id: 'order_up_to',
    label: 'Order Up To',
    desc: 'Set a target inventory level (S). Each day, order enough to bring your inventory position back up to S.',
  },
  {
    id: 'service_level',
    label: 'Service Level',
    desc: 'Target a fill rate (e.g. 95%). The system calculates safety stock from recent demand variability and lead times.',
  },
  {
    id: 'reorder_point',
    label: 'Reorder Point',
    desc: 'When inventory drops below a threshold (s), place a fixed-size order (Q). Classic (s, Q) policy.',
  },
];

const SERVICE_LEVELS = [0.85, 0.9, 0.95, 0.97, 0.99, 0.99999];
const DUAL_SOURCE_HELP =
  'When dual sourcing is enabled for this month, choose whether every order uses a backup supplier. Dual sourcing adds a per-unit premium (see cost parameters) but helps orders survive supplier failure events.';

function normalizePolicyConfig(policyType, raw) {
  const base = { ...defaultConfig(policyType), ...raw };
  if ('dual_source' in raw) {
    base.dual_source = Boolean(raw.dual_source);
  } else if (raw.insurance_mode === 'always') {
    base.dual_source = true;
  } else {
    base.dual_source = false;
  }
  delete base.insurance_mode;
  return base;
}

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function profitClass(v) {
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-red-400';
  return 'text-slate-400';
}

function formatProfitAxisTick(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 100_000) return `$${(n / 1000).toFixed(0)}k`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (Math.abs(n) >= 100) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(0)}`;
}

function computeProfitDomain(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return undefined;
  const sorted = [...v].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  if (min === max) return [min - 1, max + 1];

  const spanFull = max - min;
  const iLo = Math.floor((n - 1) * 0.05);
  const iHi = Math.ceil((n - 1) * 0.95);
  const q05 = sorted[iLo];
  const q95 = sorted[iHi];
  const spanQ = q95 - q05;

  // Few extreme days dominate → fit axis to bulk of days so the series is readable
  if (n >= 20 && spanQ > 0 && spanFull > spanQ * 6) {
    const pad = Math.max(spanQ * 0.08, 1);
    return [q05 - pad, q95 + pad];
  }

  const pad = Math.max(spanFull * 0.06, 1);
  return [min - pad, max + pad];
}

/** Green for non-negative daily profit, red for losses (single shape fn — no per-bar Cell list). */
function ProfitBarShape(props) {
  const { x, y, width, height, payload } = props;
  const profit = Number(payload?.daily_profit);
  const fill = Number.isFinite(profit) && profit >= 0 ? '#22c55e' : '#ef4444';
  const w = Number(width);
  const hRaw = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(hRaw) || w <= 0 || hRaw === 0) return null;
  // Recharts uses negative height for bars below the zero line; SVG <rect> needs positive height + top y
  const heightRect = Math.abs(hRaw);
  const yRect = hRaw < 0 ? y + hRaw : y;
  return <rect x={x} y={yRect} width={w} height={heightRect} fill={fill} rx={2} ry={2} />;
}

function formatServiceLevelOption(o) {
  const n = Number(o);
  const pct = n * 100;
  if (Number.isFinite(pct) && Math.abs(pct - Math.round(pct)) < 1e-9) {
    return `${Math.round(pct)}%`;
  }
  return `${pct.toFixed(3)}%`;
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function defaultConfig(policyType) {
  switch (policyType) {
    case 'order_up_to':
      return { target_level: 200, dual_source: false };
    case 'service_level':
      return {
        target_service_level: 0.95,
        lookback_days: 14,
        dual_source: false,
      };
    case 'reorder_point':
      return {
        reorder_point: 120,
        order_quantity: 150,
        dual_source: false,
      };
    default:
      return {};
  }
}

export default function PolicyEditor() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const { markChecklistItem, userId, userRole, tourRevision } = useOnboarding();
  const tourStartedRef = useRef(false);

  const [round, setRound] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [policyType, setPolicyType] = useState('order_up_to');
  const [config, setConfig] = useState(() => defaultConfig('order_up_to'));
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [hasSubmittedPolicy, setHasSubmittedPolicy] = useState(false);

  const [backtestResult, setBacktestResult] = useState(null);
  const [backtestError, setBacktestError] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  const [submitMsg, setSubmitMsg] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [policyPresets, setPolicyPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [libraryMsg, setLibraryMsg] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [seasonState, setSeasonState] = useState(null);
  const [seasonMeta, setSeasonMeta] = useState(null);
  const [unlockingPolicy, setUnlockingPolicy] = useState(false);
  const [unlockMsg, setUnlockMsg] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const [roomCrumbName, setRoomCrumbName] = useState(null);

  useEffect(() => {
    if (!round?.room_id) {
      setRoomCrumbName(null);
      return;
    }
    let cancelled = false;
    api
      .getRooms()
      .then((list) => {
        const found = list.find((r) => r.id === round.room_id);
        if (!cancelled) setRoomCrumbName(found?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setRoomCrumbName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [round?.room_id]);

  const breadcrumbPolicyConfig = useMemo(() => {
    if (!round) return { labels: {}, afterDashboard: [] };
    const rn = round.round_number;
    const roundPolicy = typeof rn === 'number' ? `Month ${rn} · Policy` : 'Policy';
    return {
      labels: { roundPolicy },
      afterDashboard:
        round.room_id && roomCrumbName
          ? [{ label: roomCrumbName, to: `/room/${round.room_id}` }]
          : [],
    };
  }, [round, roomCrumbName]);

  useBreadcrumbLabels(breadcrumbPolicyConfig);

  const refreshPresets = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.listPolicyPresets();
      setPolicyPresets(Array.isArray(list) ? list : []);
    } catch {
      setPolicyPresets([]);
    }
  }, [user]);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  const refreshSeasonState = useCallback(async (seasonId) => {
    if (!seasonId) {
      setSeasonState(null);
      setSeasonMeta(null);
      return;
    }
    try {
      const [state, season] = await Promise.all([
        api.getSeasonState(seasonId),
        api.getSeason(seasonId),
      ]);
      setSeasonState(state);
      setSeasonMeta(season);
    } catch {
      setSeasonState(null);
      setSeasonMeta(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [r, pol] = await Promise.all([
          api.getRound(roundId),
          api.getMyPolicy(roundId),
        ]);
        if (cancelled) return;
        setRound(r);
        setHasSubmittedPolicy(Boolean(pol));
        if (pol && pol.policy_type && pol.config) {
          setPolicyType(pol.policy_type);
          setConfig(normalizePolicyConfig(pol.policy_type, pol.config));
        }
        setPolicyLoaded(true);
        if (r?.season_id) {
          refreshSeasonState(r.season_id);
        } else {
          setSeasonState(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message || 'Failed to load month');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roundId, refreshSeasonState]);

  useEffect(() => {
    tourStartedRef.current = false;
  }, [roundId, tourRevision]);

  const historical = round?.historical_data || [];
  const costs = round?.costs || {};

  useEffect(() => {
    if (!userId || !policyLoaded || !round || loadError) return;
    if (isTourDone(userId, TOUR_IDS.POLICY_EDITOR)) return;
    if (tourStartedRef.current) return;

    const dualSourceEnabled = Boolean(costs.dual_source_enabled);
    const steps = buildPolicyEditorTourSteps({ dualSourceEnabled });

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 15;

    function tryStartTour() {
      if (cancelled || tourStartedRef.current) return;

      const missing = steps.some((step) => !document.querySelector(step.element));
      if (missing) {
        if (attempt < maxAttempts) {
          attempt += 1;
          setTimeout(tryStartTour, 100);
        }
        return;
      }

      const firstElement = document.querySelector(steps[0].element);
      firstElement?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

      tourStartedRef.current = true;
      runOnboardingTour({
        userId,
        userRole,
        tourId: TOUR_IDS.POLICY_EDITOR,
        steps,
      });
    }

    const frameId = requestAnimationFrame(tryStartTour);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [
    userId,
    userRole,
    tourRevision,
    roundId,
    policyLoaded,
    round,
    loadError,
    costs.dual_source_enabled,
  ]);

  const handleUnlockRoundPolicy = async () => {
    if (!round?.season_id) return;
    setUnlockError('');
    setUnlockMsg('');
    setUnlockingPolicy(true);
    try {
      const res = await api.unlockContractChange(round.season_id, roundId);
      setUnlockMsg(res?.message || 'Month unlocked for policy edits');
      if (round?.season_id) await refreshSeasonState(round.season_id);
    } catch (err) {
      setUnlockError(err.message || 'Could not unlock policy edits');
    } finally {
      setUnlockingPolicy(false);
    }
  };

  const demandStats = useMemo(() => {
    const demands = historical.map((d) => d.demand).filter((x) => typeof x === 'number');
    const lts = historical.map((d) => d.lead_time).filter((x) => typeof x === 'number');
    return {
      avgDemand: mean(demands),
      stdDemand: stdDev(demands),
      minD: demands.length ? Math.min(...demands) : 0,
      maxD: demands.length ? Math.max(...demands) : 0,
      avgLt: mean(lts),
    };
  }, [historical]);

  const leadTimeBuckets = useMemo(() => {
    const counts = {};
    historical.forEach((d) => {
      const lt = d.lead_time;
      if (lt == null) return;
      counts[lt] = (counts[lt] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([lead_time, count]) => ({
        lead_time: `LT ${lead_time}`,
        count,
        _sort: Number(lead_time),
      }))
      .sort((a, b) => a._sort - b._sort)
      .map(({ lead_time, count }) => ({ lead_time, count }));
  }, [historical]);

  const lineData = useMemo(
    () =>
      historical.map((d) => ({
        day: d.day,
        demand: d.demand,
      })),
    [historical],
  );

  const updateConfig = useCallback((patch) => {
    setConfig((c) => ({ ...c, ...patch }));
  }, []);

  const onTemplateChange = (id) => {
    setPolicyType(id);
    setConfig(defaultConfig(id));
    setSelectedPresetId('');
    setBacktestResult(null);
    setBacktestError(null);
  };

  const applyPreset = useCallback((preset) => {
    setPolicyType(preset.policy_type);
    setConfig(normalizePolicyConfig(preset.policy_type, preset.config));
    setSelectedPresetId(preset.id);
    setBacktestResult(null);
    setBacktestError(null);
  }, []);

  const handleLoadPresetSelect = (e) => {
    const id = e.target.value;
    setSelectedPresetId(id);
    if (!id) return;
    const preset = policyPresets.find((p) => p.id === id);
    if (preset) applyPreset(preset);
  };

  const handleSaveToLibrary = async (e) => {
    e.preventDefault();
    setLibraryMsg('');
    setLibraryError('');
    const name = libraryName.trim();
    if (!name) {
      setLibraryError('Enter a name for this preset.');
      return;
    }
    if (!user) return;
    setLibraryLoading(true);
    try {
      const res = await api.savePolicyPreset({
        name,
        policy_type: policyType,
        config,
      });
      setLibraryMsg(res?.message || 'Saved.');
      setLibraryName('');
      await refreshPresets();
      if (res?.id) setSelectedPresetId(res.id);
    } catch (err) {
      setLibraryError(err.message || 'Could not save preset');
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    if (!window.confirm('Delete this saved policy from your library?')) return;
    setLibraryMsg('');
    setLibraryError('');
    try {
      await api.deletePolicyPreset(selectedPresetId);
      setSelectedPresetId('');
      await refreshPresets();
      setLibraryMsg('Preset removed.');
    } catch (err) {
      setLibraryError(err.message || 'Could not delete');
    }
  };

  const templateShortLabel = (id) => TEMPLATES.find((t) => t.id === id)?.label ?? id;

  const runBacktest = async () => {
    setBacktestError(null);
    setBacktestLoading(true);
    try {
      const result = await api.backtest({
        round_id: roundId,
        policy_type: policyType,
        config,
      });
      setBacktestResult(result);
    } catch (e) {
      setBacktestResult(null);
      setBacktestError(e.message || 'Backtest failed');
    } finally {
      setBacktestLoading(false);
    }
  };

  const submitPolicy = async () => {
    setSubmitMsg(null);
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await api.savePolicy({
        round_id: roundId,
        policy_type: policyType,
        config,
      });
      trackEvent('policy_submitted', {
        policy_type: policyType,
        is_season_round: isSeasonRound,
      });
      markChecklistItem('submit_policy');
      setSubmitMsg(res?.message || 'Policy saved.');
      setHasSubmittedPolicy(true);
    } catch (e) {
      setSubmitError(e.message || 'Submit failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const undoSubmitPolicy = async () => {
    if (!window.confirm('Undo your submitted policy for this month?')) return;
    setSubmitMsg(null);
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await api.undoPolicySubmit(roundId);
      setSubmitMsg(res?.message || 'Policy submission undone.');
      setHasSubmittedPolicy(false);
    } catch (e) {
      setSubmitError(e.message || 'Could not undo submission');
    } finally {
      setSubmitLoading(false);
    }
  };

  const backtestProfitSeries = useMemo(() => {
    if (!backtestResult?.daily_log?.length) return [];
    return backtestResult.daily_log.map((d) => ({
      day: d.day,
      daily_profit: Number(d.daily_profit),
    }));
  }, [backtestResult]);

  const backtestProfitDomain = useMemo(
    () => computeProfitDomain(backtestProfitSeries.map((d) => d.daily_profit)),
    [backtestProfitSeries],
  );

  if (loadError) {
    return (
      <div className="p-6">
        <p className="text-red-400">{loadError}</p>
      </div>
    );
  }

  if (!round && !loadError) {
    return (
      <div className="p-6">
        <p className="text-amber-500">Loading month…</p>
      </div>
    );
  }

  const roundActive = round.status === 'active';
  const isSeasonRound = Boolean(round.season_id);
  const isSeasonFollowUpRound = isSeasonRound && round.round_number > 1;
  const seasonRoundUnlocked = !isSeasonFollowUpRound || seasonState?.active_round_unlocked === true;
  // Sandbox to try case studies / backtest without spending policy reviews — commit needs unlock.
  const canExperiment = Boolean(user) && roundActive;
  const canSubmitPolicy =
    Boolean(user) && roundActive && (!isSeasonRound ? true : seasonRoundUnlocked);

  const canSpendContractUpdate =
    isSeasonRound &&
    roundActive &&
    isSeasonFollowUpRound &&
    !seasonRoundUnlocked &&
    Boolean(seasonState?.can_unlock_active_round);

  const canScoreSoloRound =
    hasSubmittedPolicy &&
    Boolean(round?.season_id) &&
    roundActive &&
    Boolean(seasonMeta?.owner_user_id) &&
    seasonMeta.owner_user_id === user?.user_id &&
    (seasonMeta?.season_scope === 'sandbox' || Boolean(seasonMeta?.source_template_id));

  const submitNextSteps = (() => {
    if (!hasSubmittedPolicy) return null;
    if (canScoreSoloRound) {
      return 'Your policy is locked for this month. When you are ready, click Score Month to run it against hidden actuals and view results.';
    }
    if (isSeasonRound) {
      return 'Your policy is locked for this month. After the deadline, your instructor scores the month — then check month results and fiscal year standings.';
    }
    return 'Your policy is locked for this month. After the deadline, your instructor scores the month — then view month results and the leaderboard.';
  })();

  const handleScoreSoloRound = async () => {
    if (!round?.season_id) return;
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      await api.advanceSeason(round.season_id);
      navigate(`/round/${roundId}/results`);
    } catch (e) {
      setSubmitError(e.message || 'Could not score month');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="text-slate-200">
      <div className="border-b border-slate-800 bg-slate-800/80 px-4 py-4 md:px-6">
        <h1 className="text-xl font-semibold text-slate-100">
          Policy designer
          {round && (
            <span className="ml-2 text-base font-normal text-slate-400">
              · Month {round.round_number}
            </span>
          )}
        </h1>
        {!roundActive && (
          <p className="mt-2 text-sm text-amber-500/90">
            This month is scored; policy edits are closed.
          </p>
        )}

        {isSeasonRound && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs">
            {seasonState ? (
              <span className="text-slate-300">
                Policy reviews:{' '}
                <span className="font-mono text-amber-400">
                  {seasonState.contract_updates_remaining}
                </span>{' '}
                of {seasonState.contract_updates_allowed} remaining
              </span>
            ) : (
              <span className="text-slate-500">Loading policy reviews…</span>
            )}
            {roundActive && !seasonRoundUnlocked && isSeasonFollowUpRound && (
              <span className="rounded-full border border-slate-600 px-2 py-0.5 text-slate-400">
                Locked for submission · explore freely · spend a policy review only to submit
              </span>
            )}
            {roundActive && isSeasonFollowUpRound && (
              <div className="flex items-center gap-2">
                {seasonRoundUnlocked ? (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
                    Unlocked for this month
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleUnlockRoundPolicy}
                    disabled={!canSpendContractUpdate || unlockingPolicy}
                    className="rounded-lg border border-amber-500/50 bg-slate-900 px-3 py-1 text-xs font-medium text-amber-500 hover:bg-amber-500/10 disabled:opacity-40"
                    title={
                      (seasonState?.contract_updates_remaining ?? 0) === 0
                        ? 'No policy reviews remaining.'
                        : 'Unlocks Submit / Undo Submit for this month. Exploring and backtests do not spend tokens.'
                    }
                  >
                    {unlockingPolicy ? 'Unlocking…' : 'Use policy review to unlock'}
                  </button>
                )}
              </div>
            )}
            {unlockMsg && <span className="text-emerald-400">{unlockMsg}</span>}
            {unlockError && <span className="text-red-400">{unlockError}</span>}
          </div>
        )}

        {isSeasonRound && Array.isArray(seasonMeta?.news) && (() => {
          const current = Number(round.round_number);
          const relevant = seasonMeta.news.filter(
            (n) => Number(n.reveal_round) <= current && Number(n.about_round) >= current,
          );
          if (relevant.length === 0) return null;
          return (
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                Newsroom
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Use forecasts to decide whether spending a policy review now is worth it.
              </p>
              <div className="mt-2">
                <StoryNews news={relevant} activeRoundNumber={current} />
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex flex-col gap-6 p-4 lg:flex-row lg:items-start lg:gap-4 lg:p-6">
        {/* LEFT — Historical */}
        <section className="flex w-full flex-col rounded-xl border border-slate-700 bg-slate-800 p-4 lg:min-w-0 lg:flex-[1]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Historical data
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:text-sm">
            <Stat label="Avg demand" value={demandStats.avgDemand.toFixed(1)} />
            <Stat label="Std dev" value={demandStats.stdDemand.toFixed(2)} />
            <Stat label="Min / Max" value={`${demandStats.minD} / ${demandStats.maxD}`} />
            <Stat label="Avg lead time" value={demandStats.avgLt.toFixed(2)} />
          </div>

          <div className="mt-4 h-56 w-full min-w-0" data-tour="historical-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="demand"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 className="mt-4 text-xs font-medium text-slate-400">Lead time (days in sample)</h3>
          {leadTimeBuckets.length > 0 ? (
            <div className="mt-2 h-36 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadTimeBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="lead_time" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No lead time data.</p>
          )}

          <h3 className="mt-4 text-xs font-medium text-slate-400">Cost parameters</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            <CostRow label="Holding / unit" v={costs.holding_per_unit} tooltip={COST_TOOLTIPS['Holding / unit']} />
            <CostRow label="Stockout penalty" v={costs.stockout_penalty} tooltip={COST_TOOLTIPS['Stockout penalty']} />
            <CostRow label="Ordering (fixed)" v={costs.ordering_fixed} tooltip={COST_TOOLTIPS['Ordering (fixed)']} />
            <CostRow label="Per-unit cost" v={costs.per_unit_cost} tooltip={COST_TOOLTIPS['Per-unit cost']} />
            <CostRow label="Selling price" v={costs.selling_price} tooltip={COST_TOOLTIPS['Selling price']} />
            {costs.dual_source_enabled && (
              <>
                <CostRow
                  label="Dual-source premium / unit"
                  v={costs.dual_source_premium_per_unit}
                  tooltip={COST_TOOLTIPS['Dual-source premium / unit']}
                />
                <CostRow
                  label="Supplier rescue %"
                  v={`${(Number(costs.dual_source_rescue_pct ?? 1) * 100).toFixed(0)}%`}
                  tooltip={COST_TOOLTIPS['Supplier rescue %']}
                />
              </>
            )}
          </ul>
        </section>

        {/* CENTER — Policy */}
        <section className="flex w-full flex-col rounded-xl border border-slate-700 bg-slate-800 p-4 lg:min-w-0 lg:flex-[1]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Policy designer
          </h2>
          {isSeasonFollowUpRound && roundActive && !seasonRoundUnlocked && (
            <p className="mb-3 text-xs text-slate-500">
              You can experiment with any policy settings and Run Backtest anytime. Spending a policy
              review only unlocks <span className="text-slate-400">Submit Policy</span> and{' '}
              <span className="text-slate-400">Undo Submit</span> for this month.
            </p>
          )}
          {!policyLoaded && (
            <p className="mb-2 text-xs text-slate-500">Loading your saved policy…</p>
          )}
          {user && (
            <div className="mb-4 rounded-lg border border-slate-600 bg-slate-900/50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Policy library
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Save your current settings to reuse on another month. Loading a preset replaces the
                form below (does not submit to this month).
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 sm:w-[180px] sm:flex-none">
                  <label htmlFor="preset-load" className="block text-xs text-slate-400">
                    Load preset
                  </label>
                  <select
                    id="preset-load"
                    value={selectedPresetId}
                    onChange={handleLoadPresetSelect}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">— choose a saved policy —</option>
                    {policyPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({templateShortLabel(p.policy_type)})
                      </option>
                    ))}
                  </select>
                </div>
                <form
                  onSubmit={handleSaveToLibrary}
                  className="flex min-w-0 flex-1 flex-wrap items-end gap-2 sm:min-w-[340px]"
                >
                  <div className="min-w-0 flex-1">
                    <label htmlFor="preset-name" className="block text-xs text-slate-400">
                      Save current as
                    </label>
                    <input
                      id="preset-name"
                      type="text"
                      value={libraryName}
                      onChange={(e) => setLibraryName(e.target.value)}
                      placeholder="e.g. Aggressive Q1"
                      maxLength={120}
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={libraryLoading}
                    className="rounded-lg border border-amber-500/60 bg-transparent px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    {libraryLoading ? 'Saving…' : 'Save to library'}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={handleDeletePreset}
                  disabled={!selectedPresetId}
                  className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Delete selected
                </button>
              </div>
              {libraryError && (
                <p className="mt-2 text-xs text-red-400" role="alert">
                  {libraryError}
                </p>
              )}
              {libraryMsg && (
                <p className="mt-2 text-xs text-emerald-400" role="status">
                  {libraryMsg}
                </p>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3" data-tour="policy-templates">
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  policyType === t.id
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                    : 'border-slate-600 hover:border-slate-500'
                }`}
                title={t.desc}
              >
                <input
                  type="radio"
                  name="policy_template"
                  className="sr-only"
                  checked={policyType === t.id}
                  onChange={() => onTemplateChange(t.id)}
                  disabled={!canExperiment}
                />
                <span className="text-sm font-medium text-slate-100">{t.label}</span>
                <p className="mt-1 text-xs leading-snug text-slate-400">{t.desc}</p>
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-4 border-t border-slate-700 pt-4" data-tour="policy-params">
            {policyType === 'order_up_to' && (
              <>
                <RangeField
                  label="Target level (S)"
                  min={50}
                  max={2000}
                  step={10}
                  value={config.target_level ?? 200}
                  onChange={(v) => updateConfig({ target_level: v })}
                  disabled={!canExperiment}
                />
              </>
            )}
            {policyType === 'service_level' && (
              <>
                <SelectField
                  label="Target service level"
                  value={String(config.target_service_level ?? 0.95)}
                  options={SERVICE_LEVELS.map(String)}
                  formatOption={formatServiceLevelOption}
                  onChange={(v) => updateConfig({ target_service_level: Number(v) })}
                  disabled={!canExperiment}
                />
                <RangeField
                  label="Lookback days"
                  min={7}
                  max={180}
                  step={1}
                  value={config.lookback_days ?? 14}
                  onChange={(v) => updateConfig({ lookback_days: v })}
                  disabled={!canExperiment}
                />
              </>
            )}
            {policyType === 'reorder_point' && (
              <>
                <RangeField
                  label="Reorder point (s)"
                  min={20}
                  max={2000}
                  step={5}
                  value={config.reorder_point ?? 120}
                  onChange={(v) => updateConfig({ reorder_point: v })}
                  disabled={!canExperiment}
                />
                <RangeField
                  label="Order quantity (Q)"
                  min={50}
                  max={2000}
                  step={10}
                  value={config.order_quantity ?? 150}
                  onChange={(v) => updateConfig({ order_quantity: v })}
                  disabled={!canExperiment}
                />
              </>
            )}
            {costs.dual_source_enabled && (
              <DualSourceField
                value={Boolean(config.dual_source)}
                onChange={(v) => updateConfig({ dual_source: v })}
                helpText={DUAL_SOURCE_HELP}
                disabled={!canExperiment}
              />
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runBacktest}
              disabled={!user || backtestLoading}
              data-tour="backtest"
              className="rounded-lg border border-amber-500/50 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-amber-500/10 disabled:opacity-40"
            >
              {backtestLoading ? 'Running…' : 'Run Backtest'}
            </button>
            {isSeasonFollowUpRound && !seasonRoundUnlocked && (
              <button
                type="button"
                onClick={handleUnlockRoundPolicy}
                disabled={!canSpendContractUpdate || submitLoading || unlockingPolicy}
                className="rounded-lg border border-sky-500/50 bg-slate-900 px-4 py-2 text-sm font-medium text-sky-300 hover:bg-sky-500/10 disabled:opacity-40"
              >
                {unlockingPolicy ? 'Unlocking…' : 'Use policy review'}
              </button>
            )}
            <button
              type="button"
              onClick={submitPolicy}
                  disabled={!canSubmitPolicy || submitLoading}
              data-tour="submit-policy"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-40"
            >
              {submitLoading ? 'Saving…' : 'Submit Policy'}
            </button>
            <button
              type="button"
              onClick={undoSubmitPolicy}
              disabled={!canSubmitPolicy || !hasSubmittedPolicy || submitLoading}
              className="rounded-lg border border-red-500/50 bg-slate-900 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40"
            >
              {submitLoading ? 'Undoing…' : 'Undo Submit'}
            </button>
            {canScoreSoloRound && (
              <button
                type="button"
                onClick={handleScoreSoloRound}
                disabled={submitLoading}
                className="rounded-lg border border-emerald-500/50 bg-slate-900 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
              >
                {submitLoading ? 'Scoring…' : 'Score Month'}
              </button>
            )}
          </div>
          {backtestError && (
            <p className="mt-2 text-sm text-red-400">{backtestError}</p>
          )}
          {submitError && <p className="mt-2 text-sm text-red-400">{submitError}</p>}
          {submitMsg && (
            <p className="mt-2 text-sm text-emerald-400" role="status">
              {submitMsg}
            </p>
          )}
          {submitNextSteps && (
            <div className="mt-3 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
              <span className="font-medium text-slate-200">What happens next: </span>
              {submitNextSteps}
            </div>
          )}
        </section>

        {/* RIGHT — Backtest */}
        <section className="flex w-full flex-col rounded-xl border border-slate-700 bg-slate-800 p-4 lg:min-w-0 lg:flex-[1]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-500">
            Backtest results
          </h2>
          {!backtestResult ? (
            <p className="rounded-lg border border-dashed border-slate-600 bg-slate-900/50 p-6 text-center text-sm text-slate-500">
              Run a backtest to see results
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Total profit</p>
                  <p className="text-lg font-semibold text-amber-400">
                    ${Number(backtestResult.total_profit).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Service level</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {(Number(backtestResult.service_level) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-500">Stockout days</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {backtestResult.stockout_days}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={backtestProfitSeries}
                    margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tick={{ fontSize: 10 }} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      domain={backtestProfitDomain}
                      tickFormatter={formatProfitAxisTick}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [
                        typeof value === 'number'
                          ? `$${value.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`
                          : value,
                        'Daily profit',
                      ]}
                      labelFormatter={(day) => `Day ${day}`}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                    <Bar
                      dataKey="daily_profit"
                      shape={ProfitBarShape}
                      maxBarSize={10}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {Array.isArray(backtestResult.highlights) &&
                backtestResult.highlights.length > 0 && (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {backtestResult.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}

              <h3 className="mt-6 text-sm font-medium text-amber-500">Daily log</h3>
              <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-slate-700">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900/95 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2">Demand</th>
                      <th className="px-3 py-2">Sold</th>
                      <th className="px-3 py-2">Missed</th>
                      <th className="px-3 py-2">Ordered</th>
                      <th className="px-3 py-2">Inventory</th>
                      <th className="px-3 py-2">P&amp;L</th>
                      <th className="px-3 py-2">Event</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {(Array.isArray(backtestResult.daily_log) ? backtestResult.daily_log : []).map(
                      (row) => (
                        <tr key={row.day} className="hover:bg-slate-700/40">
                          <td className="px-3 py-2 tabular-nums text-slate-200">{row.day}</td>
                          <td className="px-3 py-2 tabular-nums">{row.demand}</td>
                          <td className="px-3 py-2 tabular-nums">{row.sold}</td>
                          <td className="px-3 py-2 tabular-nums">{row.unfulfilled}</td>
                          <td className="px-3 py-2 tabular-nums">{row.ordered}</td>
                          <td className="px-3 py-2 tabular-nums">{row.inventory_end}</td>
                          <td
                            className={`px-3 py-2 tabular-nums font-medium ${profitClass(
                              row.daily_profit,
                            )}`}
                          >
                            {formatMoney(row.daily_profit)}
                          </td>
                          <td className="px-3 py-2 text-amber-500/90">
                            {row.black_swan_event ? String(row.black_swan_event) : '—'}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-900/80 px-2 py-2">
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-100">{value}</p>
    </div>
  );
}

function CostRow({ label, v, tooltip }) {
  if (v === undefined || v === null) return null;
  const display = typeof v === 'number' ? v.toLocaleString() : String(v);
  return (
    <li>
      <UITooltip content={tooltip} placement="bottom" fullWidth>
        <div
          tabIndex={0}
          className="flex cursor-help justify-between gap-2 rounded-md px-0.5 py-0.5 outline-none ring-amber-500/0 transition hover:bg-slate-900/50 focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          <span className="text-slate-400">{label}</span>
          <span className="font-mono text-slate-200">{display}</span>
        </div>
      </UITooltip>
    </li>
  );
}

function RangeField({ label, min, max, step, value, onChange, disabled }) {
  return (
    <div>
      <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-amber-400">{value}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-amber-500 disabled:opacity-40"
      />
    </div>
  );
}

function DualSourceField({ value, onChange, helpText, disabled }) {
  return (
    <div data-tour="dual-sourcing">
      <div className="flex items-center gap-1">
        <span className="text-sm text-slate-300">Dual sourcing</span>
        {helpText ? <HelpHint text={helpText} ariaLabel="How dual sourcing works" /> : null}
      </div>
      <div className="mt-2 flex gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="radio"
            name="dual_source"
            checked={!value}
            disabled={disabled}
            onChange={() => onChange(false)}
            className="accent-amber-500"
          />
          Single source
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="radio"
            name="dual_source"
            checked={value}
            disabled={disabled}
            onChange={() => onChange(true)}
            className="accent-amber-500"
          />
          Dual source
        </label>
      </div>
    </div>
  );
}

function SelectField({
  label,
  helpText,
  value,
  options,
  onChange,
  disabled,
  formatOption,
}) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <label className="text-sm text-slate-300">{label}</label>
        {helpText ? <HelpHint text={helpText} ariaLabel="How this setting works" /> : null}
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none disabled:opacity-40"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {formatOption ? formatOption(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}
