from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.storage.json_store import store


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ai_request(feature: str = "grammar", text: str = "Hello wrold.") -> dict:
    return {"feature": feature, "selected_text": text, "options": {}}


# ---------------------------------------------------------------------------
# test_ai_stream_requires_auth
# ---------------------------------------------------------------------------

def test_ai_stream_requires_auth(client: TestClient, test_doc: dict):
    resp = client.post(
        f"/api/ai/{test_doc['id']}/stream",
        json=_make_ai_request(),
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# test_ai_stream_viewer_forbidden
# ---------------------------------------------------------------------------

def test_ai_stream_viewer_forbidden(
    client: TestClient,
    test_user: dict,
    test_user2: dict,
    test_doc: dict,
):
    # Share as viewer
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "viewer"},
        headers=test_user["headers"],
    )
    resp = client.post(
        f"/api/ai/{test_doc['id']}/stream",
        json=_make_ai_request(),
        headers=test_user2["headers"],
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# test_ai_stream_owner_can_access (mocked DeepSeek)
# ---------------------------------------------------------------------------

def _make_mock_chunk(content: str):
    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].delta.content = content
    return chunk


def test_ai_stream_owner_can_access(
    client: TestClient,
    test_user: dict,
    test_doc: dict,
):
    async def _fake_stream(prompt):
        async def _gen():
            for word in ["Hello", " ", "world"]:
                yield _make_mock_chunk(word)

        mock = AsyncMock()
        mock.__aiter__ = lambda self: _gen()
        return mock

    with patch("app.ai.service._deepseek.stream", side_effect=_fake_stream):
        resp = client.post(
            f"/api/ai/{test_doc['id']}/stream",
            json=_make_ai_request(feature="grammar", text="Hello wrold."),
            headers=test_user["headers"],
        )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]

    # Parse SSE lines
    lines = [l for l in resp.text.splitlines() if l.startswith("data:")]
    events = [json.loads(l[len("data: "):]) for l in lines]

    chunks = [e for e in events if not e.get("done")]
    done_events = [e for e in events if e.get("done")]

    assert len(chunks) > 0
    assert len(done_events) == 1
    assert "interaction_id" in done_events[0]


# ---------------------------------------------------------------------------
# test_ai_history
# ---------------------------------------------------------------------------

def test_ai_history(
    client: TestClient,
    test_user: dict,
    test_doc: dict,
):
    # Manually seed an interaction
    store.create_ai_interaction(
        {
            "id": "fake-interaction-id",
            "doc_id": test_doc["id"],
            "user_id": test_user["id"],
            "feature": "grammar",
            "input_text": "Hello wrold.",
            "prompt_used": "Fix grammar: Hello wrold.",
            "response_text": "Hello world.",
            "accepted": None,
            "applied_text": None,
            "created_at": "2026-04-06T12:00:00+00:00",
        }
    )

    resp = client.get(
        f"/api/ai/{test_doc['id']}/history",
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    history = resp.json()
    assert isinstance(history, list)
    assert any(h["id"] == "fake-interaction-id" for h in history)


# ---------------------------------------------------------------------------
# test_interaction_outcome
# ---------------------------------------------------------------------------

def test_interaction_outcome(
    client: TestClient,
    test_user: dict,
    test_doc: dict,
):
    interaction_id = "outcome-test-id"
    store.create_ai_interaction(
        {
            "id": interaction_id,
            "doc_id": test_doc["id"],
            "user_id": test_user["id"],
            "feature": "rewrite",
            "input_text": "Original.",
            "prompt_used": "Rewrite: Original.",
            "response_text": "Rewritten.",
            "accepted": None,
            "applied_text": None,
            "created_at": "2026-04-06T12:00:00+00:00",
        }
    )

    resp = client.post(
        f"/api/ai/{test_doc['id']}/interactions/{interaction_id}/outcome",
        json={"accepted": True, "applied_text": "Rewritten."},
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted"] is True
    assert data["id"] == interaction_id


def test_interaction_outcome_reject(
    client: TestClient,
    test_user: dict,
    test_doc: dict,
):
    interaction_id = "reject-test-id"
    store.create_ai_interaction(
        {
            "id": interaction_id,
            "doc_id": test_doc["id"],
            "user_id": test_user["id"],
            "feature": "grammar",
            "input_text": "Errror text.",
            "prompt_used": "Fix: Errror text.",
            "response_text": "Error text.",
            "accepted": None,
            "applied_text": None,
            "created_at": "2026-04-06T12:00:00+00:00",
        }
    )

    resp = client.post(
        f"/api/ai/{test_doc['id']}/interactions/{interaction_id}/outcome",
        json={"accepted": False},
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["accepted"] is False
