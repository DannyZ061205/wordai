from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import HTTPException, status
from openai import AsyncOpenAI

from app.ai.models import AIFeature, AIRequest
from app.config import settings
from app.storage.json_store import store

# ---------------------------------------------------------------------------
# Prompt loader
# ---------------------------------------------------------------------------

_PROMPTS_DIR = Path(__file__).parent / "prompts"


class PromptLoader:
    """Loads and caches prompt templates from the prompts/ directory."""

    def __init__(self) -> None:
        self._cache: Dict[str, str] = {}

    def _load(self, name: str) -> str:
        path = _PROMPTS_DIR / f"{name}.txt"
        if not path.exists():
            raise FileNotFoundError(f"Prompt template not found: {path}")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def get(self, name: str) -> str:
        if name not in self._cache:
            self._cache[name] = self._load(name)
        return self._cache[name]

    def render(self, name: str, **variables: Any) -> str:
        template = self.get(name)
        for key, value in variables.items():
            template = template.replace(f"{{{key}}}", str(value) if value is not None else "")
        return template


_prompt_loader = PromptLoader()


class _DeepSeekClient:
    """Compatibility wrapper for DeepSeek streaming calls used in tests."""

    def __init__(self) -> None:
        self.api_key = ""
        self.base_url = "https://api.deepseek.com"
        self.model = "deepseek-chat"

    def configure(self, *, api_key: str, base_url: str, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    async def stream(self, prompt: str):
        openai_client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        return await openai_client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )


_deepseek = _DeepSeekClient()


# ---------------------------------------------------------------------------
# Per-user AI client resolution
# ---------------------------------------------------------------------------

def _get_client_config(user_id: str) -> tuple[str, str, str, str]:
    """Return (api_key, base_url, model, provider) for the given user.

    Each user must configure their own provider via Settings → AI Configuration.
    If no settings are found, returns an empty key so the streaming path can
    surface a clear "configure AI" error to the caller.
    """
    user_settings = store.get_ai_settings(user_id)
    if user_settings and user_settings.get("api_key"):
        return (
            user_settings["api_key"],
            user_settings.get("base_url", "https://api.deepseek.com"),
            user_settings.get("model", "deepseek-chat"),
            user_settings.get("provider", "deepseek"),
        )
    # No per-user settings — let the caller raise a user-visible error.
    return "", "https://api.deepseek.com", "deepseek-chat", "deepseek"


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(request: AIRequest) -> str:
    opts = request.options
    feature = request.feature
    text = request.selected_text
    ctx_before = request.context_before or ""
    ctx_after = request.context_after or ""
    context = (ctx_before + "\n" + ctx_after).strip()

    if feature == AIFeature.rewrite:
        return _prompt_loader.render(
            "rewrite",
            text=text,
            tone=opts.get("tone", "neutral"),
            context=context,
        )
    if feature == AIFeature.summarize:
        return _prompt_loader.render(
            "summarize",
            text=text,
            format=opts.get("format", "paragraph"),
            length=opts.get("length", "medium"),
        )
    if feature == AIFeature.translate:
        return _prompt_loader.render(
            "translate",
            text=text,
            target_language=opts.get("target_language", "English"),
        )
    if feature == AIFeature.expand:
        return _prompt_loader.render("expand", text=text, context=context)
    if feature == AIFeature.grammar:
        return _prompt_loader.render("grammar", text=text)
    if feature == AIFeature.custom:
        return _prompt_loader.render(
            "custom",
            text=text,
            instruction=opts.get("instruction", ""),
            context=context,
        )
    if feature == AIFeature.autocomplete:
        return _prompt_loader.render(
            "autocomplete",
            text_before=ctx_before,
            text_after=ctx_after,
        )
    raise ValueError(f"Unknown feature: {feature}")


# ---------------------------------------------------------------------------
# Streaming response generator
# ---------------------------------------------------------------------------

async def stream_ai_response(
    request: AIRequest,
    doc_id: str,
    user_id: str,
) -> AsyncGenerator[str, None]:
    """
    Async generator that yields SSE-formatted strings.

    Format:
        data: {"chunk": "...", "done": false}\\n\\n
        ...
        data: {"chunk": "", "done": true, "interaction_id": "..."}\\n\\n
    """
    import json

    # Resolve the user's configured provider (or env fallback)
    api_key, base_url, model, provider = _get_client_config(user_id)
    if not api_key:
        yield f"data: {json.dumps({'error': 'No AI API key configured. Open Settings → AI Configuration to add your key.', 'done': True, 'no_api_key': True})}\n\n"
        return

    prompt = _build_prompt(request)
    full_response: list[str] = []
    interaction_id = str(uuid.uuid4())

    try:
        # Claude / Anthropic uses its own SDK and streaming API
        if provider == "claude":
            import anthropic as _anthropic
            anthropic_client = _anthropic.AsyncAnthropic(api_key=api_key)
            async with anthropic_client.messages.stream(
                model=model,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    if text:
                        full_response.append(text)
                        yield f"data: {json.dumps({'chunk': text, 'done': False})}\n\n"
        elif provider == "deepseek":
            _deepseek.configure(
                api_key=api_key,
                base_url=base_url,
                model=model,
            )
            stream = await _deepseek.stream(prompt)
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_response.append(delta)
                    yield f"data: {json.dumps({'chunk': delta, 'done': False})}\n\n"
        else:
            openai_client = AsyncOpenAI(api_key=api_key, base_url=base_url)
            stream = await openai_client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_response.append(delta)
                    yield f"data: {json.dumps({'chunk': delta, 'done': False})}\n\n"

    except Exception as exc:
        msg = str(exc)
        if "401" in msg or "authentication" in msg.lower():
            msg = "Invalid API key. Open Settings → AI Configuration to fix it."
        elif "404" in msg:
            msg = f"Model '{model}' not found. Check your AI settings."
        yield f"data: {json.dumps({'error': msg, 'done': True})}\n\n"
        return

    # Persist the interaction
    response_text = "".join(full_response)
    _log_interaction(
        interaction_id=interaction_id,
        doc_id=doc_id,
        user_id=user_id,
        feature=request.feature.value,
        input_text=request.selected_text,
        prompt_used=prompt,
        response_text=response_text,
    )

    import json
    yield f"data: {json.dumps({'chunk': '', 'done': True, 'interaction_id': interaction_id})}\n\n"


def _log_interaction(
    *,
    interaction_id: str,
    doc_id: str,
    user_id: str,
    feature: str,
    input_text: str,
    prompt_used: str,
    response_text: str,
) -> None:
    data = {
        "id": interaction_id,
        "doc_id": doc_id,
        "user_id": user_id,
        "feature": feature,
        "input_text": input_text,
        "prompt_used": prompt_used,
        "response_text": response_text,
        "accepted": None,
        "applied_text": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    store.create_ai_interaction(data)


# ---------------------------------------------------------------------------
# Outcome recording
# ---------------------------------------------------------------------------

def record_interaction_outcome(
    interaction_id: str, accepted: bool, applied_text: Optional[str]
) -> Dict:
    interaction = store.get_ai_interaction(interaction_id)
    if not interaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Interaction not found"
        )
    updates: Dict[str, Any] = {"accepted": accepted}
    if applied_text is not None:
        updates["applied_text"] = applied_text
    return store.update_ai_interaction(interaction_id, updates)
