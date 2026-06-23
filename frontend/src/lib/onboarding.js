/** @typedef {'completed' | 'skipped'} TourStatus */

export const TOUR_IDS = {
  STUDENT_DASHBOARD: 'student-dashboard',
  POLICY_EDITOR: 'policy-editor',
  PROFESSOR_ROOM: 'professor-room',
  PROFESSOR_SEASON: 'professor-season',
};

export const TOUR_LABELS = {
  [TOUR_IDS.STUDENT_DASHBOARD]: 'Dashboard checklist',
  [TOUR_IDS.POLICY_EDITOR]: 'Policy editor',
  [TOUR_IDS.PROFESSOR_ROOM]: 'Room management',
  [TOUR_IDS.PROFESSOR_SEASON]: 'Season setup',
};

const STORAGE_PREFIX = 'da_onboarding_';

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`;
}

function defaultState() {
  return {
    tours: {},
    checklist: {},
    videoDismissed: false,
    checklistDismissed: false,
  };
}

function readState(userId) {
  if (!userId) return defaultState();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, tours: { ...defaultState().tours, ...parsed.tours } };
  } catch {
    return defaultState();
  }
}

function writeState(userId, state) {
  if (!userId) return;
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

/** @returns {TourStatus | null} */
export function getTourStatus(userId, tourId) {
  return readState(userId).tours[tourId] ?? null;
}

export function isTourDone(userId, tourId) {
  const status = getTourStatus(userId, tourId);
  return status === 'completed' || status === 'skipped';
}

/** @param {TourStatus} status */
export function setTourStatus(userId, tourId, status) {
  const state = readState(userId);
  state.tours[tourId] = status;
  writeState(userId, state);
}

export function restartTour(userId, tourId) {
  const state = readState(userId);
  delete state.tours[tourId];
  writeState(userId, state);
}

/** Tour ids the user has finished or skipped (eligible for restart). */
export function getFinishedTourIds(userId) {
  const { tours } = readState(userId);
  return Object.entries(tours)
    .filter(([, status]) => status === 'completed' || status === 'skipped')
    .map(([id]) => id);
}

export function isVideoDismissed(userId) {
  return readState(userId).videoDismissed;
}

export function setVideoDismissed(userId, dismissed = true) {
  const state = readState(userId);
  state.videoDismissed = dismissed;
  writeState(userId, state);
}

export function getChecklistState(userId) {
  return readState(userId).checklist;
}

export function setChecklistItem(userId, itemId, done) {
  const state = readState(userId);
  state.checklist[itemId] = Boolean(done);
  writeState(userId, state);
}

export function isChecklistItemDone(userId, itemId) {
  return Boolean(readState(userId).checklist[itemId]);
}

export function isChecklistDismissed(userId) {
  return readState(userId).checklistDismissed;
}

export function setChecklistDismissed(userId, dismissed = true) {
  const state = readState(userId);
  state.checklistDismissed = dismissed;
  writeState(userId, state);
}
