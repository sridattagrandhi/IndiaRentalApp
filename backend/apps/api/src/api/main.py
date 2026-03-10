# apps/api/src/api/main.py
from api.core.db import Base, SessionLocal, engine
# Routers
from api.routes import listings, me, search
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

try:
    from api.routes.uploads import router as uploads_router
except Exception:
    uploads_router = None  # optional

import os

API_PREFIX = "/v1"

app = FastAPI(title="IndiaRental API", version="1.0.0")

# --- DEV ONLY auth bypass (remove later or guard by env) ---
try:
    from api.deps.auth import cognito_user  # your real dependency
    if os.getenv("DISABLE_AUTH", "0") == "1":
        def _fake_user():
            return {"sub": "dev-sub"}
        app.dependency_overrides[cognito_user] = _fake_user
except Exception:
    pass

# Health
@app.get(f"{API_PREFIX}/health")
def health():
    return {"ok": True}

@app.get(f"{API_PREFIX}/health/db")
def health_db():
    with SessionLocal() as s:
        s.execute(text("SELECT 1"))
    return {"db": "ok"}

# Dev: ensure tables exist (prefer Alembic in prod)
@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)

# Routers (no mock main router)
app.include_router(me.router,     prefix=f"{API_PREFIX}/me",       tags=["me"])
app.include_router(search.router, prefix=f"{API_PREFIX}",          tags=["search"])
app.include_router(listings.router, prefix=f"{API_PREFIX}",        tags=["listings"])
if uploads_router:
    app.include_router(uploads_router, prefix=f"{API_PREFIX}", tags=["uploads"])

# CORS (open in dev; tighten for prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lambda handler (optional)
try:
    from mangum import Mangum  # type: ignore
    handler = Mangum(app)
except Exception:
    handler = None
