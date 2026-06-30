import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ScenarioPresetCard from '../components/ScenarioPresetCard';
import PresetPreviewModal from '../components/PresetPreviewModal';
import { loadPresetPreview, SLICE4_PREVIEW_DEFAULTS } from '../hooks/usePresetPreview';

const MODAL_SUBTITLE = `Sample preview: ${SLICE4_PREVIEW_DEFAULTS.total_rounds} rounds × ${SLICE4_PREVIEW_DEFAULTS.round_duration_days} days with ${SLICE4_PREVIEW_DEFAULTS.historical_leadin_days}-day historical lead-in. Amber = history students see; sky = full season demand.`;

export default function ScenarioLibrary() {
  const [searchParams] = useSearchParams();
  const fromRoomId = searchParams.get('room');

  const [presets, setPresets] = useState([]);
  const [presetsError, setPresetsError] = useState(null);
  const [modalPreset, setModalPreset] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalChart, setModalChart] = useState({
    chartData: [],
    boundary: null,
    roundBoundaries: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listSeasonPresets();
        if (!cancelled) setPresets(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!cancelled) setPresetsError(err.message || 'Could not load presets');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPreview = async (preset) => {
    setModalPreset(preset);
    setModalError(null);
    setModalLoading(true);
    try {
      const data = await loadPresetPreview(preset.id);
      if (data) {
        setModalChart({
          chartData: data.chartData,
          boundary: data.boundary,
          roundBoundaries: data.roundBoundaries,
        });
      }
    } catch (err) {
      setModalError(err.message || 'Could not generate preview');
    } finally {
      setModalLoading(false);
    }
  };

  const closePreview = () => {
    setModalPreset(null);
    setModalError(null);
    setModalChart({ chartData: [], boundary: null, roundBoundaries: [] });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Scenario library</h1>
        <p className="mt-1 text-sm text-slate-400">
          Compare demand patterns before you build a season. Each card shows a sample timeline —
          click <strong className="text-slate-300">Full preview</strong> for the detailed chart.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/dashboard" className="text-amber-500 hover:text-amber-400">
            ← Dashboard
          </Link>
          {fromRoomId && (
            <Link
              to={`/room/${fromRoomId}/create-season`}
              className="text-amber-500 hover:text-amber-400"
            >
              ← Back to season creator
            </Link>
          )}
          <Link to="/season-sprint/new" className="text-amber-500 hover:text-amber-400">
            Solo practice season
          </Link>
        </div>
      </div>

      {presetsError && <p className="text-sm text-red-400">{presetsError}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => (
          <ScenarioPresetCard
            key={preset.id}
            preset={preset}
            selectionMode="none"
            onPreview={openPreview}
          />
        ))}
      </div>

      <PresetPreviewModal
        open={Boolean(modalPreset)}
        onClose={closePreview}
        title={modalPreset ? `${modalPreset.name} — demand preview` : ''}
        subtitle={MODAL_SUBTITLE}
        chartData={modalChart.chartData}
        boundary={modalChart.boundary}
        roundBoundaries={modalChart.roundBoundaries}
        loading={modalLoading}
        error={modalError}
      />
    </div>
  );
}
