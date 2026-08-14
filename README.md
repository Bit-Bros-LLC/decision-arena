# Decision Arena  

A competitive inventory simulation game where students design operating policies, backtest them against historical data, and get scored on unseen actuals. Built as a companion tool for [The Decision Factory](https://a.co/d/0i9LPR5F) by Adam DeJans Jr. & John Brandon Elam.

The public **landing page** (`/`) introduces the product; signed-in users use the **dashboard**, **onboarding** (checklist + guided tours), **classrooms**, **fiscal years**, and **Learn** modules below.

> **Terminology:** API routes and internal identifiers still use `/rooms`, `/seasons`, and `/rounds`. In the UI, these map to **Classroom**, **Fiscal Year**, **Month**, **Practice Run**, and **Policy Review** (limited policy changes between months).

## Getting started

First-run onboarding helps students and professors reach a successful play loop without instructor support. All onboarding is **optional** — it never blocks login or submission.

| Feature | What it does |
|---------|--------------|
| **Dashboard checklist** | Role-based getting-started card. **Students:** watch intro → start a practice run → join a classroom (optional) → submit a policy. **Professors:** watch intro → create a classroom → set up the first fiscal year. Progress persists in browser `localStorage`, partially backed by server signals. |
| **Guided tours** | Driver.js walkthroughs: **policy editor** (auto on first visit), **classroom management**, **fiscal year setup**. Restart any completed tour from the **Help** menu. |
| **Intro video** | Set `VITE_INTRO_VIDEO_URL` (YouTube/Vimeo). Shown on first login (dismissible), from Help, and from Learn Lesson 0. |

**Recommended first paths**

- **Student (solo):** Dashboard → Create Private Practice Run → open a month → Policy Editor (backtest → submit) → advance/score → Results
- **Professor:** Dashboard → Create classroom → create a fiscal year → activate → score → advance fiscal year

Full implementation reference: [`docs/onboarding-plan.md`](docs/onboarding-plan.md).

## Modes at a glance

| Mode | What it is |
|------|------------|
| **Classroom fiscal years** | A **fiscal year** under a class **classroom** auto-generates many months from **scenario presets** and optional **mix** rules. Students play through months with **policy reviews** (limited policy changes between months). |
| **Practice runs** | Private sandbox runs anyone can start, or classroom practice runs started inside a class (professor can see class runs). Listed under **Practice Runs** in the nav and on the classroom Activity tab. |

## How it works

### Fiscal years and practice runs

1. A fiscal year defines **N months**, **costs**, **starting inventory**, **month length**, and **lead-in history** length
2. **Scenario engine**: pick a base **preset** and a **mode**—single scenario for every month, **random mix** from allowed presets, or **custom mix** (per-month preset). Browse presets with demand previews in the **Scenario Library** (`/scenarios`)
3. **Policy reviews** cap how many times a student can revise policy between months; changing policy may require signaling/unlocking the next month per fiscal year rules
4. **Activate** the fiscal year, then **advance** to score the current month and unlock the next (professor-led in class; practice-run owners can drive their own runs)
5. **Cumulative P&L** across scored months is tracked; use the **Fiscal Year** tab on the leaderboard for a per-month matrix plus fiscal year total

### Practice runs

1. From **Practice Runs** or a classroom Activity tab, open the **practice run** builder (same levers as classroom fiscal years: months, mix, policy reviews, etc.)
2. Private runs are **scoped to you**. Classroom practice runs are visible to the owner and the class professor.
3. Owners can use **undo last advance** / related flows where the UI offers them, to iterate on practice

## Learn

An interactive lesson module that teaches the concepts behind the game. Students work through bite-sized lessons at their own pace, each with reading content and a hands-on interactive element. The table below is about **Learn**; the rest of this README focuses on the **simulation game**.

| # | Lesson | What Students Learn | Interactive Element |
|---|--------|--------------------|--------------------|
| 0 | **Enter the Arena** | How the Decision Factory maps to daily play — policies, dual sourcing, hidden actuals | Links to intro video; bridges Learn → game |
| 1 | **Why Point Forecasts Fail** | Single-number predictions hide uncertainty | Reveal 8 demand scenarios behind a "perfect" forecast; pick an order qty and see stockout vs. waste rates |
| 2 | **Probabilistic Forecasting** | Distributions, quantiles, confidence intervals | Drag sliders for mean/std dev; watch P10/P50/P90 quantile markers shift on a live bell curve |
| 3 | **Economics of Decisions** | Cost asymmetry, the newsvendor critical ratio | Adjust overstocking/understocking costs; see the optimal order point shift on the distribution |
| 4 | **Safety Stock** | Service levels, the z-score formula, diminishing returns | Slide target service level from 50%–99.9%; watch safety stock climb exponentially |
| 5 | **Demand Patterns** | Trend, seasonality, intermittence, and true uncertainty | Mix trend/seasonality/noise with sliders; toggle decomposition overlays to reveal hidden structure |
| 6 | **Lead Time Variability** | How supplier unreliability compounds demand uncertainty | Dual sliders show "demand only" vs "combined" uncertainty distributions expanding in real-time |
| 7 | **The Bullwhip Effect** | Small demand signals amplify into upstream chaos | Multi-tier supply chain with reaction multiplier; watch order swings explode upstream |
| 8 | **The Newsvendor Problem** | The classic one-shot ordering problem, done with distributions | Full expected cost curve with optimal Q*; 100-day race of newsvendor vs. point-forecast ordering |
| 9 | **Why Simulate?** | Monte Carlo thinking and when formulas aren't enough | Progressive histogram builder — click +1/+10/+100/+1000 sims and watch outcomes materialize |
| 10 | **Forecast Evaluation** | Why chasing MAPE can destroy your P&L | Two forecasters compete: the "accurate" one loses money due to bias; toggle cost asymmetry to see why |

Progress is persisted per-user in the database. Adding a new lesson requires only a component file and one registry entry in [`frontend/src/data/lessons.js`](frontend/src/data/lessons.js).

## The game

Students manage a virtual factory's inventory. Each simulated day:

- Stochastic **demand** arrives and is fulfilled from inventory
- **Orders** placed previously arrive after a **lead time**
- **Supplier failure** events can cancel in-flight orders (unless the student uses dual sourcing)

### Dual sourcing

Optional second lever when a professor enables it for a month or fiscal year. Students trade higher unit cost for resilience when suppliers fail.

| Who | Control | Effect |
|-----|---------|--------|
| **Professor** | `dual_source_enabled` toggle on month/fiscal year costs | Unlocks the student lever for that game |
| **Professor** | `dual_source_premium_per_unit` | Extra procurement cost per unit when a student chooses dual sourcing |
| **Professor** | `dual_source_rescue_pct` | Share of a dual-sourced order quantity that survives a supplier failure (remainder is lost) |
| **Student** | `dual_source: true/false` on policy | Single source (default) vs dual source on every order |

**Simulation behavior:** when dual sourcing is on, the engine charges the premium on order days and marks pending orders as dual-sourced. On supplier-failure events, single-source in-flight orders are fully cancelled; dual-sourced orders are partially rescued per `dual_source_rescue_pct`. Results and leaderboards report **dual-source spend**; highlights call out wasted premium or missed mitigation.

Three policy templates are available:

| Template | What You Set | How It Works |
|----------|-------------|--------------|
| **Order Up To (S)** | Target inventory level | Orders enough each day to bring inventory position up to S |
| **Service Level** | Target fill rate (e.g. 95%) | Calculates safety stock from demand history and lead times |
| **Reorder Point (s, Q)** | Threshold s, order size Q | When inventory position drops below s, order exactly Q units |

**Policy UX**: students can save **policy presets** (reusable parameter sets) and, where allowed, **un-submit** a policy before the deadline. Months may be **draft**, **active**, or **scored**; professors can **activate** or **delete** months as the workflow requires.

**After scoring**, **results** include: headline **P&L**, service level, stockout days, dual-source spend, and supplier failure hit counts; a **scenario review** chart (historical vs actual demand) with optional raw JSON; **daily P&L** bar chart; auto **highlights**; and a scrollable **daily log** (demand, fulfillment, orders, inventory, events).

**Leaderboards**: switch between **Month** (one month) and **Fiscal Year** (matrix of profit per month plus **fiscal year total**). The month view adds service level, stockouts, dual-source spend, and a mini **daily P&L** sparkline per row; the fiscal year view uses **sticky** rank and name columns for wide tables.

### Professor tools

- **Scenario Library** (`/scenarios`) — browse engine scenario presets with demand preview charts (amber = historical lead-in students see; sky = full fiscal year demand). Linked from fiscal year creator and classroom flows when picking mix modes.
- **Classroom Activity** — create shared fiscal years and view classroom practice runs; Class Admin holds the invite code.

## Tech Stack

- **Backend**: Python (FastAPI + Pydantic) + SQLAlchemy + PostgreSQL in production; **SQLite** for local dev. Structured fields use **JSONB** on Postgres and **JSON** on SQLite.
- **Frontend**: React + Vite + Tailwind CSS + Recharts
- **Auth**: JWT (bcrypt password hashing)

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API runs at `http://localhost:8000` with auto-generated docs at `http://localhost:8000/docs`.

By default a SQLite file **`decision_arena.db`** is created in the working directory on first use (it should not be committed; ensure it is gitignored for your clone). For PostgreSQL:

```bash
export DATABASE_URL=postgresql://user:pass@host:5432/decision_arena
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite’s dev server defaults to **`http://localhost:5173`**; API paths under `/auth`, `/rooms`, `/rounds`, `/policies`, `/policy-presets`, `/results`, `/leaderboard`, `/seasons`, `/lessons`, and `/users` are **proxied** to `http://localhost:8000` (see `frontend/vite.config.js`).

For start/troubleshoot commands, see [`.cursor/skills/local-dev/SKILL.md`](.cursor/skills/local-dev/SKILL.md).

GA4 is wired in the frontend with consent gating:

- `VITE_GA_MEASUREMENT_ID` enables analytics wiring for production builds.
- Analytics only initializes in production (`import.meta.env.PROD`).
- Users must explicitly accept the consent banner before pageviews/events are sent.

**Intro video:** set `VITE_INTRO_VIDEO_URL` in `frontend/.env` to a YouTube or Vimeo watch/embed URL (see `frontend/.env.example`). See **Getting started** above and [`docs/onboarding-plan.md`](docs/onboarding-plan.md) for the full onboarding system.

### Run the simulation standalone

Test the simulation engine without any web infrastructure:

```bash
cd backend
python -m simulation.test_engine
```

Runs several policy configurations against a sample scenario and prints a leaderboard.

## Project structure

```
decision-arena/
  backend/
    main.py                 FastAPI app; mounts route modules
    auth.py                 JWT authentication helpers
    database.py             Models: users, rooms, members, seasons, rounds, policies, presets,
                            results, lessons, room solo templates, season member state, etc.
    routes/
      auth_routes.py        Register, login, profile, admin password reset, list users
      rooms.py              Classrooms + join + complete (end class)
      rounds.py             Month get/list; standalone create/edit disabled (410)
      policies.py           Save/update policy, get, delete (un-submit), backtest
      policy_presets.py     User policy presets
      results.py            Per-month results, month/fiscal year leaderboards
      lessons.py            Lesson progress
      seasons.py            Fiscal year CRUD, advance, practice-run/sandbox lists
      onboarding.py         GET /users/me/onboarding-status
    simulation/
      engine.py             run_simulation()
      season_scenarios.py   Presets, mixing, month slicing
      policies.py           Policy template executors
      highlights.py         Key-moment text
      models.py             Dataclasses (State, Decision, DayScenario, etc.)
  frontend/
    src/
      pages/
        LandingPage.jsx     Marketing landing
        Login.jsx, Dashboard.jsx, AccountSettings.jsx
        RoomView.jsx        Classroom Activity: fiscal years + practice runs; Class Admin invite
        SeasonCreator.jsx, SeasonView.jsx, SeasonSprintBuilder.jsx, SoloSeasonsPage.jsx
        ScenarioLibrary.jsx Browse scenario presets with demand previews
        PolicyEditor.jsx    Play month: backtest, submit
        RoundResults.jsx    Scored results, charts, log
        Leaderboard.jsx     Month + fiscal year
        LearnHub.jsx, LessonPage.jsx, lessons/   # 11 interactive lessons (incl. EnterTheArena)
      components/           NavBar, OnboardingTour, DashboardChecklist, HelpMenu, IntroVideoModal, …
      context/              OnboardingContext, breadcrumb labels
      lib/                  onboarding.js, policyEditorTour.js, professorRoomTour.js, professorSeasonTour.js, …
      data/lessons.js       Lesson registry
      api.js                HTTP client
      App.jsx               Routes
```

## API endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT |
| PUT | `/auth/profile` | Update profile |
| POST | `/auth/admin-reset-password` | Admin reset (restricted) |
| GET | `/auth/users` | List users (admin) |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users/me/onboarding-status` | Server signals for onboarding checklist (policy submitted, practice run, classrooms, etc.) |

### Rooms

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rooms` | Create classroom (professor) |
| GET | `/rooms` | List my classrooms |
| POST | `/rooms/{room_id}/join` | Join with invite code |
| POST | `/rooms/{room_id}/complete` | Mark class complete (end class) |

### Rounds (months inside fiscal years / practice runs)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rounds/{round_id}` | Get month (actuals redacted until scored) |
| GET | `/rounds/room/{room_id}` | List months in classroom |
| POST | `/rounds/{round_id}/score` | Score (season-linked months only; standalone removed) |

Standalone month create/edit/activate/delete return **410 Gone**.

### Policies and presets

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/policies` | Save or update policy |
| GET | `/policies/{round_id}` | Get my policy for month |
| DELETE | `/policies/{round_id}` | Un-submit / clear policy (when allowed) |
| POST | `/policies/backtest` | Backtest on historical data |
| GET | `/policy-presets` | List my saved policy presets |
| POST | `/policy-presets` | Create preset |
| DELETE | `/policy-presets/{preset_id}` | Delete preset |

### Results and leaderboards

| Method | Path | Description |
|--------|------|-------------|
| GET | `/results/{round_id}` | My results (after score) |
| GET | `/leaderboard/{round_id}` | Month leaderboard |
| GET | `/leaderboard/season/{season_id}` | Fiscal year / practice run standings (per-month + total) |

### Lessons

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lessons/progress` | Completion status |
| POST | `/lessons/{slug}/complete` | Mark complete |
| POST | `/lessons/{slug}/reset` | Reset progress |

### Seasons (fiscal years and practice runs)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/seasons/presets` | List engine scenario presets |
| POST | `/seasons/preview` | Preview generated fiscal year data (no persist) |
| POST | `/seasons` | Create fiscal year or practice run (`is_practice_run`) |
| GET | `/seasons/{season_id}` | Get fiscal year + months |
| GET | `/seasons/{season_id}/my-state` | My policy-review state, etc. |
| POST | `/seasons/{season_id}/activate` | Activate |
| POST | `/seasons/{season_id}/advance` | Score current and advance |
| POST | `/seasons/{season_id}/undo-latest-advance` | Undo last advance (practice runs) |
| POST | `/seasons/{season_id}/rounds/{round_id}/unlock` | Unlock policy-change edit for a month |
| GET | `/seasons/room/{room_id}` | List fiscal years + visible practice runs in classroom |
| GET | `/seasons/sandbox` | List current user’s sandbox practice runs |
| GET | `/seasons/my-solo` | List current user’s practice runs |

Case study / solo-template endpoints return **410 Gone**.

## Deployment

**Backend** — [Railway](https://railway.app):

- Create a new project, add a PostgreSQL database
- Connect your repo, set root directory to `decision-arena/backend`
- Set env vars: `DATABASE_URL` (auto-set by Railway Postgres), `JWT_SECRET`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Frontend** — [Vercel](https://vercel.com):

- Connect your repo, set root directory to `decision-arena/frontend`
- Set env vars:
  - `VITE_API_URL` to your Railway backend URL
  - `VITE_GA_MEASUREMENT_ID=G-GFBBZSFESV`
- Framework preset: Vite

### Analytics verification (GA4)

1. Deploy frontend with `VITE_GA_MEASUREMENT_ID` set.
2. Open the deployed site in a fresh/incognito browser profile.
3. Accept the analytics consent banner.
4. Navigate across several routes (`/`, `/login`, `/dashboard`, etc.).
5. In GA4, confirm activity in **Realtime** or **DebugView**:
   - `page_view` events appear on route changes.
   - Custom events appear for key actions (`login_success`, `room_created`, `room_joined`, `policy_submitted`).
   - Onboarding events when applicable (`onboarding_tour_started`, `onboarding_tour_completed`, `onboarding_checklist_item_done`, `onboarding_video_opened`).

## Roadmap and future work

- More Learn lessons (multi-echelon inventory, EOQ)
- Code policies (e.g. Monaco editor + sandboxed execution)
- Richer **scenario construction** (e.g. from probability distributions beyond current presets and mix modes)
- Daily drip reveal of actuals throughout a month
- **CSV upload** for hand-authored historical data (not in the app yet)
- Deeper **shared template / library** experiences beyond per-classroom case studies (e.g. org-wide or discoverable libraries)
- Email (or in-app) notifications when results post

## License

Built by [Bit Bros Data](https://bitbrosdata.com). Based on *The Decision Factory*.

