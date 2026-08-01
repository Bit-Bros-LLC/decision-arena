export const TYPICAL_MONTH_DAYS_MIN = 21;
export const TYPICAL_MONTH_DAYS_MAX = 35;

export function isTypicalMonthDuration(days) {
  const n = Number(days);
  return Number.isFinite(n) && n >= TYPICAL_MONTH_DAYS_MIN && n <= TYPICAL_MONTH_DAYS_MAX;
}

export function monthDurationWarning(days) {
  if (isTypicalMonthDuration(days)) return null;
  return `Month length is ${days} days. Months are typically ${TYPICAL_MONTH_DAYS_MIN}–${TYPICAL_MONTH_DAYS_MAX} days.`;
}
