import { getAccessToken, getUser, logout, updateCachedUser } from './auth';

const BASE = import.meta.env.VITE_API_URL || '';

function parseDetail(data, fallback) {
  const d = data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || x).join(', ') || fallback;
  return fallback;
}

async function request(path, options = {}) {
  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (res.status === 401) {
    await logout();
    return;
  }

  if (!res.ok) {
    const err = new Error(parseDetail(data, `Request failed (${res.status})`));
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  updateProfile: (body) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  getOnboardingStatus: () => request('/users/me/onboarding-status'),

  getRooms: () => request('/rooms'),
  createRoom: (name) => request('/rooms', { method: 'POST', body: JSON.stringify({ name }) }),
  joinRoom: (roomId, invite_code) =>
    roomId
      ? request(`/rooms/${roomId}/join`, { method: 'POST', body: JSON.stringify({ invite_code }) })
      : request('/rooms/join', { method: 'POST', body: JSON.stringify({ invite_code }) }),
  completeRoom: (roomId) => request(`/rooms/${roomId}/complete`, { method: 'POST' }),

  getRound: (roundId) => request(`/rounds/${roundId}`),
  getRoomRounds: (roomId) => request(`/rounds/room/${roomId}`),
  createRound: (body) => request('/rounds', { method: 'POST', body: JSON.stringify(body) }),
  updateRound: (roundId, body) => request(`/rounds/${roundId}`, { method: 'PUT', body: JSON.stringify(body) }),
  scoreRound: (roundId) => request(`/rounds/${roundId}/score`, { method: 'POST' }),
  activateRound: (roundId) => request(`/rounds/${roundId}/activate`, { method: 'POST' }),
  deleteRound: (roundId) => request(`/rounds/${roundId}`, { method: 'DELETE' }),

  savePolicy: (body) => request('/policies', { method: 'PUT', body: JSON.stringify(body) }),
  getMyPolicy: (roundId) => request(`/policies/${roundId}`),
  undoPolicySubmit: (roundId) => request(`/policies/${roundId}`, { method: 'DELETE' }),
  listPolicyPresets: () => request('/policy-presets'),
  savePolicyPreset: (body) =>
    request('/policy-presets', { method: 'POST', body: JSON.stringify(body) }),
  deletePolicyPreset: (presetId) => request(`/policy-presets/${presetId}`, { method: 'DELETE' }),
  backtest: (body) => request('/policies/backtest', { method: 'POST', body: JSON.stringify(body) }),

  getMyResults: (roundId) => request(`/results/${roundId}`),
  getRoundLeaderboard: (roundId) => request(`/leaderboard/${roundId}`),
  getSeasonLeaderboard: (seasonId) => request(`/leaderboard/season/${seasonId}`),
  getTemplateCohortLeaderboard: (roomId, templateId) =>
    request(`/leaderboard/room/${roomId}/template/${templateId}/cohort`),

  listSeasonPresets: () => request('/seasons/presets'),
  listStoryPackages: () => request('/seasons/story-packages'),
  previewStoryPackage: (storyId) => request(`/seasons/story-packages/${storyId}/preview`),
  previewSeason: (body) => request('/seasons/preview', { method: 'POST', body: JSON.stringify(body) }),
  listRoomSeasons: (roomId) => request(`/seasons/room/${roomId}`),
  listSandboxSeasons: () => request('/seasons/sandbox'),
  listMySoloSeasons: () => request('/seasons/my-solo'),
  getSeason: (seasonId) => request(`/seasons/${seasonId}`),
  createSeason: (body) => request('/seasons', { method: 'POST', body: JSON.stringify(body) }),
  activateSeason: (seasonId) => request(`/seasons/${seasonId}/activate`, { method: 'POST' }),
  advanceSeason: (seasonId) => request(`/seasons/${seasonId}/advance`, { method: 'POST' }),
  undoLatestSeasonAdvance: (seasonId) =>
    request(`/seasons/${seasonId}/undo-latest-advance`, { method: 'POST' }),
  getSeasonState: (seasonId) => request(`/seasons/${seasonId}/my-state`),
  unlockContractChange: (seasonId, roundId) =>
    request(`/seasons/${seasonId}/rounds/${roundId}/unlock`, { method: 'POST' }),
  listRoomSoloTemplates: (roomId) => request(`/seasons/room/${roomId}/solo-templates`),
  createRoomSoloTemplate: (roomId, body) =>
    request(`/seasons/room/${roomId}/solo-templates`, { method: 'POST', body: JSON.stringify(body) }),
  instantiateRoomSoloTemplate: (roomId, templateId) =>
    request(`/seasons/room/${roomId}/solo-templates/${templateId}/instantiate`, { method: 'POST' }),

  getLessonProgress: () => request('/lessons/progress'),
  completeLesson: (slug) => request(`/lessons/${slug}/complete`, { method: 'POST' }),
  resetLesson: (slug) => request(`/lessons/${slug}/reset`, { method: 'POST' }),
};

export { getUser, logout, updateCachedUser };
