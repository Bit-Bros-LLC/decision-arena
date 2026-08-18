const DISCOVERY_CACHE_KEY = 'da_oidc_discovery';
const PKCE_VERIFIER_KEY = 'da_oidc_pkce_verifier';
const PKCE_STATE_KEY = 'da_oidc_state';
const SESSION_TOKEN_KEY = 'da_session_access_token';
const SESSION_ID_TOKEN_KEY = 'da_session_id_token';
const SESSION_USER_KEY = 'da_session_user';
const SESSION_EXPIRES_AT_KEY = 'da_session_expires_at';

function requiredEnv(name) {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required frontend auth config: ${name}`);
  }
  return value;
}

function getIssuer() {
  return requiredEnv('VITE_ZITADEL_ISSUER').replace(/\/+$/, '');
}

function getClientId() {
  return requiredEnv('VITE_ZITADEL_CLIENT_ID');
}

function getRedirectUri() {
  return requiredEnv('VITE_ZITADEL_REDIRECT_URI');
}

function getPostLogoutRedirectUri() {
  return requiredEnv('VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI');
}

function getScope() {
  return import.meta.env.VITE_ZITADEL_SCOPE || 'openid profile email';
}

function getAudience() {
  return import.meta.env.VITE_ZITADEL_AUDIENCE || '';
}

function parseJwt(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

function randomString(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createPkceChallenge(verifier) {
  const digest = await sha256(verifier);
  return base64UrlEncode(digest);
}

async function loadDiscoveryDocument() {
  const cached = sessionStorage.getItem(DISCOVERY_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const discoveryUrl =
    import.meta.env.VITE_ZITADEL_DISCOVERY_URL ||
    `${getIssuer()}/.well-known/openid-configuration`;
  const res = await fetch(discoveryUrl);
  if (!res.ok) {
    throw new Error('Unable to load ZITADEL discovery document');
  }
  const data = await res.json();
  sessionStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify(data));
  return data;
}

function buildUserSnapshot(tokenPayload) {
  const roleClaim = import.meta.env.VITE_ZITADEL_ROLES_CLAIM || 'role';
  const roleValue = tokenPayload?.[roleClaim];
  const roles = Array.isArray(roleValue)
    ? roleValue.filter((value) => typeof value === 'string')
    : typeof roleValue === 'string'
      ? [roleValue]
      : [];

  return {
    user_id: tokenPayload.sub || tokenPayload.email || 'unknown',
    display_name:
      tokenPayload.name ||
      tokenPayload.preferred_username ||
      tokenPayload.email ||
      'Decision Arena User',
    role: roles.includes('professor') ? 'professor' : 'student',
    email: tokenPayload.email || null,
    roles,
  };
}

function setSession({ accessToken, idToken, expiresIn }) {
  const tokenPayload = parseJwt(idToken || accessToken);
  const user = buildUserSnapshot(tokenPayload);
  const expiresAt = Date.now() + Number(expiresIn || 3600) * 1000;

  sessionStorage.setItem(SESSION_TOKEN_KEY, accessToken);
  if (idToken) {
    sessionStorage.setItem(SESSION_ID_TOKEN_KEY, idToken);
  } else {
    sessionStorage.removeItem(SESSION_ID_TOKEN_KEY);
  }
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
}

export function getAccessToken() {
  const expiresAt = Number(sessionStorage.getItem(SESSION_EXPIRES_AT_KEY) || '0');
  if (!expiresAt || Date.now() >= expiresAt) {
    clearSession();
    return null;
  }
  return sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function getUser() {
  const raw = sessionStorage.getItem(SESSION_USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function updateCachedUser(updates) {
  const current = getUser();
  if (!current) return;
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify({ ...current, ...updates }));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_ID_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_EXPIRES_AT_KEY);
}

export async function beginLogin() {
  const discovery = await loadDiscoveryDocument();
  const verifier = randomString(48);
  const state = randomString(24);
  const challenge = await createPkceChallenge(verifier);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(PKCE_STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: getScope(),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  const audience = getAudience();
  if (audience) {
    params.set('audience', audience);
  }

  window.location.assign(`${discovery.authorization_endpoint}?${params.toString()}`);
}

export async function completeLogin(search) {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    throw new Error(errorDescription || error);
  }

  const expectedState = sessionStorage.getItem(PKCE_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
    throw new Error('Invalid authentication callback state');
  }

  const discovery = await loadDiscoveryDocument();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  const audience = getAudience();
  if (audience) {
    body.set('audience', audience);
  }

  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error('Unable to exchange authorization code for tokens');
  }

  const data = await res.json();
  setSession({
    accessToken: data.access_token,
    idToken: data.id_token,
    expiresIn: data.expires_in,
  });

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
}

export async function logout() {
  const discovery = await loadDiscoveryDocument();
  const idToken = sessionStorage.getItem(SESSION_ID_TOKEN_KEY);
  clearSession();

  const endSessionEndpoint = discovery.end_session_endpoint;
  if (!endSessionEndpoint) {
    window.location.assign('/login');
    return;
  }

  const params = new URLSearchParams({
    post_logout_redirect_uri: getPostLogoutRedirectUri(),
  });
  if (idToken) {
    params.set('id_token_hint', idToken);
  }
  window.location.assign(`${endSessionEndpoint}?${params.toString()}`);
}
