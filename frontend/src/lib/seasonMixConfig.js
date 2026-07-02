/** Build mix_config payload for create/preview season APIs. */
export function buildMixConfig(seasonMode, allowedPresets, customRoundPresets) {
  if (seasonMode === 'random_mix') {
    return { allowed_presets: allowedPresets };
  }
  if (seasonMode === 'custom_mix') {
    return { round_presets: customRoundPresets };
  }
  return {};
}

export function defaultAllowedPresets(presets) {
  return (presets || []).map((p) => p.id);
}

/** Primary preset id used as scenario_preset base when mode is not single. */
export function primaryScenarioPreset(seasonMode, scenarioPreset, allowedPresets, customRoundPresets) {
  if (seasonMode === 'random_mix') {
    return allowedPresets[0] || scenarioPreset || 'steady';
  }
  if (seasonMode === 'custom_mix') {
    return customRoundPresets[0] || scenarioPreset || 'steady';
  }
  return scenarioPreset || 'steady';
}

export function validateSeasonModeConfig(seasonMode, scenarioPreset, allowedPresets, customRoundPresets, totalRounds) {
  if (seasonMode === 'single') {
    if (!scenarioPreset) return 'Pick a demand pattern first.';
    return null;
  }
  if (seasonMode === 'random_mix') {
    if (!allowedPresets.length) return 'Select at least one pattern for the random mix.';
    return null;
  }
  if (seasonMode === 'custom_mix') {
    const rounds = Number(totalRounds);
    if (!Number.isFinite(rounds) || rounds < 1) return 'Total months must be at least 1.';
    if (customRoundPresets.length !== rounds) return 'Assign a demand pattern to every month.';
    return null;
  }
  return null;
}
