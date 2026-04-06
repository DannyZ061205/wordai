from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_document(client: TestClient, test_user: dict):
    resp = client.post(
        "/api/documents/",
        json={"title": "Hello World"},
        headers=test_user["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Hello World"
    assert data["owner_id"] == test_user["id"]
    assert data["role"] == "owner"
    assert data["content"] == ""
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_document_unauthenticated(client: TestClient):
    resp = client.post("/api/documents/", json={"title": "No Auth"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_documents(client: TestClient, test_user: dict, test_doc: dict):
    resp = client.get("/api/documents/", headers=test_user["headers"])
    assert resp.status_code == 200
    items = resp.json()
    assert isinstance(items, list)
    ids = [d["id"] for d in items]
    assert test_doc["id"] in ids


def test_list_documents_empty_for_new_user(client: TestClient, test_user2: dict):
    resp = client.get("/api/documents/", headers=test_user2["headers"])
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------

def test_get_document(client: TestClient, test_user: dict, test_doc: dict):
    resp = client.get(f"/api/documents/{test_doc['id']}", headers=test_user["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == test_doc["id"]
    assert data["title"] == test_doc["title"]


def test_get_document_not_found(client: TestClient, test_user: dict):
    resp = client.get("/api/documents/non-existent-id", headers=test_user["headers"])
    assert resp.status_code == 404


def test_get_document_forbidden_for_other_user(
    client: TestClient, test_user2: dict, test_doc: dict
):
    resp = client.get(f"/api/documents/{test_doc['id']}", headers=test_user2["headers"])
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

def test_update_document_as_owner(client: TestClient, test_user: dict, test_doc: dict):
    resp = client.patch(
        f"/api/documents/{test_doc['id']}",
        json={"title": "Updated Title", "content": "Some content here."},
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["content"] == "Some content here."


def test_update_document_as_viewer_forbidden(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    # Share as viewer first
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "viewer"},
        headers=test_user["headers"],
    )
    resp = client.patch(
        f"/api/documents/{test_doc['id']}",
        json={"content": "Viewer trying to edit"},
        headers=test_user2["headers"],
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def test_delete_document_as_owner(client: TestClient, test_user: dict, test_doc: dict):
    resp = client.delete(
        f"/api/documents/{test_doc['id']}", headers=test_user["headers"]
    )
    assert resp.status_code == 204
    # Confirm it's gone
    get_resp = client.get(
        f"/api/documents/{test_doc['id']}", headers=test_user["headers"]
    )
    assert get_resp.status_code == 404


def test_delete_document_as_non_owner_forbidden(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    # Give user2 editor access
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "editor"},
        headers=test_user["headers"],
    )
    resp = client.delete(
        f"/api/documents/{test_doc['id']}", headers=test_user2["headers"]
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------

def test_share_document(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    resp = client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "editor"},
        headers=test_user["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "editor"
    assert data["user_id"] == test_user2["id"]

    # user2 should now see the document
    list_resp = client.get("/api/documents/", headers=test_user2["headers"])
    ids = [d["id"] for d in list_resp.json()]
    assert test_doc["id"] in ids


def test_viewer_cannot_edit(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "viewer"},
        headers=test_user["headers"],
    )
    resp = client.patch(
        f"/api/documents/{test_doc['id']}",
        json={"content": "Should be forbidden"},
        headers=test_user2["headers"],
    )
    assert resp.status_code == 403


def test_list_shares(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "viewer"},
        headers=test_user["headers"],
    )
    resp = client.get(
        f"/api/documents/{test_doc['id']}/shares",
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    shares = resp.json()
    assert any(s["user_id"] == test_user2["id"] for s in shares)


def test_remove_share(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "editor"},
        headers=test_user["headers"],
    )
    resp = client.delete(
        f"/api/documents/{test_doc['id']}/shares/{test_user2['id']}",
        headers=test_user["headers"],
    )
    assert resp.status_code == 204


def test_update_share_role(
    client: TestClient, test_user: dict, test_user2: dict, test_doc: dict
):
    client.post(
        f"/api/documents/{test_doc['id']}/shares",
        json={"user_identifier": test_user2["email"], "role": "viewer"},
        headers=test_user["headers"],
    )
    resp = client.patch(
        f"/api/documents/{test_doc['id']}/shares/{test_user2['id']}",
        json={"role": "editor"},
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "editor"


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------

def test_version_history(client: TestClient, test_user: dict, test_doc: dict):
    # Initial version created on doc creation
    resp = client.get(
        f"/api/documents/{test_doc['id']}/versions",
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    versions = resp.json()
    assert len(versions) >= 1

    # Make an update → should create a new version
    client.patch(
        f"/api/documents/{test_doc['id']}",
        json={"content": "First edit"},
        headers=test_user["headers"],
    )
    resp2 = client.get(
        f"/api/documents/{test_doc['id']}/versions",
        headers=test_user["headers"],
    )
    assert len(resp2.json()) >= 2


def test_restore_version(client: TestClient, test_user: dict, test_doc: dict):
    # Create content
    client.patch(
        f"/api/documents/{test_doc['id']}",
        json={"content": "Version A"},
        headers=test_user["headers"],
    )
    client.patch(
        f"/api/documents/{test_doc['id']}",
        json={"content": "Version B"},
        headers=test_user["headers"],
    )

    versions = client.get(
        f"/api/documents/{test_doc['id']}/versions",
        headers=test_user["headers"],
    ).json()

    # Restore the first content version (version_number == 2, content "Version A")
    version_a = next(v for v in versions if v["content"] == "Version A")
    resp = client.post(
        f"/api/documents/{test_doc['id']}/versions/{version_a['id']}/restore",
        headers=test_user["headers"],
    )
    assert resp.status_code == 200
    assert resp.json()["content"] == "Version A"


# ---------------------------------------------------------------------------
# Share links
# ---------------------------------------------------------------------------

def test_create_share_link(client: TestClient, test_user: dict, test_doc: dict):
    resp = client.post(
        f"/api/documents/{test_doc['id']}/share-links",
        json={"role": "viewer"},
        headers=test_user["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert data["role"] == "viewer"


def test_access_via_share_link(client: TestClient, test_user: dict, test_user2: dict, test_doc: dict):
    link_resp = client.post(
        f"/api/documents/{test_doc['id']}/share-links",
        json={"role": "viewer"},
        headers=test_user["headers"],
    )
    token = link_resp.json()["token"]

    # user2 accesses via link (no auth needed)
    resp = client.get(f"/api/documents/via-link/{token}")
    assert resp.status_code == 200
    assert resp.json()["id"] == test_doc["id"]
