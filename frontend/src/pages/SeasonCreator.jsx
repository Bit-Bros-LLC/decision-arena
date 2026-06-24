import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, getUser } from '../api';
import { FieldLabel } from '../components/FieldLabel';
import ScenarioPresetCard from '../components/ScenarioPresetCard';
import PresetPreviewModal from '../components/PresetPreviewModal';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { useOnboarding } from '../context/OnboardingContext';
import { COST_TOOLTIPS } from '../lib/costTooltips';
import { isTourDone, TOUR_IDS } from '../lib/onboarding';
import { buildProfessorSeasonTourSteps } from '../lib/professorSeasonTour';
import { SEASON_CREATOR_COPY } from '../lib/seasonCreatorCopy';
import {
  defaultConfigFor,
  PRESET_CONFIG_FIELDS,
  transformPreviewResponse,
} from '../lib/presetPreview';
import { loadPresetPreview } from '../hooks/usePresetPreview';
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
  const user = getUser();
  const isProfessor = user?.role === 'professor';
  const { markChecklistItem, userId, userRole, tourRevision } = useOnboarding();
  const tourStartedRef = useRef(false);

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
    tourStartedRef.current = false;
  }, [roomId, tourRevision]);

  useEffect(() => {
    if (!userId || !isProfessor || !presetsReady) return;
    if (isTourDone(userId, TOUR_IDS.PROFESSOR_SEASON)) return;
    if (tourStartedRef.current) return;

    const steps = buildProfessorSeasonTourSteps();

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
        tourId: TOUR_IDS.PROFESSOR_SEASON,
        steps,
      });
    }

    const frameId = requestAnimationFrame(tryStartTour);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [userId, userRole, tourRevision, roomId, isProfessor, presetsReady]);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId],
  );

  const configFields = PRESET_CONFIG_FIELDS[activePresetId] || [];

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
    setActivePresetId(preset.id);
    setScenarioConfig(defaultConfigFor(preset.id));
    setChartError(null);
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
    if (!activePresetId) {
      setChartError('Pick a scenario preset first.');
      return;
    }
    const rounds = Number(totalRounds);
    const duration = Number(roundDuration);
    const leadin = Number(leadinDays);
    if (!Number.isFinite(rounds) || rounds < 1) {
      setChartError('Total rounds must be at least 1.');
      return;
    }
    if (!Number.isFinite(duration) || duration < 1) {
      setChartError('Round duration must be at least 1 day.');
      return;
    }
    if (!Number.isFinite(leadin) || leadin < 0) {
      setChartError('Historical lead-in must be 0 or more days.');
      return;
    }
    setChartLoading(true);
    try {
      const res = await api.previewSeason({
        scenario_preset: activePresetId,
        scenario_config: scenarioConfig,
        total_rounds: rounds,
        round_duration_days: duration,
        historical_leadin_days: leadin,
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
      setSubmitError('Please enter a season name');
      return;
    }
    if (!activePresetId) {
      setSubmitError('Pick a scenario preset first.');
      return;
    }
    if (!firstDeadline) {
      setSubmitError('Set a first-round deadline.');
      return;
    }
    const deadlineIso = firstDeadline.length === 16 ? `${firstDeadline}:00` : firstDeadline;
    setSubmitting(true);
    try {
      const res = await api.createSeason({
        room_id: roomId,
        name: trimmedName,
        scenario_preset: activePresetId,
        scenario_config: scenarioConfig,
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
      setSubmitError(err.message || 'Failed to create season');
    } finally {
      setSubmitting(false);
    }
  };

  const formChartSubtitle = `Historical lead-in (amber) students will see on day one, then the full season timeline (sky) across ${totalRounds} rounds of ${roundDuration} days. Solid vertical line marks where round 1 begins; faint lines mark subsequent round boundaries.`;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Create season</h1>
        <p className="mt-1 text-sm text-slate-400">
          Configure rules, costs, and demand scenario for your class. Students play each round before
          you score and advance.
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Room: <span className="text-slate-200">{roomLabel ?? '…'}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
      >
        <div>
          <FieldLabel label="Season name" help={SEASON_CREATOR_COPY.seasonName} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={SEASON_CREATOR_COPY.seasonNamePlaceholder}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <p className="mt-1 text-xs text-slate-500">{SEASON_CREATOR_COPY.seasonNameHelper}</p>
        </div>

        <fieldset className="space-y-4" data-tour="season-rules">
          <legend className="text-lg font-medium text-amber-500">Season rules</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel label="Total rounds" help={SEASON_CREATOR_COPY.totalRounds} />
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
                label="Contract updates per student"
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
            <div>
              <FieldLabel label="Round duration (days)" help={SEASON_CREATOR_COPY.roundDuration} />
              <input
                type="number"
                min={1}
                max={90}
                value={roundDuration}
                onChange={(e) => setRoundDuration(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel
                label="Historical lead-in (days)"
                help={SEASON_CREATOR_COPY.historicalLeadin}
              />
              <input
                type="number"
                min={0}
                max={365}
                value={leadinDays}
                onChange={(e) => setLeadinDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <FieldLabel label="Starting inventory" help={SEASON_CREATOR_COPY.startingInventory} />
              <input
                type="number"
                min={0}
                value={startingInventory}
                onChange={(e) => setStartingInventory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div data-tour="season-deadline">
              <FieldLabel
                label="First round deadline"
                help={SEASON_CREATOR_COPY.firstRoundDeadline}
              />
              <input
                type="datetime-local"
                value={firstDeadline}
                onChange={(e) => setFirstDeadline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 [color-scheme:dark]"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Subsequent rounds auto-schedule {roundDuration} days apart. You advance each round
            manually from the season dashboard.
          </p>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-amber-500">Cost parameters</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['holding_per_unit', 'Holding / unit'],
              ['stockout_penalty', 'Stockout penalty'],
              ['ordering_fixed', 'Ordering (fixed)'],
              ['per_unit_cost', 'Per-unit cost'],
              ['selling_price', 'Selling price'],
            ].map(([key, label, tooltipKey]) => (
              <div key={key}>
                <FieldLabel
                  label={label}
                  help={COST_TOOLTIPS[tooltipKey || label]}
                />
                <input
                  type="number"
                  step="1"
                  value={costs[key]}
                  onChange={(e) => updateCost(key, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-medium text-amber-500">Dual sourcing</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(costs.dual_source_enabled)}
              onChange={(e) => updateCost('dual_source_enabled', e.target.checked)}
              className="rounded border-slate-600 accent-amber-500"
            />
            <FieldLabel
              label="Enable dual sourcing for students"
              help={COST_TOOLTIPS['Dual sourcing enabled']}
            />
          </label>
          {costs.dual_source_enabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel
                  label="Dual-source premium / unit"
                  help={COST_TOOLTIPS['Dual-source premium / unit']}
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={costs.dual_source_premium_per_unit}
                  onChange={(e) => updateCost('dual_source_premium_per_unit', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <FieldLabel
                  label="Supplier rescue % (0.5–1)"
                  help={COST_TOOLTIPS['Supplier rescue %']}
                />
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="1"
                  value={costs.dual_source_rescue_pct}
                  onChange={(e) => updateCost('dual_source_rescue_pct', e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 tabular-nums text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4" data-tour="season-scenario">
          <legend className="text-lg font-medium text-amber-500">Season scenario</legend>
          <FieldLabel label="Demand scenario" help={SEASON_CREATOR_COPY.seasonScenario} />
          <p className="text-xs text-slate-500">
            Patterns apply across the <strong>entire season</strong>. E.g. "Regime Change" plants
            1-2 shifts somewhere in {totalRounds * roundDuration} days — not in every round.
          </p>
          <p className="text-xs">
            <Link
              to={`/scenarios?room=${roomId}`}
              className="text-amber-500 hover:text-amber-400"
            >
              Browse all scenarios
            </Link>
          </p>
          {presetsError && <p className="text-sm text-red-400">{presetsError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((preset) => (
              <ScenarioPresetCard
                key={preset.id}
                preset={preset}
                selected={activePresetId === preset.id}
                selectionMode="single"
                onSelect={pickPreset}
                onPreview={openCardPreview}
              />
            ))}
          </div>
        </fieldset>

        {activePreset && configFields.length > 0 && (
          <fieldset className="space-y-4">
            <legend className="text-lg font-medium text-amber-500">
              {activePreset.name} · tuning
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {configFields.map((f) => (
                <div key={f.key}>
                  <label className="flex items-center justify-between gap-2 text-sm text-slate-300">
                    <span>{f.label}</span>
                    <span className="font-mono text-amber-400">
                      {scenarioConfig[f.key] ?? f.default}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={scenarioConfig[f.key] ?? f.default}
                    onChange={(e) => updateScenarioField(f.key, e.target.value)}
                    className="mt-2 w-full accent-amber-500"
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <FieldLabel
            label="Preview demand chart"
            help={SEASON_CREATOR_COPY.previewDemand}
          />
          <button
            type="button"
            onClick={openDemandChartPreview}
            disabled={chartLoading || !activePresetId}
            className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-amber-500 hover:bg-slate-700 disabled:opacity-50"
          >
            {chartLoading ? 'Generating…' : 'Preview demand chart'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Preview with your current season settings (rounds, lead-in, and tuning sliders).
          </p>
          {chartError && <p className="mt-2 text-sm text-red-400">{chartError}</p>}
        </div>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            data-tour="season-create"
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create season'}
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
        subtitle="Sample: 3 rounds × 30 days with 60-day historical lead-in (default preset tuning)."
        chartData={cardModalChart.chartData}
        boundary={cardModalChart.boundary}
        roundBoundaries={cardModalChart.roundBoundaries}
        loading={cardModalLoading}
        error={cardModalError}
      />

      <PresetPreviewModal
        open={formChartOpen && previewBoundary != null}
        onClose={() => setFormChartOpen(false)}
        title="Season demand preview"
        subtitle={formChartSubtitle}
        chartData={previewChartData}
        boundary={previewBoundary}
        roundBoundaries={previewRoundBoundaries}
      />
    </div>
  );
}
