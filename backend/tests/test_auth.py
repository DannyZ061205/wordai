from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

def test_register_success(client: TestClient):
    resp = client.post(
        "/api/auth/register",
        json={"username": "carol", "email": "carol@example.com", "password": "secret99"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["username"] == "carol"
    assert data["user"]["email"] == "carol@example.com"
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    # Hashed password must never appear in the response
    assert "hashed_password" not in data["user"]
    assert "password" not in data["user"]


def test_register_duplicate_email(client: TestClient, test_user: dict):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": "alice2",
            "email": test_user["email"],
            "password": "anotherpass",
        },
    )
    assert resp.status_code == 409


def test_register_duplicate_username(client: TestClient, test_user: dict):
    resp = client.post(
        "/api/auth/register",
        json={
            "username": test_user["username"],
            "email": "different@example.com",
            "password": "anotherpass",
        },
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_success(client: TestClient, test_user: dict):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_user["email"], "password": test_user["password"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient, test_user: dict):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_user["email"], "password": "wrongpassword"},
    )
    assert resp.status_code == 401


def test_login_unknown_email(client: TestClient):
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "irrelevant"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------

def test_get_me_authenticated(client: TestClient, test_user: dict):
    resp = client.get("/api/auth/me", headers=test_user["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == test_user["id"]
    assert data["username"] == test_user["username"]
    assert data["email"] == test_user["email"]


def test_get_me_unauthenticated(client: TestClient):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

def test_refresh_token(client: TestClient, test_user: dict):
    resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": test_user["refresh_token"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    # New access token should be usable
    new_headers = {"Authorization": f"Bearer {data['access_token']}"}
    me_resp = client.get("/api/auth/me", headers=new_headers)
    assert me_resp.status_code == 200


def test_refresh_with_access_token_fails(client: TestClient, test_user: dict):
    """Passing an access token where a refresh token is expected should fail."""
    resp = client.post(
        "/api/auth/refresh",
        json={"refresh_token": test_user["access_token"]},
    )
    assert resp.status_code == 401
