"""
WebSocket endpoint tests — §4.1 requirement.

Covers:
  1. Connection authentication (no token, bad token, refresh token, no doc access)
  2. Successful connection and presence broadcast
  3. Binary message storage and delivery
  4. reset_yjs_state() unit test
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.websocket.manager import manager


# ---------------------------------------------------------------------------
# Fixture: wipe WebSocket manager state around every test
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_ws_manager():
    manager.active_connections.clear()
    manager.user_info.clear()
    manager.yjs_docs.clear()
    yield
    manager.active_connections.clear()
    manager.user_info.clear()
    manager.yjs_docs.clear()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _ws_url(doc_id: str, token: str) -> str:
    return f"/ws/{doc_id}?token={token}"


# ---------------------------------------------------------------------------
# 1. Connection authentication
# ---------------------------------------------------------------------------

def test_ws_no_token_rejected(client: TestClient, test_doc: dict):
    """WebSocket upgrade without a token query-param must be refused."""
    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/{test_doc['id']}"):
            pass  # pragma: no cover


def test_ws_invalid_token_rejected(client: TestClient, test_doc: dict):
    """A malformed / unsigned token must close the socket with code 4001."""
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(_ws_url(test_doc["id"], "not.a.valid.jwt")):
            pass  # pragma: no cover
    assert exc_info.value.code == 4001


def test_ws_refresh_token_rejected(
    client: TestClient, test_user: dict, test_doc: dict
):
    """A refresh token (type='refresh') must be rejected with code 4001.

    WebSocket auth requires an *access* token; passing the refresh token
    must not grant a session.
    """
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            _ws_url(test_doc["id"], test_user["refresh_token"])
        ):
            pass  # pragma: no cover
    assert exc_info.value.code == 4001


def test_ws_no_document_access_rejected(
    client: TestClient, test_user2: dict, test_doc: dict
):
    """A valid user with no access to the document must be closed with 4003."""
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect(
            _ws_url(test_doc["id"], test_user2["access_token"])
        ):
            pass  # pragma: no cover
    assert exc_info.value.code == 4003


# ---------------------------------------------------------------------------
# 2. Successful connection and presence broadcast
# ---------------------------------------------------------------------------

def test_ws_owner_connects_receives_awareness(
    client: TestClient, test_user: dict, test_doc: dict
):
    """An authenticated owner receives a presence (awareness) message on connect."""
    with client.websocket_connect(
        _ws_url(test_doc["id"], test_user["access_token"])
    ) as ws:
        raw = ws.receive_text()
        data = json.loads(raw)

    assert data["type"] == "awareness"
    assert isinstance(data["users"], list)
    user_ids = [u["user_id"] for u in data["users"]]
    assert test_user["id"] in user_ids


def test_ws_shared_viewer_can_connect(
    client: TestClient,
    test_user: dict,
    test_user2: dict,
    test_doc: dict,
):
    """A user shared as viewer must be able to open an authenticated connection."""
    # Grant viewer access
    resp = client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "viewer"},
        headers=test_user["headers"],
    )
    assert resp.status_code == 201

    with client.websocket_connect(
        _ws_url(test_doc["id"], test_user2["access_token"])
    ) as ws:
        raw = ws.receive_text()
        data = json.loads(raw)

    assert data["type"] == "awareness"
    user_ids = [u["user_id"] for u in data["users"]]
    assert test_user2["id"] in user_ids


def test_ws_awareness_includes_username_and_color(
    client: TestClient, test_user: dict, test_doc: dict
):
    """Each entry in the awareness users list must include username and color."""
    with client.websocket_connect(
        _ws_url(test_doc["id"], test_user["access_token"])
    ) as ws:
        data = json.loads(ws.receive_text())

    assert len(data["users"]) == 1
    entry = data["users"][0]
    assert entry["username"] == test_user["username"]
    assert entry["color"].startswith("#")


# ---------------------------------------------------------------------------
# 3. Binary message exchange
# ---------------------------------------------------------------------------

def test_ws_binary_update_stored_in_manager(
    client: TestClient, test_user: dict, test_doc: dict
):
    """Binary Yjs updates sent by a client are accumulated in the manager."""
    doc_id = test_doc["id"]
    payload = b"\x00\x01\x02\x03\xff"

    with client.websocket_connect(_ws_url(doc_id, test_user["access_token"])) as ws:
        ws.receive_text()   # consume initial awareness
        ws.send_bytes(payload)

    # After the session closes the update must be in yjs_docs
    assert manager.yjs_docs.get(doc_id) == payload


def test_ws_stored_state_delivered_to_new_client(
    client: TestClient, test_user: dict, test_doc: dict
):
    """A freshly connecting client receives the previously accumulated Yjs state."""
    doc_id = test_doc["id"]
    stored = b"\xde\xad\xbe\xef"

    # Pre-seed manager with an existing document state
    manager.yjs_docs[doc_id] = stored

    with client.websocket_connect(_ws_url(doc_id, test_user["access_token"])) as ws:
        # Server sends bytes (stored state) THEN awareness text
        received = ws.receive_bytes()
        ws.receive_text()   # consume awareness

    assert received == stored


def test_ws_multiple_updates_accumulate(
    client: TestClient, test_user: dict, test_doc: dict
):
    """Successive binary messages from a client are concatenated in the manager."""
    doc_id = test_doc["id"]
    first = b"\x01\x02"
    second = b"\x03\x04"

    with client.websocket_connect(_ws_url(doc_id, test_user["access_token"])) as ws:
        ws.receive_text()       # awareness
        ws.send_bytes(first)
        ws.send_bytes(second)

    assert manager.yjs_docs.get(doc_id) == first + second


# ---------------------------------------------------------------------------
# 4. reset_yjs_state unit test
# ---------------------------------------------------------------------------

def test_reset_yjs_state_clears_stored_bytes(test_doc: dict):
    """reset_yjs_state() removes stored Yjs bytes for a document."""
    doc_id = test_doc["id"]
    manager.yjs_docs[doc_id] = b"\xca\xfe\xba\xbe"

    manager.reset_yjs_state(doc_id)

    assert manager.yjs_docs.get(doc_id) is None


def test_reset_yjs_state_on_missing_doc_is_noop(test_doc: dict):
    """reset_yjs_state() on a document with no stored state does not raise."""
    manager.reset_yjs_state("nonexistent-doc-id")  # must not raise
