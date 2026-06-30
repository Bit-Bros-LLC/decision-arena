/* eslint-disable react-refresh/only-export-components -- hooks + provider share one module */
import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';

/** @typedef {{ label: string, to: string }} AfterDashboardCrumb */

const defaultSnapshot = () => ({
  /** @type {Record<string, string>} */
  labels: {},
  /** @type {AfterDashboardCrumb[]} */
  afterDashboard: [],
});

export const BreadcrumbLabelsContext = createContext(null);

export function useBreadcrumbSnapshot() {
  const ctx = useContext(BreadcrumbLabelsContext);
  return ctx?.snapshot ?? { labels: {}, afterDashboard: [] };
}

export function BreadcrumbLabelsProvider({ children }) {
  const [snapshot, setSnapshot] = useState(defaultSnapshot);

  const reset = useCallback(() => {
    setSnapshot(defaultSnapshot());
  }, []);

  const value = useMemo(() => ({ snapshot, setSnapshot, reset }), [snapshot, reset]);

  return (
    <BreadcrumbLabelsContext.Provider value={value}>{children}</BreadcrumbLabelsContext.Provider>
  );
}

/**
 * Publish breadcrumb label overrides and optional crumbs after Dashboard.
 * Clears on unmount so labels do not leak across navigations.
 *
 * @param {{ labels?: Record<string, string>, afterDashboard?: AfterDashboardCrumb[] }} [config]
 */
export function useBreadcrumbLabels(config) {
  const ctx = useContext(BreadcrumbLabelsContext);
  const setSnapshot = ctx?.setSnapshot;
  const reset = ctx?.reset;
  const labelsJson = JSON.stringify(config?.labels ?? {});
  const afterJson = JSON.stringify(config?.afterDashboard ?? []);

  useEffect(() => {
    if (!setSnapshot || !reset) return;
    setSnapshot({
      labels: JSON.parse(labelsJson),
      afterDashboard: JSON.parse(afterJson),
    });
    return () => {
      reset();
    };
  }, [setSnapshot, reset, labelsJson, afterJson]);
}
