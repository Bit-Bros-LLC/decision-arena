import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { FieldLabel } from '../components/FieldLabel';
import SeasonModeConfigurator from '../components/SeasonModeConfigurator';
import SeasonAdvancedSettings from '../components/SeasonAdvancedSettings';
import DualSourceFields from '../components/DualSourceFields';
import PresetPreviewModal from '../components/PresetPreviewModal';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { SEASON_SPRINT_COPY } from '../lib/seasonSprintCopy';
import { defaultConfigFor, PRESET_CONFIG_FIELDS } from '../lib/presetPreview';
import {
  buildMixConfig,
  defaultAllowedPresets,
  primaryScenarioPreset,
  validateSeasonModeConfig,
} from '../lib/seasonMixConfig';
import { loadPresetPreview } from '../hooks/usePresetPreview';
import { isTourDone, TOUR_IDS } from '../lib/onboarding';
import { buildSoloSprintTourSteps } from '../lib/soloSprintTour';
import { runOnboardingTour } from '../lib/runOnboardingTour';

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

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

export default function SeasonSprintBuilder() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const inRoom = Boolean(roomId);
  const { userId, userRole, tourRevision } = useOnboarding();
  const tourStartedRef = useRef(false);

  const [presets, setPresets] = useState([]);
  const [presetsReady, setPresetsReady] = useState(false);
  const [name, setName] = useState('');
  const [seasonMode, setSeasonMode] = useState('random_mix');
  const [totalRounds, setTotalRounds] = useState(5);
  const [contractUpdates, setContractUpdates] = useState(1);
  const [roundDuration, setRoundDuration] = useState(30);
  const [leadinDays, setLeadinDays] = useState(60);
  const [scenarioPreset, setScenarioPreset] = useState('steady');
  const [scenarioConfig, setScenarioConfig] = useState({});
  const [allowedPresets, setAllowedPresets] = useState([]);
  const [customRoundPresets, setCustomRoundPresets] = useState([]);
  const [costs, setCosts] = useState(DEFAULT_COSTS);
  const [startingInventory, setStartingInventory] = useState(100);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [roomBreadcrumbName, setRoomBreadcrumbName] = useState(null);

  const [cardModalPreset, setCardModalPreset] = useState(null);
  const [cardModalLoading, setCardModalLoading] = useState(false);
  const [cardModalError, setCardModalError] = useState(null);
  const [cardModalChart, setCardModalChart] = useState({
    chartData: [],
    boundary: null,
    roundBoundaries: [],
  });

  useEffect(() => {
    if (!roomId) {
      setRoomBreadcrumbName(null);
      return;
    }
    let cancelled = false;
    api
      .getRooms()
      .then((list) => {
        const found = list.find((r) => r.id === roomId);
        if (!cancelled) setRoomBreadcrumbName(found?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setRoomBreadcrumbName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useBreadcrumbLabels({ labels: roomBreadcrumbName ? { room: roomBreadcrumbName } : {} });

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listSeasonPresets();
        setPresets(Array.isArray(list) ? list : []);
        const first = list?.[0]?.id || 'steady';
        setScenarioPreset(first);
        setScenarioConfig(defaultConfigFor(first));
        setAllowedPresets(defaultAllowedPresets(list || []));
      } catch {
        setPresets([]);
      } finally {
        setPresetsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    setCustomRoundPresets((prev) => {
      const next = [...prev];
      while (next.length < Number(totalRounds)) next.push(scenarioPreset);
      return next.slice(0, Number(totalRounds));
    });
  }, [totalRounds, scenarioPreset]);

  useEffect(() => {
    tourStartedRef.current = false;
  }, [tourRevision]);

  useEffect(() => {
    if (!userId || !presetsReady) return;
    if (isTourDone(userId, TOUR_IDS.SOLO_SPRINT)) return;
    if (tourStartedRef.current) return;

    const steps = buildSoloSprintTourSteps();
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
        tourId: TOUR_IDS.SOLO_SPRINT,
        steps,
      });
    }

    const frameId = requestAnimationFrame(tryStartTour);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [userId, userRole, tourRevision, presetsReady]);

  const mixConfig = useMemo(
    () => buildMixConfig(seasonMode, allowedPresets, customRoundPresets),
    [seasonMode, allowedPresets, customRoundPresets],
  );

  const activePreset = useMemo(
    () => presets.find((p) => p.id === scenarioPreset) || null,
    [presets, scenarioPreset],
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

  const handlePresetSelect = (preset) => {
    if (seasonMode === 'random_mix') {
      setAllowedPresets((prev) => {
        const active = prev.includes(preset.id);
        if (active && prev.length <= 1) return prev;
        return active ? prev.filter((x) => x !== preset.id) : [...prev, preset.id];
      });
      return;
    }
    setScenarioPreset(preset.id);
    setScenarioConfig(defaultConfigFor(preset.id));
  };

  const handleCustomRoundPresetChange = (idx, value) => {
    setCustomRoundPresets((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a practice run name');
      return;
    }
    const modeError = validateSeasonModeConfig(
      seasonMode,
      scenarioPreset,
      allowedPresets,
      customRoundPresets,
      totalRounds,
    );
    if (modeError) {
      setError(modeError);
      return;
    }

    const basePreset = primaryScenarioPreset(
      seasonMode,
      scenarioPreset,
      allowedPresets,
      customRoundPresets,
    );

    const configPayload =
      seasonMode === 'single' && (PRESET_CONFIG_FIELDS[scenarioPreset] || []).length > 0
        ? scenarioConfig
        : defaultConfigFor(basePreset);

    setSubmitting(true);
    setError('');
    try {
      const res = await api.createSeason({
        room_id: inRoom ? roomId : null,
        season_scope: inRoom ? 'room' : 'sandbox',
        name: trimmedName,
        scenario_preset: basePreset,
        scenario_config: configPayload,
        season_mode: seasonMode,
        mix_config: mixConfig,
        total_rounds: Number(totalRounds),
        contract_updates_allowed: Number(contractUpdates),
        round_duration_days: Number(roundDuration),
        historical_leadin_days: Number(leadinDays),
        costs,
        starting_inventory: Number(startingInventory),
      });
      const backRoom = res.room_id || roomId;
      if (backRoom) {
        navigate(`/room/${backRoom}/season/${res.id}`);
      } else {
        navigate(`/season-sprint/${res.id}`);
      }
    } catch (e) {
      setError(e.message || 'Failed to create practice run');
    } finally {
      setSubmitting(false);
    }
  };

  const scenariosLink = inRoom ? `/scenarios?room=${roomId}` : '/scenarios';
  const rescuePct = (Number(costs.dual_source_rescue_pct ?? 1) * 100).toFixed(0);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Start a practice run</h1>
        <p className="text-sm text-slate-400">
          Play several months on your own, tune your policy between months, and practice before joining a class.
        </p>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <div data-tour="sprint-name">
          <FieldLabel label="Practice run name" help={SEASON_SPRINT_COPY.seasonName} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={SEASON_SPRINT_COPY.seasonNamePlaceholder}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">{SEASON_SPRINT_COPY.seasonNameHelper}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3" data-tour="sprint-basics">
          <div>
            <FieldLabel label="Months" help={SEASON_SPRINT_COPY.rounds} />
            <input
              type="number"
              min={1}
              max={20}
              value={totalRounds}
              onChange={(e) => setTotalRounds(e.target.value)}
              className={`${INPUT_CLASS} tabular-nums`}
            />
          </div>
          <div>
            <FieldLabel label="Policy reviews" help={SEASON_SPRINT_COPY.contractUpdates} />
            <input
              type="number"
              min={0}
              max={10}
              value={contractUpdates}
              onChange={(e) => setContractUpdates(e.target.value)}
              className={`${INPUT_CLASS} tabular-nums`}
            />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-amber-500">Dual sourcing</legend>
          <DualSourceFields
            costs={costs}
            onCostChange={updateCost}
            showToggle
            showSubFields={false}
            toggleLabel="Enable dual sourcing"
            inputClassName={INPUT_CLASS}
            dataTourAnchor="sprint-dual-source"
          />
          {costs.dual_source_enabled && (
            <p className="text-xs text-slate-500">
              Defaults: ${costs.dual_source_premium_per_unit}/unit premium, {rescuePct}% supplier
              rescue. Change these in Advanced users.
            </p>
          )}
        </fieldset>

        <SeasonModeConfigurator
          presets={presets}
          seasonMode={seasonMode}
          onSeasonModeChange={setSeasonMode}
          scenarioPreset={scenarioPreset}
          allowedPresets={allowedPresets}
          customRoundPresets={customRoundPresets}
          onCustomRoundPresetChange={handleCustomRoundPresetChange}
          totalRounds={totalRounds}
          onPresetSelect={handlePresetSelect}
          onPreview={openCardPreview}
          scenariosLink={scenariosLink}
          inputClassName={INPUT_CLASS}
          dataTourAnchor="sprint-scenario"
        />

        <SeasonAdvancedSettings
          costs={costs}
          onCostChange={updateCost}
          roundDuration={roundDuration}
          onRoundDurationChange={setRoundDuration}
          leadinDays={leadinDays}
          onLeadinDaysChange={setLeadinDays}
          startingInventory={startingInventory}
          onStartingInventoryChange={setStartingInventory}
          showDualSourceToggle={false}
          showDualSourceSubFields={Boolean(costs.dual_source_enabled)}
          inputClassName={INPUT_CLASS}
          dataTourAnchor="sprint-advanced"
          presetTuning={
            seasonMode === 'single' && activePreset
              ? {
                  seasonMode,
                  presetId: scenarioPreset,
                  presetName: activePreset.name,
                  scenarioConfig,
                  onScenarioFieldChange: updateScenarioField,
                }
              : null
          }
        />

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            data-tour="sprint-create"
            className="rounded-lg bg-amber-500 px-4 py-2 text-slate-900 font-semibold hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Start practice run'}
          </button>
          <Link
            to={inRoom ? `/room/${roomId}` : '/dashboard'}
            className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700"
          >
            Cancel
          </Link>
        </div>
      </div>

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
    </div>
  );
}
