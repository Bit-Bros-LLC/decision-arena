# Onboarding Reference

Shipped reference for Decision Arena first-run experience (checklist, Driver.js tours, intro video, preset previews, polish).

**Last updated:** 2026-06-25

> **Status: Shipped.** Slices 1–8 and Wave 1 tracks landed in commits `0557f35` (foundation), `3fbaf5d` (slices 2–5), and `a54bbc8` (slices 6–8 + Wave 1). Integration smoke test passed 2026-06-25 (see [Verification](#verification)). Parallel execution guide archived at [`docs/archive/onboarding-multitask.md`](archive/onboarding-multitask.md).

> **Terminology:** API routes and internal identifiers still use `/rooms`, `/seasons`, and `/rounds`. In the UI, these map to **Classroom**, **Fiscal Year**, **Month**, **Practice Run**, **Case Study**, and **Policy Review**.

---

## Goals

1. **Students** can complete a practice run → tune a policy → submit → understand results **without instructor support**.
2. **Professors** can create a classroom → configure a fiscal year → activate → score → advance **without support**.
3. **Scenario presets** are understandable at a glance (not just name + badge + one line).
4. **Narrative** from *The Decision Factory* is available in-app via video embed and optional copy — production of the video happens **outside** this repo.

## Out of scope

- Video production (scripting, recording, editing, Alex character design)
- Marketing landing page (`/`) redesign
- Requiring Learn completion before playing
- Cross-device onboarding sync (v1 uses browser localStorage only)
- Localization / i18n

## Personas & paths

### Student — recommended first path (solo)

```
Dashboard → Create Private Practice Run → practice run builder
  → Activate / open month → PolicyEditor (backtest → submit)
  → Professor scores (solo: owner advances) → RoundResults → Leaderboard
```

### Student — class path

```
Dashboard → Join classroom (Classroom ID + invite code) → Classroom → open active month
  → PolicyEditor → submit before deadline → results after professor scores
```

### Professor path

```
Dashboard → Create classroom → Classroom (copy invite code)
  → Create fiscal year OR classic month → Activate
  → After deadline: Score → Advance fiscal year (if applicable) → Leaderboard
```

Optional async path: publish **case study** in classroom; students instantiate their own copy.

---

## Slice overview

| # | Slice | Depends on | Primary files (expected) |
|---|--------|------------|---------------------------|
| 0 | This plan | — | `docs/onboarding-plan.md` |
| 1 | Onboarding foundation | 0 | `frontend/src/lib/onboarding.js`, `HelpMenu`, `IntroVideoModal`, `App.jsx` |
| 2 | Student dashboard checklist | 1 | `frontend/src/pages/Dashboard.jsx` |
| 3 | Student policy editor tour | 1 | `frontend/src/pages/PolicyEditor.jsx` |
| 4 | Scenario library / preset visuals | 1 | `SeasonCreator.jsx`, `SeasonSprintBuilder.jsx`, maybe `ScenarioLibrary.jsx` |
| 5 | Professor classroom + fiscal year tour | 1, 4 (link only) | `RoomView.jsx`, `SeasonCreator.jsx` |
| 6 | Learn “Lesson 0” (optional) | 1, 7 (embed URL) | `frontend/src/data/lessons.js`, new lesson component |
| 7 | Video integration | 1 | `IntroVideoModal`, `.env` / `VITE_INTRO_VIDEO_URL` |
| 8 | Polish & debrief | 2–5 | Empty states, post-score copy, mix-mode explainer |

**Parallelism:** After slice 1, slices **3** and **4** can proceed in parallel.

---

## Shared conventions (lock in during slice 1)

### Tour library

Use **Driver.js** (`driver.js` package). One shared wrapper: `frontend/src/components/OnboardingTour.jsx` (or `lib/runTour.js`).

- Attach `data-tour="step-id"` to target elements; do not rely on fragile CSS selectors alone.
- Every tour: **Next**, **Back**, **Skip**, progress indicator.
- **Skip** and **Complete** both mark the tour done for that tour id.

### Persistence (v1)

`frontend/src/lib/onboarding.js`:

```js
// Keys: da_onboarding_{userId}
// Shape: { tours: { [tourId]: 'completed' | 'skipped' }, checklist: { ... }, videoDismissed: boolean }
```

- Key tours by stable ids: `policy-editor`, `professor-room`, `professor-season`. (Slice 2 uses a dashboard **checklist card**, not a Driver tour.)
- `getUser().id` from `frontend/src/api.js` scopes storage per account.
- **Restart tour** clears one tour id from storage (via Help menu).

### UX rules

- All onboarding is **optional** — never block login or submission.
- Show first-visit tours once; respect “Don’t show again” on video modal.
- Copy: second person, short, concrete. **Alex voice deferred** until video ships; avoid in-app Alex avatar in v1 unless copy explicitly references “watch the intro.”
- Professors see professor tours; students see student tours (`user.role === 'professor'`).

### Analytics events

Use existing `trackEvent` from `frontend/src/lib/analytics.js` (fires only when analytics consent granted):

| Event | When | Params |
|-------|------|--------|
| `onboarding_checklist_item_done` | Checklist item checked | `item_id`, `user_role` |
| `onboarding_tour_started` | Tour opens | `tour_id`, `user_role` |
| `onboarding_tour_completed` | Last step finished | `tour_id`, `user_role` |
| `onboarding_tour_skipped` | User skips | `tour_id`, `user_role` |
| `onboarding_video_opened` | Intro modal opened | `source` (`first_login`, `help_menu`, `learn`) |
| `onboarding_video_dismissed` | Modal closed | `dont_show_again` |

### Environment

| Variable | Purpose |
|----------|---------|
| `VITE_INTRO_VIDEO_URL` | YouTube/Vimeo embed URL; empty = show “Video coming soon” placeholder |

---

## Slice acceptance criteria

### Slice 1 — Onboarding foundation

**Why:** Shared primitives for every other slice; video shell unblocks shipping without waiting on production.

**Deliverables**

- [x] `frontend/src/lib/onboarding.js` — get/set tour state, checklist state, video dismissed flag
- [x] `HelpMenu` (or nav dropdown) — “Watch intro”, “Restart tours…” (list completed tours with restart action)
- [x] `IntroVideoModal` — embed when `VITE_INTRO_VIDEO_URL` set; placeholder message when unset
- [x] `OnboardingTour` wrapper around Driver.js
- [x] Wire Help into `NavBar.jsx` or `ProtectedLayout` in `App.jsx`
- [x] Install `driver.js` dependency

**Acceptance**

1. Signed-in user opens Help → “Watch intro” opens modal (placeholder OK if no URL).
2. “Don’t show again” on modal persists across refresh (per user id).
3. `restartTour('policy-editor')` causes that tour to be eligible again on next visit (used by slice 3).
4. No tour runs automatically in slice 1 — only Help + modal shell.
5. Analytics events fire when consent granted (manual verify in dev with consent granted).

**Cursor prompt template**

> Implement slice 1 from `docs/onboarding-plan.md` only. Use Driver.js. Do not add page-specific tours yet.

---

### Slice 2 — Student dashboard checklist

**Why:** Orients new users before they hit fiscal year builder or policy editor.

**Deliverables**

- [x] Checklist card on `Dashboard.jsx` for all users; dismissible
- [x] Items (student-oriented; professors see superset or separate list):

  | `item_id` | Label | Completes when |
  |-----------|--------|----------------|
  | `watch_intro` | Watch the intro video | Video modal opened once |
  | `solo_season` | Start a private practice run | User navigates to `/season-sprint/new` or has any sandbox fiscal year |
  | `join_room` | Join a class classroom (optional) | Successful `joinRoom` OR dismissed as N/A |
  | `submit_policy` | Submit a policy | API indicates submission exists (or tour callback from slice 3) |

- [x] Primary CTA highlights “Create Private Practice Run” for users with no classrooms and no practice runs

**Acceptance**

1. New user sees checklist on dashboard; progress persists per user.
2. Checking off `watch_intro` happens after opening video from checklist link.
3. Checklist can be collapsed/dismissed; state remembered.
4. Professor account sees checklist with professor-relevant items OR checklist hidden with copy pointing to Help (team choice at implement time — document in PR).

**Cursor prompt template**

> Implement slice 2 from `docs/onboarding-plan.md`. Use `onboarding.js` from slice 1. Do not add Driver tours to PolicyEditor yet.

---

### Slice 3 — Student policy editor tour

**Why:** Highest cognitive load screen; bridges “what is a policy?” to backtest + submit.

**Tour id:** `policy-editor`

**Steps (target `data-tour` anchors)**

1. Historical demand chart — “You only see history. Scoring uses hidden actuals.”
2. Policy template picker — “Pick Order Up To, Service Level, or Reorder Point.”
3. Parameter sliders — “Tune your policy. The simulation runs it every day.”
4. Dual sourcing — “Optional second lever: single source vs dual source (when enabled for the month).”
5. Backtest button — “Test against history as many times as you want.”
6. Submit — “Submit locks your policy until deadline (if un-submit allowed, say so).”

**Acceptance**

1. First visit to `PolicyEditor` for a user who hasn’t completed `policy-editor` tour auto-starts tour (after page data loads).
2. Skip / complete persists; no auto-show on return.
3. Help → Restart tours → `policy-editor` → tour runs again on next visit.
4. Tour does not block clicking Submit if user ignores overlay (Driver default behavior).
5. Completing tour can mark checklist item `submit_policy` only after actual submit (keep separate).

**Cursor prompt template**

> Implement slice 3 from `docs/onboarding-plan.md`. Add data-tour attributes to PolicyEditor.jsx. Auto-start on first visit only.

---

### Slice 4 — Scenario library / preset visuals

**Why:** Professors (and practice-run students) pick scenarios without guessing from text alone.

**Deliverables**

- [x] Reuse `api.previewSeason` (`POST /seasons/preview`) — same as `SeasonCreator.jsx` modal
- [x] On each preset card: “Preview” or inline sparkline (fixed default config + `total_rounds: 3`, `round_duration_days: 30`, `historical_leadin_days: 60`)
- [x] Optional: standalone `ScenarioLibrary` page linked from fiscal year creator — grid of all 7 presets from `SEASON_PRESETS` in `backend/simulation/season_scenarios.py`

**Preset reference**

| id | Name | Badge |
|----|------|-------|
| `steady` | Steady State | Easy |
| `seasonality` | Seasonality | Medium |
| `trend_up` | Upward Trend | Medium |
| `regime_change` | Regime Change | Hard |
| `high_volatility` | High Volatility | Hard |
| `intermittent` | Intermittent / Lumpy | Expert |
| `black_swan_storm` | Black Swan Storm | Expert |

- [x] One-line **teaching caption** per preset (can extend API `list_presets` descriptions or hardcode in frontend map)
- [x] Apply same pattern in `SeasonSprintBuilder.jsx` if not shared component

**Acceptance**

1. Clicking preview on any preset shows demand chart with lead-in boundary and month boundaries.
2. Preview works without creating a fiscal year.
3. Loading and error states match existing fiscal year creator modal patterns.
4. No regression to fiscal year create submit flow.

**Cursor prompt template**

> Implement slice 4 from `docs/onboarding-plan.md`. Extract shared PresetPreviewChart if useful. Touch SeasonCreator and SeasonSprintBuilder.

---

### Slice 5 — Professor classroom + fiscal year tour

**Why:** Professor workflow is multi-step and easy to get wrong (activate before students play, etc.).

**Tour ids:** `professor-room`, `professor-season`

**`professor-room` steps (RoomView.jsx)**

1. Invite code — “Share Classroom ID + invite code with students.”
2. Create fiscal year / month — “Fiscal years auto-generate months; classic months are hand-built.”
3. Activate control — “Students can’t play until active.”
4. Score / advance — “After deadline, score then advance the fiscal year.”

**`professor-season` steps (SeasonCreator.jsx)**

1. Fiscal year rules — months, policy reviews, lead-in history
2. Scenario preset + preview — link to slice 4 preview
3. First month deadline
4. Create → lands on fiscal year dashboard

**Acceptance**

1. Tours only auto-start for `user.role === 'professor'`.
2. `professor-room` runs on first visit to any classroom the user owns/teaches.
3. `professor-season` runs on first visit to fiscal year create route.
4. Students never see these tours.

**Cursor prompt template**

> Implement slice 5 from `docs/onboarding-plan.md`. Professor role only. Depends on slice 1; link to preset preview from slice 4.

---

### Slice 6 — Learn “Lesson 0” (optional)

**Why:** Connects Learn module to the live game without duplicating 10 lessons.

**Deliverables**

- [x] New lesson slug `enter-the-arena` (order 0 or listed first in `lessons.js`)
- [x] Short reading: factory metaphor, two daily decisions, policies, hidden actuals
- [x] CTA button opens `IntroVideoModal` or embeds same URL
- [x] Link “Start a practice run” → `/season-sprint/new`

**Acceptance**

1. Lesson appears first in Learn hub with distinct styling (e.g. “Start here”).
2. Progress tracked like other lessons (`api` lesson progress).
3. Works when `VITE_INTRO_VIDEO_URL` is empty (text-only still valuable).

**Cursor prompt template**

> Implement slice 6 from `docs/onboarding-plan.md`. Add enter-the-arena lesson; minimal interactive element (video CTA + link).

---

### Slice 7 — Video integration

**Why:** Swap placeholder when external production delivers final asset.

**Deliverables**

- [x] Document `VITE_INTRO_VIDEO_URL` in README or `frontend/.env.example`
- [x] Support YouTube + Vimeo embed formats (normalize URL → embed iframe)
- [x] Optional: first-login auto-open modal once if not `videoDismissed` (student + professor)

**Acceptance**

1. Setting env var shows working embed in modal and Learn lesson.
2. First-login prompt respects “Don’t show again.”
3. No autoplay with sound (browser policy friendly).

**Cursor prompt template**

> Implement slice 7 from `docs/onboarding-plan.md`. Wire VITE_INTRO_VIDEO_URL; optional first-login prompt.

---

### Slice 8 — Polish & debrief

**Why:** Closes the loop after first scored month; reduces “what now?”

**Deliverables**

- [x] Dashboard empty state: branch student (“Join classroom”) vs professor (“Create classroom”)
- [x] `RoundResults` first-visit callout: tie metrics to concepts (stockouts → safety stock; link to Learn)
- [x] Fiscal year **mix mode** explainer (`single` / `random_mix` / `custom_mix`) in fiscal year creator — short copy + optional diagram
- [x] Post-submit confirmation in PolicyEditor with “what happens next”

**Acceptance**

1. Empty states show role-appropriate next step.
2. Debrief callout shows once per user (dismissible).
3. Mix mode copy visible before fiscal year create submit.

**Cursor prompt template**

> Implement slice 8 from `docs/onboarding-plan.md`. Small copy-only changes preferred; no new tours.

---

## Video production handoff (external)

When the video is ready, producers deliver:

- Final embed URL → set `VITE_INTRO_VIDEO_URL`
- Suggested chapter timestamps for Help page / Lesson 0:
  - 0:00 — Alex / Decision Factory hook
  - ~0:45 — One resource, daily demand, lead times
  - ~1:30 — Policy tuning + optional dual sourcing
  - ~2:30 — Policies (OUT, service level, reorder point)
  - ~3:30 — History vs hidden actuals, backtest, submit
  - ~4:30 — Fiscal years, policy reviews, leaderboard
  - ~5:30 — CTA: practice run vs join class

App team only executes **slice 7** when URL is available; slices 1–6 do not block on video.

---

## Verification

Integration smoke test run **2026-06-25** against local dev stack (`127.0.0.1:8000` + `localhost:5173`).

| Check | Result | Method |
|-------|--------|--------|
| Class fiscal year `random_mix` creates | Pass | API: `POST /seasons` with professor token |
| Practice run `custom_mix` creates | Pass | API: `POST /seasons` sandbox scope |
| Mix explainer on both builders | Pass | `SeasonModeConfigurator` `MODE_EXPLAINER` wired in SeasonCreator + SeasonSprintBuilder |
| Non-owner professor classroom — no tour | Pass | `RoomView.jsx` gate: `room.professor_id !== user.user_id` |
| Owner professor classroom — tour on first visit | Pass | `RoomView.jsx` auto-start when owner + tour not done |
| First-login modal once; dismiss persists | Pass | `OnboardingContext.jsx` + `isVideoDismissed` in `onboarding.js` |
| Student/professor empty dashboard CTAs | Pass | `Dashboard.jsx` role-specific empty states |
| Results debrief once + dismiss | Pass | `RoundResults.jsx` + `resultsDebriefDismissed` persistence |
| Post-submit next-steps copy | Pass | `PolicyEditor.jsx` `submitNextSteps` block |
| Onboarding status API | Pass | `GET /users/me/onboarding-status` after fiscal year create |

Spot-check in browser recommended after major onboarding changes: policy-editor tour auto-start, Help → restart tours, checklist progress sync.

---

## Implementation history

Slices were implemented incrementally (one slice ≈ one PR). Suggested PR titles for reference:

- `feat(onboarding): foundation — help menu, tour lib, video modal shell`
- `feat(onboarding): student dashboard checklist`
- `feat(onboarding): policy editor first-run tour`
- `feat(onboarding): scenario preset demand previews`
- `feat(onboarding): professor classroom and fiscal year tours`
- `feat(onboarding): Learn lesson 0 — enter the arena`
- `feat(onboarding): intro video URL and first-login prompt`
- `feat(onboarding): empty states and first-results debrief`

For the parallel Wave 1 execution guide (mix parity, tour gate, polish tracks), see [`docs/archive/onboarding-multitask.md`](archive/onboarding-multitask.md).

---

## Success metrics (post-launch)

Track via GA (consent-gated) and informal professor feedback:

- % new users completing `onboarding_tour_completed` for `policy-editor` within 7 days
- % users with at least one policy submission within 7 days of signup
- Drop-off: dashboard → fiscal year create → policy editor → submit (funnel)
- Support questions recurring themes (should decrease for “how do I join” / “what is policy review”)

---

## Related codebase references

| Topic | Location |
|-------|----------|
| Fiscal year presets API | `GET /seasons/presets`, `backend/simulation/season_scenarios.py` |
| Fiscal year preview | `POST /seasons/preview`, `SeasonCreator.jsx` `openDemandChartPreview` |
| Policy templates | `frontend/src/pages/PolicyEditor.jsx` `TEMPLATES` |
| Learn registry | `frontend/src/data/lessons.js` |
| User role | `user.role` — `professor` \| `student` |
| Practice run entry | `Dashboard.jsx` → `/season-sprint/new` |
| Analytics | `frontend/src/lib/analytics.js` |
