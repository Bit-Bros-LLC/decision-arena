import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { FieldLabel } from '../components/FieldLabel';
import { UITooltip } from '../components/UITooltip';
import { useBreadcrumbLabels } from '../context/BreadcrumbLabelsContext';
import { SEASON_SPRINT_COPY } from '../lib/seasonSprintCopy';

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

function defaultAllowed(presets) {
  return presets.map((p) => p.id);
}

export default function SeasonSprintBuilder() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const inRoom = Boolean(roomId);
  const [presets, setPresets] = useState([]);
  const [name, setName] = useState('');
  const [seasonMode, setSeasonMode] = useState('random_mix');
  const [totalRounds, setTotalRounds] = useState(5);
  const [contractUpdates, setContractUpdates] = useState(1);
  const [roundDuration] = useState(30);
  const [leadinDays] = useState(60);
  const [scenarioPreset, setScenarioPreset] = useState('steady');
  const [allowedPresets, setAllowedPresets] = useState([]);
  const [customRoundPresets, setCustomRoundPresets] = useState([]);
  const [costs] = useState(DEFAULT_COSTS);
  const [startingInventory] = useState(100);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [roomBreadcrumbName, setRoomBreadcrumbName] = useState(null);

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
      const list = await api.listSeasonPresets();
      setPresets(Array.isArray(list) ? list : []);
      const first = list?.[0]?.id || 'steady';
      setScenarioPreset(first);
      setAllowedPresets(defaultAllowed(list || []));
    })().catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    setCustomRoundPresets((prev) => {
      const next = [...prev];
      while (next.length < Number(totalRounds)) next.push(scenarioPreset);
      return next.slice(0, Number(totalRounds));
    });
  }, [totalRounds, scenarioPreset]);

  const mixConfig = useMemo(() => {
    if (seasonMode === 'random_mix') {
      return { allowed_presets: allowedPresets };
    }
    if (seasonMode === 'custom_mix') {
      return { round_presets: customRoundPresets };
    }
    return {};
  }, [seasonMode, allowedPresets, customRoundPresets]);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a season name');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await api.createSeason({
        room_id: inRoom ? roomId : null,
        season_scope: inRoom ? 'room' : 'sandbox',
        name: trimmedName,
        scenario_preset: scenarioPreset,
        scenario_config: {},
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
      setError(e.message || 'Failed to create season');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Create solo practice season</h1>
        <p className="text-sm text-slate-400">
          Play several rounds on your own, tune your policy between rounds, and practice before joining a class.
        </p>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <div>
          <FieldLabel label="Season name" help={SEASON_SPRINT_COPY.seasonName} />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={SEASON_SPRINT_COPY.seasonNamePlaceholder}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">{SEASON_SPRINT_COPY.seasonNameHelper}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel label="Mode" help={SEASON_SPRINT_COPY.mode[seasonMode]} />
            <select
              value={seasonMode}
              onChange={(e) => setSeasonMode(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="random_mix">Random mix</option>
              <option value="custom_mix">Custom mix</option>
              <option value="single">Single type</option>
            </select>
          </div>
          <div>
            <FieldLabel label="Base preset" help={SEASON_SPRINT_COPY.basePreset} />
            <select
              value={scenarioPreset}
              onChange={(e) => setScenarioPreset(e.target.value)}
              className={INPUT_CLASS}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel label="Rounds" help={SEASON_SPRINT_COPY.rounds} />
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
            <FieldLabel label="Contract updates" help={SEASON_SPRINT_COPY.contractUpdates} />
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

        {seasonMode === 'random_mix' && (
          <div>
            <FieldLabel label="Allowed demand patterns" help={SEASON_SPRINT_COPY.allowedTypes} />
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => {
                const active = allowedPresets.includes(p.id);
                return (
                  <UITooltip key={p.id} content={p.description} placement="top">
                    <button
                      type="button"
                      onClick={() =>
                        setAllowedPresets((prev) =>
                          active ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                      className={`rounded px-3 py-1 text-sm ${
                        active
                          ? 'bg-amber-500 text-slate-900'
                          : 'border border-slate-600 text-slate-300'
                      }`}
                    >
                      {p.name}
                    </button>
                  </UITooltip>
                );
              })}
            </div>
          </div>
        )}

        {seasonMode === 'custom_mix' && (
          <div className="space-y-2">
            <FieldLabel label="Round-by-round patterns" help={SEASON_SPRINT_COPY.roundByRound} />
            {customRoundPresets.map((value, idx) => (
              <label key={idx} className="text-sm flex items-center gap-3">
                <span className="w-20 text-slate-400">Round {idx + 1}</span>
                <select
                  value={value}
                  onChange={(e) =>
                    setCustomRoundPresets((prev) =>
                      prev.map((v, i) => (i === idx ? e.target.value : v))
                    )
                  }
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-amber-500 px-4 py-2 text-slate-900 font-semibold hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Start season'}
          </button>
          <Link
            to={inRoom ? `/room/${roomId}` : '/dashboard'}
            className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 hover:bg-slate-700"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
