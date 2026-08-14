import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, getUser } from '../api';
import { FieldLabel } from '../components/FieldLabel';
import SeasonModeConfigurator from '../components/SeasonModeConfigurator';
import SeasonAdvancedSettings from '../components/SeasonAdvancedSettings';
import PresetPreviewModal from '../components/PresetPreviewModal';
import StoryPackageCard from '../components/StoryPackageCard';
import StoryNews from '../components/StoryNews';
import Narrative from '../components/Narrative';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { isTourDone, TOUR_IDS } from '../lib/onboarding';
import {
  buildProfessorSeasonTourSteps,
  getProfessorSeasonTourStartupSelectors,
  PROFESSOR_SEASON_DEMAND_PREVIEW_STEP,
} from '../lib/professorSeasonTour';
import { SEASON_CREATOR_COPY } from '../lib/seasonCreatorCopy';
import {
  defaultConfigFor,
  transformPreviewResponse,
} from '../lib/presetPreview';
import { loadPresetPreview } from '../hooks/usePresetPreview';
import { runOnboardingTour } from '../lib/runOnboardingTour';
import {
  buildMixConfig,
  defaultAllowedPresets,
  primaryScenarioPreset,
  validateSeasonModeConfig,
} from '../lib/seasonMixConfig';
import { isTypicalMonthDuration, TYPICAL_MONTH_DAYS_MIN, TYPICAL_MONTH_DAYS_MAX } from '../lib/seasonDuration';

const DEMAND_PREVIEW_SELECTOR = '[data-tour="season-demand-preview"]';

function waitForSelector(selector, { maxAttempts = 20, intervalMs = 50 } = {}) {
  return new Promise((resolve) => {
    let attempt = 0;
    function tryFind() {
      if (document.querySelector(selector)) {
        resolve(true);
        return;
      }
      if (attempt < maxAttempts) {
        attempt += 1;
        setTimeout(tryFind, intervalMs);
        return;
      }
      resolve(false);
    }
    tryFind();
  });
}

const DEFAULT_COSTS = {
  holding_per_unit: 1,
  stockout_penalty: 10,
  ordering_fixed: 20,
  per_unit_cost: 5,
  selling_price: 15,
  dual_source_enabled: false,
  dual_source_premium_per_unit: 2,
  dual_source_rescue_pct: 1,
};

const EMPTY_STORY_CHART = {
  chartData: [],
  boundary: null,
  roundBoundaries: [],
};

function nextSundayMidnightLocal() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  let daysToAdd = (7 - day) % 7;
  if (daysToAdd === 0) {
    d.setHours(0, 0, 0, 0);
    if (now.getTime() >= d.getTime()) daysToAdd = 7;
  }
  if (daysToAdd > 0) d.setDate(d.getDate() + daysToAdd);
  d.setHours(0, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
}

