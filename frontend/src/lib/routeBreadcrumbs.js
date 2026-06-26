import { matchPath } from 'react-router-dom';
import lessons from '../data/lessons';

/** @typedef {{ label: string, to: string | null, overrideId?: string }} BreadcrumbItem */

/**
 * @param {string} label
 * @param {string | null} to
 * @param {string} [overrideId]
 * @returns {BreadcrumbItem}
 */
function crumb(label, to, overrideId) {
  const item = { label, to };
  if (overrideId) item.overrideId = overrideId;
  return item;
}

/**
 * Ordered most-specific first. Patterns must stay in sync with App.jsx routes.
 * @type {{ pattern: string, build: (p: Record<string, string>) => BreadcrumbItem[] }[]}
 */
const ROUTE_CRUMBS = [
  {
    pattern: '/leaderboard/room/:roomId/template/:templateId/cohort',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', `/room/${p.roomId}`, 'room'),
      crumb('Cohort leaderboard', null, 'leaderboardLeaf'),
    ],
  },
  {
    pattern: '/leaderboard/season/:seasonId',
    build: () => [
      crumb('Dashboard', '/dashboard'),
      crumb('Season leaderboard', null, 'leaderboardLeaf'),
    ],
  },
  {
    pattern: '/leaderboard/:roundId',
    build: () => [
      crumb('Dashboard', '/dashboard'),
      crumb('Round leaderboard', null, 'leaderboardRound'),
    ],
  },
  {
    pattern: '/room/:roomId/edit-round/:roundId',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', `/room/${p.roomId}`, 'room'),
      crumb('Edit round', null),
    ],
  },
  {
    pattern: '/room/:roomId/season/:seasonId',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', `/room/${p.roomId}`, 'room'),
      crumb('Season', null, 'season'),
    ],
  },
  {
    pattern: '/room/:roomId/season-sprint/new',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', `/room/${p.roomId}`, 'room'),
      crumb('New season sprint', null),
    ],
  },
  {
    pattern: '/room/:roomId/create-round',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', `/room/${p.roomId}`, 'room'),
      crumb('Create round', null),
    ],
  },
  {
    pattern: '/room/:roomId/create-season',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', `/room/${p.roomId}`, 'room'),
      crumb('Create season', null),
    ],
  },
  {
    pattern: '/room/:roomId',
    build: () => [
      crumb('Dashboard', '/dashboard'),
      crumb('Room', null, 'room'),
    ],
  },
  {
    pattern: '/round/:roundId/results',
    build: (p) => [
      crumb('Dashboard', '/dashboard'),
      crumb('Policy', `/round/${p.roundId}`, 'roundPolicy'),
      crumb('Results', null),
    ],
  },
  {
    pattern: '/round/:roundId',
    build: () => [
      crumb('Dashboard', '/dashboard'),
      crumb('Policy', null, 'roundPolicy'),
    ],
  },
  {
    pattern: '/season-sprint/new',
    build: () => [crumb('Dashboard', '/dashboard'), crumb('New season sprint', null)],
  },
  {
    pattern: '/season-sprint/:seasonId',
    build: () => [
      crumb('Dashboard', '/dashboard'),
      crumb('Season', null, 'season'),
    ],
  },
  {
    pattern: '/learn/:slug',
    build: (p) => {
      const lesson = lessons.find((l) => l.slug === p.slug);
      const title = lesson?.title || 'Lesson';
      return [crumb('Dashboard', '/dashboard'), crumb('Learn', '/learn'), crumb(title, null, 'lesson')];
    },
  },
  {
    pattern: '/learn',
    build: () => [crumb('Dashboard', '/dashboard'), crumb('Learn', null)],
  },
  {
    pattern: '/dashboard',
    build: () => [crumb('Dashboard', null)],
  },
  {
    pattern: '/solo-seasons',
    build: () => [crumb('Dashboard', '/dashboard'), crumb('Solo seasons', null)],
  },
  {
    pattern: '/account',
    build: () => [crumb('Dashboard', '/dashboard'), crumb('Account', null)],
  },
];

/**
 * @param {string} pathname
 * @returns {BreadcrumbItem[]}
 */
export function getBreadcrumbsFromPathname(pathname) {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  for (const { pattern, build } of ROUTE_CRUMBS) {
    const m = matchPath({ path: pattern, end: true, caseSensitive: false }, path);
    if (m) return build(m.params);
  }

  return [crumb('Dashboard', '/dashboard'), crumb('Page', null)];
}
