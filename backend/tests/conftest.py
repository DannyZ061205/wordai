from __future__ import annotations

import json
import os
import tempfile
from typing import Generator

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Override settings BEFORE importing anything that reads them.
# Each test session uses an isolated temp directory so persisted JSON from
# a previous run can never leak across tests.
# ---------------------------------------------------------------------------

_tmp_dir = tempfile.mkdtemp()
os.environ["DATA_DIR"] = _tmp_dir
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-do-not-use-in-prod")
os.environ.setdefault("DEEPSEEK_API_KEY", "test-placeholder")


from app.main import app  # noqa: E402
from app.storage.json_store import store  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _wipe_store() -> None:
    """Clear every in-memory collection and delete the backing JSON files."""
    store._users.clear()
    store._documents.clear()
    store._document_versions.clear()
    store._shares.clear()
    store._share_links.clear()
    store._ai_history.clear()

    # Delete persisted files so lifespan's store.load() finds nothing
    for name in ("users", "documents", "document_versions", "shares", "share_links", "ai_history"):
        path = os.path.join(_tmp_dir, f"{name}.json")
        if os.path.exists(path):
            os.remove(path)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function", autouse=True)
def reset_store():
    """Wipe all store state before AND after every test function."""
    _wipe_store()
    yield
    _wipe_store()


@pytest.fixture(scope="function")
def client(reset_store) -> Generator[TestClient, None, None]:
    """
    A TestClient whose lifespan starts on a clean store.
    The explicit dependency on reset_store guarantees that wipe runs before
    the TestClient context manager enters (and calls store.load()).
    """
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

def _register_and_login(client: TestClient, username: str, email: str, password: str) -> dict:
    resp = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return {
        "id": data["user"]["id"],
        "username": username,
        "email": email,
        "password": password,
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


@pytest.fixture(scope="function")
def test_user(client: TestClient) -> dict:
    return _register_and_login(client, "alice", "alice@example.com", "password123")


@pytest.fixture(scope="function")
def test_user2(client: TestClient) -> dict:
    return _register_and_login(client, "bob", "bob@example.com", "password456")


@pytest.fixture(scope="function")
def test_doc(client: TestClient, test_user: dict) -> dict:
    resp = client.post(
        "/api/documents/",
        json={"title": "My Test Document"},
        headers=test_user["headers"],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
