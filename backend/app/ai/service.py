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


# ---------------------------------------------------------------------------
# DeepSeek client
# ---------------------------------------------------------------------------

class DeepSeekClient:
    """Thin wrapper around the OpenAI-compatible DeepSeek API."""

    def __init__(self) -> None:
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=settings.deepseek_api_key,
                base_url="https://api.deepseek.com",
            )
        return self._client

    async def stream(self, prompt: str):
        """Return an async stream of chat completion chunks."""
        return await self.client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=True,
        )


_deepseek = DeepSeekClient()


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
    prompt = _build_prompt(request)
    full_response: list[str] = []
    interaction_id = str(uuid.uuid4())

    try:
        stream = await _deepseek.stream(prompt)
        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                full_response.append(delta)
                # JSON-encode the chunk to escape special chars
                import json
                yield f"data: {json.dumps({'chunk': delta, 'done': False})}\n\n"

    except Exception as exc:
        import json
        yield f"data: {json.dumps({'error': str(exc), 'done': True})}\n\n"
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
