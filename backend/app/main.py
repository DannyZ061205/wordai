from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.storage.json_store import store


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.data_dir, exist_ok=True)
    store.load()

    yield

    # Shutdown
    store.save()


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="wordAI API",
        description=(
            "Real-time collaborative document editor with an integrated AI writing assistant."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    from app.auth.router import router as auth_router
    from app.documents.router import router as documents_router
    from app.ai.router import router as ai_router
    from app.websocket.router import router as ws_router

    app.include_router(auth_router)
    app.include_router(documents_router)
    app.include_router(ai_router)
    app.include_router(ws_router)

    # Health check
    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
