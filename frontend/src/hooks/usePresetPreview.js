import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import {
  buildPreviewRequest,
  previewCacheKey,
  SLICE4_PREVIEW_DEFAULTS,
  transformPreviewResponse,
} from '../lib/presetPreview';

/** @type {Map<string, { chartData: object[], boundary: number, roundBoundaries: number[], sparklineData: object[] }>} */
const cache = new Map();

/** @type {Map<string, Promise<{ chartData: object[], boundary: number, roundBoundaries: number[], sparklineData: object[] }>>} */
const inflight = new Map();

async function fetchPreview(presetId, overrides = {}) {
  const key = previewCacheKey(presetId, overrides);
  if (cache.has(key)) return cache.get(key);

  if (inflight.has(key)) return inflight.get(key);

  const promise = api
    .previewSeason(buildPreviewRequest(presetId, overrides))
    .then((res) => {
      const data = transformPreviewResponse(res);
      cache.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

const EMPTY = {
  loading: false,
  error: null,
  chartData: [],
  boundary: null,
  roundBoundaries: [],
  sparklineData: [],
};

/**
 * Hook for per-preset card previews (fixed slice-4 defaults).
 * @param {string | null} presetId
 * @param {{ autoFetch?: boolean, overrides?: object }} [options]
 */
export function usePresetPreview(presetId, { autoFetch = true, overrides } = {}) {
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!presetId) {
      setState(EMPTY);
      return null;
    }
    const key = previewCacheKey(presetId, overrides);
    const cached = cache.get(key);
    if (cached) {
      setState({ loading: false, error: null, ...cached });
      return cached;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchPreview(presetId, overrides);
      setState({ loading: false, error: null, ...data });
      return data;
    } catch (err) {
      const message = err.message || 'Could not generate preview';
      setState({ ...EMPTY, error: message });
      return null;
    }
  }, [presetId, overrides]);

  useEffect(() => {
    if (autoFetch && presetId) load();
  }, [autoFetch, presetId, load]);

  return { ...state, reload: load };
}

/** Prefetch a preset preview into the module cache (for card grids). */
export function prefetchPresetPreview(presetId, overrides) {
  if (!presetId) return Promise.resolve(null);
  return fetchPreview(presetId, overrides).catch(() => null);
}

/** Load preview with optional custom overrides (e.g. SeasonCreator form values). */
export async function loadPresetPreview(presetId, overrides = {}) {
  return fetchPreview(presetId, overrides);
}

export { SLICE4_PREVIEW_DEFAULTS };
