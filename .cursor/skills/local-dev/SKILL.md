---
name: local-dev
description: >-
  Start and troubleshoot the Decision Arena local dev stack (FastAPI backend +
  Vite frontend). Use when the user asks to run, start, or fire up the server,
  dev environment, or local app; when API proxy errors appear; or when ports
  8000/5173 are in use.
---

# Decision Arena — Local Dev

## URLs

| Service | URL |
|---------|-----|
| App (open this) | http://localhost:5173 |
| API | http://localhost:8000 |
| API docs | http://localhost:8000/docs |

The Vite dev server proxies `/auth`, `/rooms`, `/rounds`, `/policies`, `/policy-presets`, `/results`, `/leaderboard`, `/seasons`, `/lessons`, and `/users` to port 8000.

## Start both servers

Use **two terminals**. First-time setup installs deps; skip on later runs.

**Terminal 1 — backend**

```bash
cd backend
python3 -m pip install -r requirements.txt   # first time only
python3 -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install   # first time only
npm run dev
```

On macOS, prefer `python3 -m pip` and `python3 -m uvicorn` — bare `pip` / `uvicorn` may not be on PATH.

**Port 8000 conflict**: If Docker or another app listens on `localhost:8000` (IPv6), Vite must proxy to `127.0.0.1:8000` (see `frontend/vite.config.js`). Symptom: login shows **"Not Found"** even though `curl http://127.0.0.1:8000/` returns Decision Arena.

## Agent workflow

1. Check whether ports 8000 and 5173 are already listening before starting.
2. Start backend and frontend as **background** processes if the user only wants the app up; give them the foreground commands above to take over.
3. Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs` and `http://localhost:5173/` should return `200`.
4. SQLite DB `backend/decision_arena.db` is created on first API use (gitignored).

## Troubleshooting

- **Port in use**: find and stop the process (`lsof -i :8000` / `lsof -i :5173`) or pick another port.
- **Frontend can't reach API**: backend must be on 8000; check Vite proxy in `frontend/vite.config.js`.
- **Postgres locally**: `export DATABASE_URL=postgresql://user:pass@host:5432/decision_arena` before starting backend.

## Simulation only (no web)

```bash
cd backend && python3 -m simulation.test_engine
```
