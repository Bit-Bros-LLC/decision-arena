# Decision Arena 

A competitive inventory simulation game where students design operating policies, backtest them against historical data, and get scored on unseen actuals. Built as a companion tool for [The Decision Factory](https://a.co/d/0i9LPR5F) by Adam DeJans Jr. & John Brandon Elam.

The public **landing page** (`/`) introduces the product; signed-in users use the **dashboard**, **rooms**, **seasons**, and **Learn** modules below.

## Modes at a glance

| Mode | What it is |
|------|------------|
| **Classic rounds** | Professor hand-builds each round: historical window + hidden actuals. Works great for tight instructor control. |
| **Room seasons** | A **season** under a class **room** auto-generates many rounds from **scenario presets** and optional **mix** rules. Students play through rounds with **contract updates** (limited policy changes between rounds). |
| **Solo seasons (sandbox)** | A private **Season Sprint** anyone can start—no room required. For practice; listed under **Solo-Seasons** in the nav. |
| **Season Sprint templates** | Professors **publish** a template in a room; each student can **instantiate** their own copy and run it asynchronously, so the class shares the same ruleset with independent runs. |

## How it works

### Classic rounds (standalone)

1. **Professor creates a round** with historical demand data (60+ days) and secretly sets 30 days of "actual" data
2. **Students explore** the historical data, pick a policy template, tune it with sliders, and backtest as many times as they want
3. **Students submit** their policy before the deadline
4. **Professor scores** the round — all policies run against the hidden actuals
5. **Results** show summary metrics, charts, highlights, and a full day-by-day log; **leaderboards** compare the class
6. **Repeat** with more standalone rounds, or use seasons (below) for a linked multi-round experience

### Seasons and Season Sprints

1. A season defines **N rounds**, **costs**, **starting inventory**, **round length**, and **lead-in history** length
2. **Scenario engine**: pick a base **preset** and a **mode**—single scenario for every round, **random mix** from allowed presets, or **custom mix** (per-round preset)
3. **Contract updates** cap how many times a student can revise policy between rounds; changing policy may require signaling/unlocking the next round per season rules
4. **Activate** the season, then **advance** to score the current round and unlock the next (professor-led in class; solo owners can drive their own sandbox)
5. **Cumulative P&L** across scored rounds is tracked; use the **Season** tab on the leaderboard for a per-round matrix plus season total

### Solo sandbox seasons

1. From **Solo-Seasons** or **Create Private Solo Season**, open the **Season Sprint** builder (same levers as room seasons: rounds, mix, contract updates, etc.)
2. The run is **scoped to you**—no class leaderboard unless you also play in a room
3. Owners can use **undo last advance** / related flows where the UI offers them, to iterate on practice

### Room Season Sprint templates (for classes)

1. In a **room**, a professor can **publish** a template (name + season parameters)
2. Students (or the professor) **start** a season from a template; each start is a **new season instance** with its own randomization where applicable
3. The API can aggregate **cohort** standings across instances of the same template (see **Advanced** under API)—useful for comparing async runs; the main app focuses on in-season and round leaderboards

## Learn

An interactive lesson module (currently in **beta**) that teaches the concepts behind the game. Students work through bite-sized lessons at their own pace, each with reading content and a hands-on interactive element. The table below is about **Learn**; the rest of this README focuses on the **simulation game**.

| # | Lesson | What Students Learn | Interactive Element |
|---|--------|--------------------|--------------------|
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

Progress is persisted per-user in the database. Adding a new lesson requires only a component file and one registry entry.

## The game

Students manage a virtual factory's inventory. Each simulated day:

- Stochastic **demand** arrives and is fulfilled from inventory
- **Orders** placed previously arrive after a **lead time**
- **Black swan events** can hit: supplier failures, warehouse damage, demand spikes, cost shocks
- **Insurance** can be purchased to mitigate black swan damage (at a daily premium cost)

Three policy templates are available:

| Template | What You Set | How It Works |
|----------|-------------|--------------|
| **Order Up To (S)** | Target inventory level | Orders enough each day to bring inventory position up to S |
| **Service Level** | Target fill rate (e.g. 95%) | Calculates safety stock from demand history and lead times |
| **Reorder Point (s, Q)** | Threshold s, order size Q | When inventory position drops below s, order exactly Q units |

**Policy UX**: students can save **policy presets** (reusable parameter sets) and, where allowed, **un-submit** a policy before the deadline. Rounds may be **draft**, **active**, or **scored**; professors can **activate** or **delete** rounds as the workflow requires.

**After scoring**, **results** include: headline **P&L**, service level, stockout days, insurance spend, and black swan hit counts; a **scenario review** chart (historical vs actual demand) with optional raw JSON; **daily P&L** bar chart; auto **highlights**; and a scrollable **daily log** (demand, fulfillment, orders, inventory, events).

**Leaderboards**: switch between **Round** (one round) and **Season** (matrix of profit per round plus **season total**). The round view adds service level, stockouts, insurance, and a mini **daily P&L** sparkline per row; the season view uses **sticky** rank and name columns for wide tables.

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

Vite’s dev server defaults to **`http://localhost:5173`**; API paths under `/auth`, `/rooms`, `/rounds`, `/policies`, `/policy-presets`, `/results`, `/leaderboard`, `/seasons`, and `/lessons` are **proxied** to `http://localhost:8000` (see `frontend/vite.config.js`).

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
      rooms.py              Rooms + join + complete (end class)
      rounds.py               Standalone rounds: CRUD, activate, delete, score
      policies.py           Save/update policy, get, delete (un-submit), backtest
      policy_presets.py     User policy presets
      results.py            Per-round results, round/season/cohort leaderboards
      lessons.py            Lesson progress
      seasons.py            Season CRUD, advance, templates, solo/sandbox lists
    simulation/
      engine.py             run_simulation()
      season_scenarios.py   Presets, mixing, round slicing
      policies.py           Policy template executors
      highlights.py         Key-moment text
      models.py             Dataclasses (State, Decision, DayScenario, etc.)
  frontend/
    src/
      pages/
        LandingPage.jsx     Marketing landing
        Login.jsx, Dashboard.jsx, AccountSettings.jsx
        RoomView.jsx        Room: rounds, seasons, Season Sprint templates
        Admin.jsx            Create/edit standalone rounds
        SeasonCreator.jsx, SeasonView.jsx, SeasonSprintBuilder.jsx, SoloSeasonsPage.jsx
        PolicyEditor.jsx    Play round: backtest, submit
        RoundResults.jsx    Scored results, charts, log
        Leaderboard.jsx     Round + season
        LearnHub.jsx, LessonPage.jsx, lessons/   # interactive lessons
      components/           e.g. NavBar, shared UI
      data/lessons.js      Lesson registry
      api.js                HTTP client
      App.jsx              Routes
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

### Rooms

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rooms` | Create room (professor) |
| GET | `/rooms` | List my rooms |
| POST | `/rooms/{room_id}/join` | Join with invite code |
| POST | `/rooms/{room_id}/complete` | Mark class complete (end class) |

### Rounds (standalone)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rounds` | Create round |
| PUT | `/rounds/{round_id}` | Update round |
| GET | `/rounds/{round_id}` | Get round (actuals redacted until scored) |
| GET | `/rounds/room/{room_id}` | List rounds in room |
| POST | `/rounds/{round_id}/activate` | Activate |
| POST | `/rounds/{round_id}/score` | Score |
| DELETE | `/rounds/{round_id}` | Delete round |

### Policies and presets

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/policies` | Save or update policy |
| GET | `/policies/{round_id}` | Get my policy for round |
| DELETE | `/policies/{round_id}` | Un-submit / clear policy (when allowed) |
| POST | `/policies/backtest` | Backtest on historical data |
| GET | `/policy-presets` | List my saved policy presets |
| POST | `/policy-presets` | Create preset |
| DELETE | `/policy-presets/{preset_id}` | Delete preset |

### Results and leaderboards

| Method | Path | Description |
|--------|------|-------------|
| GET | `/results/{round_id}` | My results (after score) |
| GET | `/leaderboard/{round_id}` | Round leaderboard |
| GET | `/leaderboard/season/{season_id}` | Season standings (per-round + total) |
| GET | `/leaderboard/room/{room_id}/template/{template_id}/cohort` | **Advanced**: cohort across season instances of one room template (API-first; not wired in the main UI) |

### Lessons

| Method | Path | Description |
|--------|------|-------------|
| GET | `/lessons/progress` | Completion status |
| POST | `/lessons/{slug}/complete` | Mark complete |
| POST | `/lessons/{slug}/reset` | Reset progress |

### Seasons and Season Sprint templates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/seasons/presets` | List engine scenario presets |
| POST | `/seasons/preview` | Preview generated season data (no persist) |
| POST | `/seasons` | Create season |
| GET | `/seasons/{season_id}` | Get season + rounds |
| GET | `/seasons/{season_id}/my-state` | My contract-update state, etc. |
| POST | `/seasons/{season_id}/activate` | Activate |
| POST | `/seasons/{season_id}/advance` | Score current and advance |
| POST | `/seasons/{season_id}/undo-latest-advance` | Undo last advance (when allowed) |
| POST | `/seasons/{season_id}/rounds/{round_id}/unlock` | Unlock contract-change edit for a round |
| GET | `/seasons/room/{room_id}` | List seasons in room |
| GET | `/seasons/sandbox` | List current user’s seasons with `season_scope` sandbox only |
| GET | `/seasons/my-solo` | List current user’s solo seasons |
| GET | `/seasons/room/{room_id}/solo-templates` | List Season Sprint templates for room |
| POST | `/seasons/room/{room_id}/solo-templates` | Create/publish template |
| POST | `/seasons/room/{room_id}/solo-templates/{template_id}/instantiate` | Start a new season from template |

## Deployment

**Backend** — [Railway](https://railway.app):

- Create a new project, add a PostgreSQL database
- Connect your repo, set root directory to `decision-arena/backend`
- Set env vars: `DATABASE_URL` (auto-set by Railway Postgres), `JWT_SECRET`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Frontend** — [Vercel](https://vercel.com):

- Connect your repo, set root directory to `decision-arena/frontend`
- Set env var `VITE_API_URL` to your Railway backend URL
- Framework preset: Vite

## Roadmap and future work

- Additional Learn lessons (multi-echelon inventory, demand modeling, EOQ)
- Code policies (e.g. Monaco editor + sandboxed execution)
- Richer **scenario construction** (e.g. from probability distributions beyond current presets and mix modes)
- Daily drip reveal of actuals throughout a round
- **CSV upload** for hand-authored historical data (not in the app yet)
- Deeper **shared template / library** experiences beyond per-room Season Sprint templates (e.g. org-wide or discoverable libraries)
- Email (or in-app) notifications when results post

## License

Built by [Bit Bros Data](https://bitbrosdata.com). Based on *The Decision Factory*.


