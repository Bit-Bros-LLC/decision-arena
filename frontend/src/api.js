const BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('da_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('da_token');
    localStorage.removeItem('da_user');
    window.location.href = '/login';
    return;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  getRooms: () => request('/rooms'),
  createRoom: (name) => request('/rooms', { method: 'POST', body: JSON.stringify({ name }) }),
  joinRoom: (roomId, invite_code) => request(`/rooms/${roomId}/join`, { method: 'POST', body: JSON.stringify({ invite_code }) }),

  getRound: (roundId) => request(`/rounds/${roundId}`),
  getRoomRounds: (roomId) => request(`/rounds/room/${roomId}`),
  createRound: (body) => request('/rounds', { method: 'POST', body: JSON.stringify(body) }),
  scoreRound: (roundId) => request(`/rounds/${roundId}/score`, { method: 'POST' }),
  activateRound: (roundId) => request(`/rounds/${roundId}/activate`, { method: 'POST' }),
  deleteRound: (roundId) => request(`/rounds/${roundId}`, { method: 'DELETE' }),

  savePolicy: (body) => request('/policies', { method: 'PUT', body: JSON.stringify(body) }),
  getMyPolicy: (roundId) => request(`/policies/${roundId}`),
  backtest: (body) => request('/policies/backtest', { method: 'POST', body: JSON.stringify(body) }),

  getMyResults: (roundId) => request(`/results/${roundId}`),
  getRoundLeaderboard: (roundId) => request(`/leaderboard/${roundId}`),
  getSeasonLeaderboard: (roomId) => request(`/leaderboard/season/${roomId}`),
};

export function setAuth(data) {
  localStorage.setItem('da_token', data.access_token);
  localStorage.setItem('da_user', JSON.stringify({
    user_id: data.user_id, display_name: data.display_name, role: data.role,
  }));
}

export function getUser() {
  const raw = localStorage.getItem('da_user');
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem('da_token');
  localStorage.removeItem('da_user');
  window.location.href = '/login';
}