export default function SeasonCreator() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = getUser();
  const isProfessor = user?.role === 'professor';
  const { markChecklistItem, userId, userRole, tourRevision } = useOnboarding();
  const tourStartedRef = useRef(false);
  const tourDriverRef = useRef(null);
  const storyIdAtTourStartRef = useRef(null);
  const skipModalCloseAdvanceRef = useRef(false);
  const openStoryDemandPreviewRef = useRef(async () => {});
  const clearStoryChartRef = useRef(() => {});
  const selectedStoryRef = useRef(null);
  const storyChartOpenRef = useRef(false);
  const storyChartOpenPrevRef = useRef(false);
  const [tourActive, setTourActive] = useState(false);

  const [presets, setPresets] = useState([]);
  const [presetsError, setPresetsError] = useState(null);
  const [presetsReady, setPresetsReady] = useState(false);
  const [roomLabel, setRoomLabel] = useState(null);

  const [name, setName] = useState('');
  const [totalRounds, setTotalRounds] = useState(20);
  const [contractUpdates, setContractUpdates] = useState(3);
  const [roundDuration, setRoundDuration] = useState(30);
  const [leadinDays, setLeadinDays] = useState(60);
  const [firstDeadline, setFirstDeadline] = useState(nextSundayMidnightLocal);
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [startingInventory, setStartingInventory] = useState(100);

  const [activePresetId, setActivePresetId] = useState(null);
  const [scenarioConfig, setScenarioConfig] = useState({});
  const [seasonMode, setSeasonMode] = useState('single');
  const [allowedPresets, setAllowedPresets] = useState([]);
  const [customRoundPresets, setCustomRoundPresets] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [formChartOpen, setFormChartOpen] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [previewChartData, setPreviewChartData] = useState([]);
  const [previewBoundary, setPreviewBoundary] = useState(null);
  const [previewRoundBoundaries, setPreviewRoundBoundaries] = useState([]);

  const [cardModalPreset, setCardModalPreset] = useState(null);
  const [cardModalLoading, setCardModalLoading] = useState(false);
  const [cardModalError, setCardModalError] = useState(null);
  const [cardModalChart, setCardModalChart] = useState({
    chartData: [],
    boundary: null,
    roundBoundaries: [],
  });

  const [stories, setStories] = useState([]);
  const [storiesError, setStoriesError] = useState(null);
  const [storiesReady, setStoriesReady] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState(null);
  const [customBuildOpen, setCustomBuildOpen] = useState(false);
  const [storyChartOpen, setStoryChartOpen] = useState(false);
  const [storyChartLoading, setStoryChartLoading] = useState(false);
  const [storyChartError, setStoryChartError] = useState(null);
  const [storyChart, setStoryChart] = useState(EMPTY_STORY_CHART);
  const [storyChartStory, setStoryChartStory] = useState(null);
  const storyChartRequestIdRef = useRef(0);

  useBreadcrumbLabels({ labels: roomLabel ? { room: roomLabel } : {} });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rooms = await api.getRooms();
        if (cancelled) return;
        const found = rooms.find((r) => r.id === roomId);
        if (found?.completed) {
          navigate(`/room/${roomId}`, { replace: true });
          return;
        }
        setRoomLabel(found?.name ?? roomId);
      } catch {
        if (!cancelled) setRoomLabel(roomId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listSeasonPresets();
        if (cancelled) return;
        setPresets(Array.isArray(list) ? list : []);
        if (!activePresetId && list.length > 0) {
          setActivePresetId(list[0].id);
          setScenarioConfig(defaultConfigFor(list[0].id));
          setAllowedPresets(defaultAllowedPresets(list));
        }
      } catch (err) {
        if (!cancelled) setPresetsError(err.message || 'Could not load presets');
      } finally {
        if (!cancelled) setPresetsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listStoryPackages();
        if (!cancelled) setStories(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setStoriesError(err.message || 'Could not load stories');
      } finally {
        if (!cancelled) setStoriesReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStory = useMemo(
    () => stories.find((s) => s.id === selectedStoryId) || null,
    [stories, selectedStoryId],
  );
  const storyLocked = Boolean(selectedStory);
  selectedStoryRef.current = selectedStory;
  storyChartOpenRef.current = storyChartOpen;

  const clearStoryChart = () => {
    storyChartRequestIdRef.current += 1;
    setStoryChartOpen(false);
    setStoryChartLoading(false);
    setStoryChartError(null);
    setStoryChart(EMPTY_STORY_CHART);
    setStoryChartStory(null);
  };
  clearStoryChartRef.current = clearStoryChart;

  const openStoryDemandPreview = async (story) => {
    const target = story ?? selectedStoryRef.current;
    if (!target) return;
    const requestId = ++storyChartRequestIdRef.current;
    setStoryChart(EMPTY_STORY_CHART);
    setStoryChartStory(target);
    setStoryChartError(null);
    setStoryChartLoading(true);
    setStoryChartOpen(true);
    try {
      const res = await api.previewStoryPackage(target.id);
      if (requestId !== storyChartRequestIdRef.current) return;
      const transformed = transformPreviewResponse(res);
      setStoryChart({
        chartData: transformed.chartData,
        boundary: transformed.boundary,
        roundBoundaries: transformed.roundBoundaries,
      });
    } catch (err) {
      if (requestId !== storyChartRequestIdRef.current) return;
      setStoryChartError(err.message || 'Could not generate preview');
    } finally {
      if (requestId === storyChartRequestIdRef.current) {
        setStoryChartLoading(false);
      }
    }
  };
  openStoryDemandPreviewRef.current = openStoryDemandPreview;

  const openDemandPreviewForTour = async () => {
    if (storyChartOpenRef.current && document.querySelector(DEMAND_PREVIEW_SELECTOR)) {
      return;
    }
    const story = selectedStoryRef.current;
    if (!story) return;
    openStoryDemandPreviewRef.current(story);
    await waitForSelector(DEMAND_PREVIEW_SELECTOR);
  };

  const applyStory = (story) => {
    if (!story) {
      setSelectedStoryId(null);
      clearStoryChart();
      return;
    }
    setCustomBuildOpen(false);
    setSelectedStoryId(story.id);
    setTotalRounds(story.total_rounds);
    setContractUpdates(story.contract_updates_allowed);
    setRoundDuration(story.round_duration_days);
    setLeadinDays(story.historical_leadin_days);
    setStartingInventory(story.starting_inventory);
    setCosts({ ...DEFAULT_COSTS, ...(story.costs || {}) });
    setSubmitError(null);
    clearStoryChart();
  };

  // Auto-fill the season name as "Story title — Class name" once both are known.
  useEffect(() => {
    if (selectedStory && roomLabel) {
      setName(`${selectedStory.title} — ${roomLabel}`);
    }
  }, [selectedStory, roomLabel]);

  // Deep link from the story library: /room/:id/create-season?story=<id>
  const storyParamRef = useRef(false);
  useEffect(() => {
    if (storyParamRef.current) return;
    const wanted = searchParams.get('story');
    if (!wanted || stories.length === 0) return;
    const match = stories.find((s) => s.id === wanted);
    if (match) {
      storyParamRef.current = true;
      applyStory(match);
    }
  }, [searchParams, stories]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCustomRoundPresets((prev) => {
      const next = [...prev];
      const base = activePresetId || 'steady';
      while (next.length < Number(totalRounds)) next.push(base);
      return next.slice(0, Number(totalRounds));
    });
  }, [totalRounds, activePresetId]);

  const mixConfig = useMemo(
    () => buildMixConfig(seasonMode, allowedPresets, customRoundPresets),
    [seasonMode, allowedPresets, customRoundPresets],
  );

  useEffect(() => {
    tourStartedRef.current = false;
    storyIdAtTourStartRef.current = null;
    skipModalCloseAdvanceRef.current = false;
    setTourActive(false);
    tourDriverRef.current?.destroy?.();
    tourDriverRef.current = null;
  }, [roomId, tourRevision]);

  useEffect(() => {
    if (!userId || !isProfessor || !presetsReady || !storiesReady) return;
    if (isTourDone(userId, TOUR_IDS.PROFESSOR_SEASON)) return;
    if (tourStartedRef.current) return;

    const wantedStory = searchParams.get('story');
    if (wantedStory && stories.some((s) => s.id === wantedStory) && !selectedStoryId) {
      return;
    }

    const hasStorySelected = Boolean(selectedStoryId);
    const baseSteps = buildProfessorSeasonTourSteps(hasStorySelected);
    const steps = baseSteps.map((step, index) => {
      if (index === 0) {
        return {
          ...step,
          prepareNext: () => openDemandPreviewForTour(),
        };
      }
      if (index === PROFESSOR_SEASON_DEMAND_PREVIEW_STEP) {
        return {
          ...step,
          preparePrevious: () => {
            skipModalCloseAdvanceRef.current = true;
            clearStoryChartRef.current();
          },
        };
      }
      return step;
    });
    const startupSelectors = getProfessorSeasonTourStartupSelectors(hasStorySelected);

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 15;

    function tryStartTour() {
      if (cancelled || tourStartedRef.current) return;

      const missing = startupSelectors.some((selector) => !document.querySelector(selector));
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
      storyIdAtTourStartRef.current = selectedStoryId;
      setTourActive(true);
      tourDriverRef.current = runOnboardingTour({
        userId,
        userRole,
        tourId: TOUR_IDS.PROFESSOR_SEASON,
        steps,
        onDestroyed: () => {
          setTourActive(false);
        },
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
    roomId,
    isProfessor,
    presetsReady,
    storiesReady,
    selectedStoryId,
    searchParams,
    stories,
  ]);

  // Step 0 without a pre-selected story: Use this story → open demand preview → advance.
  useEffect(() => {
    if (!selectedStoryId) return;
    if (storyIdAtTourStartRef.current) return;

    const driverInstance = tourDriverRef.current;
    if (!driverInstance?.isActive?.()) return;
    if (driverInstance.getActiveIndex?.() !== 0) return;

    let cancelled = false;

    (async () => {
      await openDemandPreviewForTour();
      if (cancelled) return;
      if (
        tourDriverRef.current?.isActive?.() &&
        tourDriverRef.current.getActiveIndex?.() === 0
      ) {
        tourDriverRef.current.moveNext();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedStoryId]);

  // Demand-preview step: closing the chart advances (unless user hit Back).
  useEffect(() => {
    const wasOpen = storyChartOpenPrevRef.current;
    storyChartOpenPrevRef.current = storyChartOpen;

    if (!wasOpen || storyChartOpen) return;
    if (skipModalCloseAdvanceRef.current) {
      skipModalCloseAdvanceRef.current = false;
      return;
    }

    const driverInstance = tourDriverRef.current;
    if (!driverInstance?.isActive?.()) return;
    if (driverInstance.getActiveIndex?.() !== PROFESSOR_SEASON_DEMAND_PREVIEW_STEP) return;

    requestAnimationFrame(() => {
      if (
        tourDriverRef.current?.isActive?.() &&
        tourDriverRef.current.getActiveIndex?.() === PROFESSOR_SEASON_DEMAND_PREVIEW_STEP
      ) {
        tourDriverRef.current.moveNext();
      }
    });
  }, [storyChartOpen]);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId],
  );

  const updateCost = (key, raw) => {
    if (key === 'dual_source_enabled') {
      setCosts((c) => ({ ...c, dual_source_enabled: raw === true || raw === 'true' }));
      return;
    }
    const num = parseFloat(raw);
    setCosts((c) => ({ ...c, [key]: Number.isFinite(num) ? num : c[key] }));
  };

  const updateScenarioField = (key, raw) => {
    const num = parseFloat(raw);
    setScenarioConfig((cfg) => ({
      ...cfg,
      [key]: Number.isFinite(num) ? num : cfg[key],
    }));
  };

  const pickPreset = (preset) => {
    if (seasonMode === 'random_mix') {
      setAllowedPresets((prev) => {
        const active = prev.includes(preset.id);
        if (active && prev.length <= 1) return prev;
        return active ? prev.filter((x) => x !== preset.id) : [...prev, preset.id];
      });
      return;
    }
    setActivePresetId(preset.id);
    setScenarioConfig(defaultConfigFor(preset.id));
    setChartError(null);
  };

  const handleCustomRoundPresetChange = (idx, value) => {
    setCustomRoundPresets((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const openCardPreview = async (preset) => {
    setCardModalPreset(preset);
    setCardModalError(null);
    setCardModalLoading(true);
    try {
      const data = await loadPresetPreview(preset.id);
      if (data) {
        setCardModalChart({
          chartData: data.chartData,
          boundary: data.boundary,
          roundBoundaries: data.roundBoundaries,
        });
      }
    } catch (err) {
      setCardModalError(err.message || 'Could not generate preview');
    } finally {
      setCardModalLoading(false);
    }
  };

  const closeCardPreview = () => {
    setCardModalPreset(null);
    setCardModalError(null);
    setCardModalChart({ chartData: [], boundary: null, roundBoundaries: [] });
  };

  useEffect(() => {
    if (!formChartOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setFormChartOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [formChartOpen]);

  const openDemandChartPreview = async () => {
    setChartError(null);
    const modeError = validateSeasonModeConfig(
      seasonMode,
      activePresetId,
      allowedPresets,
      customRoundPresets,
      totalRounds,
    );
    if (modeError) {
      setChartError(modeError);
      return;
    }
    const basePreset = primaryScenarioPreset(
      seasonMode,
      activePresetId,
      allowedPresets,
      customRoundPresets,
    );
    const rounds = Number(totalRounds);
    const duration = Number(roundDuration);
    const leadin = Number(leadinDays);
    if (!Number.isFinite(rounds) || rounds < 1) {
      setChartError('Total months must be at least 1.');
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      setChartError('Month length must be at least 1 day.');
      return;
    }
    if (!Number.isFinite(leadin) || leadin < 0) {
      setChartError('Historical lead-in must be 0 or more days.');
      return;
    }
    setChartLoading(true);
    try {
      const res = await api.previewSeason({
        scenario_preset: basePreset,
        scenario_config: seasonMode === 'single' ? scenarioConfig : defaultConfigFor(basePreset),
        total_rounds: rounds,
        round_duration_days: duration,
        historical_leadin_days: leadin,
        season_mode: seasonMode,
        mix_config: mixConfig,
      });
      const transformed = transformPreviewResponse(res);
      setPreviewChartData(transformed.chartData);
      setPreviewBoundary(transformed.boundary);
      setPreviewRoundBoundaries(transformed.roundBoundaries);
      setFormChartOpen(true);
    } catch (err) {
      setChartError(err.message || 'Could not generate preview');
    } finally {
      setChartLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSubmitError('Please enter a fiscal year name');
      return;
    }
    if (!firstDeadline) {
      setSubmitError('Set a first-month deadline.');
      return;
    }
    if (!storyLocked && !customBuildOpen) {
      setSubmitError('Pick a story or expand Custom configuration to build your own.');
      return;
    }
    const deadlineIsoBase = firstDeadline.length === 16 ? `${firstDeadline}:00` : firstDeadline;

    // Story package path: the backend derives every mechanical setting from the
    // authored package, so we only send the name, deadline, and story id.
    if (storyLocked) {
      setSubmitting(true);
      try {
        const res = await api.createSeason({
          room_id: roomId,
          name: trimmedName,
          story_package_id: selectedStory.id,
          costs: selectedStory.costs,
          first_round_deadline: deadlineIsoBase,
        });
        markChecklistItem('create_season');
        navigate(`/room/${roomId}/season/${res.id}`);
      } catch (err) {
        setSubmitError(err.message || 'Failed to create fiscal year');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const modeError = validateSeasonModeConfig(
      seasonMode,
      activePresetId,
      allowedPresets,
      customRoundPresets,
      totalRounds,
    );
    if (modeError) {
      setSubmitError(modeError);
      return;
    }
    if (!firstDeadline) {
      setSubmitError('Set a first-month deadline.');
      return;
    }
    const duration = Number(roundDuration);
    if (!isTypicalMonthDuration(duration)) {
      const proceed = window.confirm(
        `Month length is ${duration} days. Months are typically ${TYPICAL_MONTH_DAYS_MIN}–${TYPICAL_MONTH_DAYS_MAX} days. Create this fiscal year anyway?`,
      );
      if (!proceed) return;
    }
    const basePreset = primaryScenarioPreset(
      seasonMode,
      activePresetId,
      allowedPresets,
      customRoundPresets,
    );
    const deadlineIso = firstDeadline.length === 16 ? `${firstDeadline}:00` : firstDeadline;
    setSubmitting(true);
    try {
      const res = await api.createSeason({
        room_id: roomId,
        name: trimmedName,
        scenario_preset: basePreset,
        scenario_config: seasonMode === 'single' ? scenarioConfig : defaultConfigFor(basePreset),
        season_mode: seasonMode,
        mix_config: mixConfig,
        costs,
        starting_inventory: Number(startingInventory),
        total_rounds: Number(totalRounds),
        contract_updates_allowed: Number(contractUpdates),
        round_duration_days: Number(roundDuration),
        historical_leadin_days: Number(leadinDays),
        first_round_deadline: deadlineIso,
      });
      markChecklistItem('create_season');
      navigate(`/room/${roomId}/season/${res.id}`);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create fiscal year');
    } finally {
      setSubmitting(false);
    }
  };

  const formChartSubtitle = `Historical lead-in (amber) students will see on day one, then the full fiscal year timeline (sky) across ${totalRounds} months of ${roundDuration} days. Solid vertical line marks where month 1 begins; faint lines mark subsequent month boundaries.`;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Create fiscal year</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure rules, costs, and demand scenario for your class. Students play each month before
          you score and advance.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Classroom: <span className="text-slate-200">{roomLabel ?? '…'}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
      >
        <fieldset className="space-y-4" data-tour="season-stories">
          <legend className="text-lg font-medium text-amber-500">Start from a story</legend>
          <p className="text-sm text-slate-400">
            Pick a ready-made narrative fiscal year — months, policy reviews, duration, inventory,
            costs, demand timeline, and a professor-only story briefing are pre-built for you.{' '}
            <a
              href={`/stories?room=${roomId}`}
              className="text-amber-500 hover:text-amber-400"
            >
              Browse the full story library →
            </a>
          </p>
          {storiesError && <p className="text-sm text-red-400">{storiesError}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {stories.map((story) => (
              <StoryPackageCard
                key={story.id}
                story={story}
                selected={selectedStoryId === story.id}
                onSelect={applyStory}
                previewDisabled={tourActive}
                onPreview={(s) => {
                  if (selectedStoryId !== s.id) applyStory(s);
                  openStoryDemandPreview(s);
                }}
              />
            ))}
          </div>
        </fieldset>

        <details
          className="group rounded-lg border border-slate-700 bg-slate-900/40"
          open={customBuildOpen}
          onToggle={(e) => {
            const open = e.currentTarget.open;
            setCustomBuildOpen(open);
            if (open) setSelectedStoryId(null);
          }}
        >
          <summary
            className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-slate-200 marker:content-none"
            data-tour="season-custom"
          >
            <span>Custom configuration (build the fiscal year manually)</span>
            <span className="text-slate-400 transition-transform group-open:rotate-90">▶</span>
          </summary>
          <div className="space-y-6 border-t border-slate-700 px-4 py-4">
            <p className="text-sm text-slate-400">{SEASON_CREATOR_COPY.customConfiguration}</p>

            <fieldset className="space-y-4">
              <legend className="text-lg font-medium text-amber-500">Fiscal year rules</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel label="Total months" help={SEASON_CREATOR_COPY.totalRounds} />
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <FieldLabel
                    label="Policy reviews per student"
                    help={SEASON_CREATOR_COPY.contractUpdatesPerStudent}
                  />
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={contractUpdates}
                    onChange={(e) => setContractUpdates(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-lg font-medium text-amber-500">Fiscal year scenario</legend>
              <SeasonModeConfigurator
                presets={presets}
                seasonMode={seasonMode}
                onSeasonModeChange={setSeasonMode}
                scenarioPreset={activePresetId}
                allowedPresets={allowedPresets}
                customRoundPresets={customRoundPresets}
                onCustomRoundPresetChange={handleCustomRoundPresetChange}
                totalRounds={totalRounds}
                onPresetSelect={pickPreset}
                onPreview={openCardPreview}
                scenariosLink={`/scenarios?room=${roomId}`}
                showModeSelector
                scenarioHelp={SEASON_CREATOR_COPY.seasonScenario}
              />
              {presetsError && <p className="text-sm text-red-400">{presetsError}</p>}
            </fieldset>

            <div>
              <FieldLabel
                label="Preview demand chart"
                help={SEASON_CREATOR_COPY.previewDemand}
              />
              <button
                type="button"
                onClick={openDemandChartPreview}
                disabled={chartLoading}
                className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-slate-700 disabled:opacity-50"
              >
                {chartLoading ? 'Generating…' : 'Preview demand chart'}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Preview with your current fiscal year settings (months, lead-in, and tuning sliders).
              </p>
              {chartError && <p className="mt-2 text-sm text-red-400">{chartError}</p>}
            </div>

            <SeasonAdvancedSettings
              costs={costs}
              onCostChange={updateCost}
              roundDuration={roundDuration}
              onRoundDurationChange={setRoundDuration}
              leadinDays={leadinDays}
              onLeadinDaysChange={setLeadinDays}
              startingInventory={startingInventory}
              onStartingInventoryChange={setStartingInventory}
              showDualSourceToggle
              showDualSourceSubFields={Boolean(costs.dual_source_enabled)}
              dualSourceToggleLabel="Enable dual sourcing for students"
              summaryText={SEASON_CREATOR_COPY.advancedUsers}
              presetTuning={
                seasonMode === 'single' && activePreset
                  ? {
                      seasonMode,
                      presetId: activePresetId,
                      presetName: activePreset.name,
                      scenarioConfig,
                      onScenarioFieldChange: updateScenarioField,
                    }
                  : null
              }
            />
          </div>
        </details>

        <div data-tour="season-name">
          <FieldLabel label="Fiscal year name" help={SEASON_CREATOR_COPY.seasonName} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={SEASON_CREATOR_COPY.seasonNamePlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <p className="mt-1 text-xs text-slate-500">{SEASON_CREATOR_COPY.seasonNameHelper}</p>
        </div>

        <div data-tour="season-deadline">
          <FieldLabel
            label="First month deadline"
            help={SEASON_CREATOR_COPY.firstRoundDeadline}
          />
          <input
            type="datetime-local"
            value={firstDeadline}
            onChange={(e) => setFirstDeadline(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 [color-scheme:dark]"
          />
          <p className="mt-1 text-xs text-slate-500">
            {storyLocked
              ? `Subsequent months auto-schedule ${selectedStory.round_duration_days} days apart. You advance each month manually from the fiscal year dashboard.`
              : `Subsequent months auto-schedule ${roundDuration} days apart. You advance each month manually from the fiscal year dashboard.`}
          </p>
        </div>

        {storyLocked && (
          <>
            <fieldset className="space-y-4">
              <legend className="text-lg font-medium text-amber-500">
                {selectedStory.title} · setup
              </legend>
              <p className="text-xs text-slate-500">
                These settings are pre-selected by the story and can't be edited. Expand{' '}
                <span className="text-slate-300">Custom configuration</span> below to build your own.
              </p>
              <dl className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Total months', selectedStory.total_rounds],
                  ['Policy reviews', selectedStory.contract_updates_allowed],
                  ['Month length', `${selectedStory.round_duration_days} days`],
                  ['Historical lead-in', `${selectedStory.historical_leadin_days} days`],
                  ['Starting inventory', selectedStory.starting_inventory],
                  ['Dual sourcing', selectedStory.costs?.dual_source_enabled ? 'Enabled' : 'Off'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
              <div data-tour="season-story-demand">
                <button
                  type="button"
                  onClick={() => openStoryDemandPreview()}
                  disabled={storyChartLoading}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-slate-700 disabled:opacity-50"
                >
                  {storyChartLoading ? 'Generating…' : 'Preview demand chart'}
                </button>
                {storyChartError && <p className="mt-2 text-sm text-red-400">{storyChartError}</p>}
              </div>
            </fieldset>

            <fieldset className="space-y-3" data-tour="season-story-narrative">
              <legend className="text-lg font-medium text-amber-500">The story (professor only)</legend>
              <p className="text-xs text-slate-500">
                Students never see this full arc — it would spoil the year. Brief yourself here before
                you create.
              </p>
              <Narrative text={selectedStory.narrative} />
            </fieldset>

            <fieldset className="space-y-3" data-tour="season-newsroom">
              <legend className="text-lg font-medium text-amber-500">Newsroom (full briefing)</legend>
              <p className="text-xs text-slate-500">
                You see every month&apos;s forecast and event below. Students only unlock items as each
                month arrives — mostly the current event and upcoming forecasts — so they can decide
                whether a policy review is worth it.
              </p>
              <StoryNews news={selectedStory.news} activeRoundNumber={null} />
            </fieldset>
          </>
        )}

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            data-tour="season-create"
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create fiscal year'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/room/${roomId}`)}
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>

      <PresetPreviewModal
        open={Boolean(cardModalPreset)}
        onClose={closeCardPreview}
        title={cardModalPreset ? `${cardModalPreset.name} — sample demand preview` : ''}
        subtitle="Sample: 3 months × 30 days with 60-day historical lead-in (default preset tuning)."
        chartData={cardModalChart.chartData}
        boundary={cardModalChart.boundary}
        roundBoundaries={cardModalChart.roundBoundaries}
        loading={cardModalLoading}
        error={cardModalError}
      />

      <PresetPreviewModal
        open={formChartOpen && previewBoundary != null}
        onClose={() => setFormChartOpen(false)}
        title="Fiscal year demand preview"
        subtitle={formChartSubtitle}
        chartData={previewChartData}
        boundary={previewBoundary}
        roundBoundaries={previewRoundBoundaries}
      />

      <PresetPreviewModal
        open={storyChartOpen}
        onClose={clearStoryChart}
        title={storyChartStory ? `${storyChartStory.title} — demand timeline` : 'Story demand'}
        subtitle="Amber = historical lead-in students see on day one; sky = the full authored fiscal year timeline. Vertical lines mark month boundaries."
        chartData={storyChart.chartData}
        boundary={storyChart.boundary}
        roundBoundaries={storyChart.roundBoundaries}
        loading={storyChartLoading}
        error={storyChartError}
        dataTour="season-demand-preview"
      />
    </div>
  );
}
