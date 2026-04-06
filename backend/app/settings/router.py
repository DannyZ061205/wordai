from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from openai import AsyncOpenAI

from app.middleware.auth import get_current_user
from app.storage.json_store import store

from .models import (
    AISettingsResponse,
    AISettingsUpdate,
    ProviderPreset,
    TestConnectionRequest,
    TestConnectionResponse,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ---------------------------------------------------------------------------
# Provider presets
# ---------------------------------------------------------------------------

PROVIDER_PRESETS: list[ProviderPreset] = [
    ProviderPreset(
        id="deepseek",
        name="DeepSeek",
        base_url="https://api.deepseek.com",
        default_model="deepseek-chat",
        models=["deepseek-chat", "deepseek-reasoner"],
        description="Fast, cost-effective Chinese LLM with strong coding/reasoning",
    ),
    ProviderPreset(
        id="openai",
        name="OpenAI",
        base_url="https://api.openai.com/v1",
        default_model="gpt-4o",
        models=["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        description="Industry-leading models from OpenAI",
    ),
    ProviderPreset(
        id="groq",
        name="Groq",
        base_url="https://api.groq.com/openai/v1",
        default_model="llama-3.3-70b-versatile",
        models=[
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ],
        description="Ultra-fast inference with open-source models",
    ),
    ProviderPreset(
        id="ollama",
        name="Ollama (Local)",
        base_url="http://localhost:11434/v1",
        default_model="llama3",
        models=["llama3", "llama3.2", "mistral", "codellama", "phi3", "gemma2"],
        description="Run models locally — no API key required",
    ),
    ProviderPreset(
        id="custom",
        name="Custom",
        base_url="",
        default_model="",
        models=[],
        description="Any OpenAI-compatible endpoint (LM Studio, Azure, vLLM, etc.)",
    ),
]

_PRESET_MAP = {p.id: p for p in PROVIDER_PRESETS}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return key[:4] + "****" + key[-4:]


def _settings_to_response(raw: dict) -> AISettingsResponse:
    return AISettingsResponse(
        provider=raw.get("provider", "custom"),
        api_key_masked=_mask_key(raw.get("api_key", "")),
        base_url=raw.get("base_url", ""),
        model=raw.get("model", ""),
        is_configured=bool(raw.get("api_key")),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/ai/providers", response_model=list[ProviderPreset])
async def list_providers():
    """Return the list of supported AI provider presets."""
    return PROVIDER_PRESETS


@router.get("/ai", response_model=AISettingsResponse)
async def get_ai_settings(current_user: dict = Depends(get_current_user)):
    """Return the current user's AI settings (API key is masked)."""
    raw = store.get_ai_settings(current_user["id"])
    if not raw:
        # Return unconfigured state
        return AISettingsResponse(
            provider="deepseek",
            api_key_masked="",
            base_url="https://api.deepseek.com",
            model="deepseek-chat",
            is_configured=False,
        )
    return _settings_to_response(raw)


@router.put("/ai", response_model=AISettingsResponse)
async def update_ai_settings(
    body: AISettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Save the user's AI provider settings."""
    if not body.api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="api_key cannot be empty",
        )
    if not body.base_url.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="base_url cannot be empty",
        )
    raw = {
        "provider": body.provider,
        "api_key": body.api_key.strip(),
        "base_url": body.base_url.strip().rstrip("/"),
        "model": body.model.strip() or _PRESET_MAP.get(body.provider, PROVIDER_PRESETS[-1]).default_model,
    }
    store.upsert_ai_settings(current_user["id"], raw)
    return _settings_to_response(raw)


@router.delete("/ai", status_code=204)
async def delete_ai_settings(current_user: dict = Depends(get_current_user)):
    """Remove the user's AI settings (clears their API key)."""
    store.delete_ai_settings(current_user["id"])


@router.post("/ai/test", response_model=TestConnectionResponse)
async def test_ai_connection(
    body: TestConnectionRequest,
    current_user: dict = Depends(get_current_user),
):
    """Test the provided API credentials by sending a minimal request."""
    if not body.api_key.strip():
        return TestConnectionResponse(ok=False, message="API key is required")

    base_url = body.base_url.strip().rstrip("/")
    if not base_url:
        return TestConnectionResponse(ok=False, message="Base URL is required")

    try:
        client = AsyncOpenAI(api_key=body.api_key, base_url=base_url)
        response = await client.chat.completions.create(
            model=body.model or "gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'ok' in one word."}],
            max_tokens=5,
        )
        reply = response.choices[0].message.content or ""
        return TestConnectionResponse(
            ok=True,
            message=f"Connection successful! Model replied: \"{reply.strip()}\"",
        )
    except Exception as exc:
        msg = str(exc)
        # Friendlier messages for common errors
        if "401" in msg or "authentication" in msg.lower() or "api key" in msg.lower():
            msg = "Invalid API key — double-check it and try again"
        elif "404" in msg or "not found" in msg.lower():
            msg = f"Model '{body.model}' not found — check model name"
        elif "connect" in msg.lower() or "network" in msg.lower():
            msg = f"Cannot reach {base_url} — check the URL and your internet"
        return TestConnectionResponse(ok=False, message=msg)
