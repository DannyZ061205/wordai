from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


class AISettingsUpdate(BaseModel):
    provider: str       # "deepseek" | "openai" | "groq" | "ollama" | "custom"
    api_key: str
    base_url: str
    model: str


class AISettingsResponse(BaseModel):
    provider: str
    api_key_masked: str   # e.g. "sk-****cd8c2"
    base_url: str
    model: str
    is_configured: bool


class ProviderPreset(BaseModel):
    id: str
    name: str
    base_url: str
    default_model: str
    models: List[str]
    description: str


class TestConnectionRequest(BaseModel):
    provider: str
    api_key: str
    base_url: str
    model: str


class TestConnectionResponse(BaseModel):
    ok: bool
    message: str
