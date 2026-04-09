# Decision Arena

A competitive inventory simulation game where students design operating policies, backtest them against historical data, and get scored on unseen actuals. Built as a companion tool for [The Decision Factory](https://a.co/d/0i9LPR5F) by Adam DeJans Jr. & John Brandon Elam.

## How It Works

1. **Professor creates a round** with historical demand data (60+ days) and secretly sets 30 days of "actual" data
2. **Students explore** the historical data, pick a policy template, tune it with sliders, and backtest as many times as they want
3. **Students submit** their policy before the deadline
4. **Professor scores** the round — all policies run against the hidden actuals
5. **Results reveal** day-by-day breakdowns, key moments, and a leaderboard
6. **Repeat** — cumulative profit across all rounds determines the season winner

## Learn Section

An interactive lesson module that teaches the concepts behind the game. Students work through bite-sized lessons at their own pace, each with reading content and a hands-on interactive element.

| Lesson | What Students Learn | Interactive Element |
|--------|--------------------|--------------------|
| **Why Point Forecasts Fail** | Single-number predictions hide uncertainty | Reveal 8 demand scenarios behind a "perfect" forecast; pick an order qty and see stockout vs. waste rates |
| **Probabilistic Forecasting** | Distributions, quantiles, confidence intervals | Drag sliders for mean/std dev; watch P10/P50/P90 quantile markers shift on a live bell curve |
| **Economics of Decisions** | Cost asymmetry, the newsvendor critical ratio | Adjust overstocking/understocking costs; see the optimal order point shift on the distribution |
| **Safety Stock** | Service levels, the z-score formula, diminishing returns | Slide target service level from 50%–99.9%; watch safety stock climb exponentially |

Progress is persisted per-user in the database. Adding a new lesson requires only a component file and one registry entry.

## The Game

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

## Tech Stack

- **Backend**: Python (FastAPI) + SQLAlchemy + PostgreSQL (SQLite for local dev)
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

By default it uses SQLite (`decision_arena.db`). Set `DATABASE_URL` env var for PostgreSQL:

```bash
export DATABASE_URL=postgresql://user:pass@host:5432/decision_arena
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:3000` with API calls proxied to the backend.

### Run the Simulation Standalone

Test the simulation engine without any web infrastructure:

```bash
cd backend
python -m simulation.test_engine
```

Runs 5 different policy configurations against a sample 30-day scenario and prints a leaderboard.

## Project Structure

```
decision-arena/
  backend/
    main.py                 FastAPI app entry point
    auth.py                 JWT authentication
    database.py             SQLAlchemy models (users, rooms, rounds, policies, results, lesson_progress)
    routes/
      auth_routes.py        POST /auth/register, /auth/login
      rooms.py              Room CRUD + join
      rounds.py             Round CRUD + scoring engine
      policies.py           Policy save + backtest
      results.py            Results + leaderboard queries
      lessons.py            Lesson progress tracking
    simulation/
      engine.py             Core simulation: run_simulation()
      policies.py           UI policy template executors
      highlights.py         Auto-generated key moment summaries
      models.py             Dataclasses (State, Decision, DayScenario, etc.)
  frontend/
    src/
      pages/
        Login.jsx           Auth screen
        Dashboard.jsx       Room list + join/create
        RoomView.jsx        Room detail + round list
        PolicyEditor.jsx    Main gameplay: data explorer + policy sliders + backtest
        RoundResults.jsx    Post-scoring day-by-day breakdown
        Leaderboard.jsx     Round + season standings
        Admin.jsx           Professor: create rounds with scenario data
        LearnHub.jsx        Lesson grid with progress tracking
        LessonPage.jsx      Slug-based lesson router
        lessons/            Interactive lesson components (one per lesson)
      components/
        LessonLayout.jsx    Shared lesson wrapper (sections, nav, completion)
      data/
        lessons.js          Lesson registry (add new lessons here)
      api.js                API client
      App.jsx               Router
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| POST | `/rooms` | Create room (professor) |
| GET | `/rooms` | List my rooms |
| POST | `/rooms/{id}/join` | Join with invite code |
| POST | `/rounds` | Create round (professor) |
| GET | `/rounds/{id}` | Get round (actuals hidden until scored) |
| GET | `/rounds/room/{roomId}` | List rounds in room |
| POST | `/rounds/{id}/score` | Score round (professor) |
| PUT | `/policies` | Save/update policy |
| GET | `/policies/{roundId}` | Get my policy for a round |
| POST | `/policies/backtest` | Run policy against historical data |
| GET | `/results/{roundId}` | My results for a round |
| GET | `/leaderboard/{roundId}` | Round leaderboard |
| GET | `/leaderboard/season/{roomId}` | Cumulative season standings |
| GET | `/lessons/progress` | Get lesson completion status |
| POST | `/lessons/{slug}/complete` | Mark a lesson as completed |
| POST | `/lessons/{slug}/reset` | Reset lesson progress |

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

## Future Plans

- Additional Learn lessons (demand modeling, lead time variability, multi-echelon)
- Code policies (Monaco editor + sandboxed Python execution)
- Auto-generated scenarios from probability distributions
- Daily drip reveal of actuals throughout the round
- CSV upload for historical data
- Scenario template library
- Email notifications when round results are posted

## License

Built by [Bit Bros Data](https://bitbrosdata.com). Based on *The Decision Factory*.
