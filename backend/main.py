from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes.auth_routes import router as auth_router
from routes.rooms import router as rooms_router
from routes.rounds import router as rounds_router
from routes.policies import router as policies_router
from routes.results import router as results_router
from routes.policy_presets import router as policy_presets_router
from routes.lessons import router as lessons_router
from routes.seasons import router as seasons_router
from routes.onboarding import router as onboarding_router

app = FastAPI(title="Decision Arena", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(rounds_router)
app.include_router(policies_router)
app.include_router(policy_presets_router)
app.include_router(results_router)
app.include_router(lessons_router)
app.include_router(seasons_router)
app.include_router(onboarding_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"app": "Decision Arena", "status": "running"}
