from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Literal, Optional

from fastapi import HTTPException, status

from app.storage.json_store import store

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_user_role(doc_id: str, user_id: str) -> Optional[Literal["owner", "editor", "viewer"]]:
    """Return the user's role for a document, or None if they have no access."""
    doc = store.get_document(doc_id)
    if not doc:
        return None
    if doc.get("owner_id") == user_id:
        return "owner"
    share = store.get_share(doc_id, user_id)
    if share:
        return share.get("role")
    return None


def _require_role(doc_id: str, user_id: str, minimum: str) -> str:
    """Return role or raise 403/404 if user does not meet the minimum role."""
    _rank = {"viewer": 0, "editor": 1, "owner": 2}

    role = _get_user_role(doc_id, user_id)
    if role is None:
        doc = store.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if _rank.get(role, -1) < _rank.get(minimum, 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires {minimum} role, you have {role}",
        )
    return role


def _build_doc_response(doc: Dict, user_id: str) -> Dict:
    role = _get_user_role(doc["id"], user_id) or "viewer"
    owner = store.get_user(doc["owner_id"])
    return {
        **doc,
        "owner_username": owner["username"] if owner else "unknown",
        "role": role,
    }


def _build_shared_doc_response(doc: Dict, role: Literal["editor", "viewer"]) -> Dict:
    owner = store.get_user(doc["owner_id"])
    return {
        **doc,
        "owner_username": owner["username"] if owner else "unknown",
        "role": role,
    }


def _get_valid_share_link(
    token: str,
    doc_id: Optional[str] = None,
) -> tuple[Dict, Dict]:
    link = store.get_share_link(token)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link not found or revoked",
        )

    if link.get("expires_at"):
        expires_at = datetime.fromisoformat(link["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Share link has expired",
            )

    if doc_id and link["doc_id"] != doc_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link does not match this document",
        )

    doc = store.get_document(link["doc_id"])
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return link, doc


def _next_version_number(doc_id: str) -> int:
    versions = store.get_versions(doc_id)
    if not versions:
        return 1
    return max(v.get("version_number", 0) for v in versions) + 1


def _create_version(doc_id: str, content: str, created_by: str) -> Dict:
    owner = store.get_user(created_by)
    version_data = {
        "id": str(uuid.uuid4()),
        "doc_id": doc_id,
        "content": content,
        "created_at": _now_iso(),
        "created_by": created_by,
        "created_by_username": owner["username"] if owner else "unknown",
        "version_number": _next_version_number(doc_id),
    }
    return store.create_version(version_data)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def create_document(title: str, user_id: str) -> Dict:
    owner = store.get_user(user_id)
    doc_id = str(uuid.uuid4())
    now = _now_iso()
    doc_data = {
        "id": doc_id,
        "title": title,
        "content": "",
        "owner_id": user_id,
        "created_at": now,
        "updated_at": now,
    }
    doc = store.create_document(doc_data)
    _create_version(doc_id, "", user_id)
    return _build_doc_response(doc, user_id)


def get_document(doc_id: str, user_id: str) -> Dict:
    _require_role(doc_id, user_id, "viewer")
    doc = store.get_document(doc_id)
    return _build_doc_response(doc, user_id)


def list_documents(user_id: str) -> List[Dict]:
    docs = store.get_documents_for_user(user_id)
    result = []
    for doc in docs:
        owner = store.get_user(doc["owner_id"])
        role = _get_user_role(doc["id"], user_id) or "viewer"
        result.append(
            {
                "id": doc["id"],
                "title": doc["title"],
                "owner_username": owner["username"] if owner else "unknown",
                "updated_at": doc["updated_at"],
                "role": role,
            }
        )
    return sorted(result, key=lambda d: d["updated_at"], reverse=True)


def update_document(doc_id: str, user_id: str, updates: Dict) -> Dict:
    _require_role(doc_id, user_id, "editor")
    filtered = {k: v for k, v in updates.items() if v is not None}
    doc = store.update_document(doc_id, filtered)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if "content" in filtered:
        _create_version(doc_id, filtered["content"], user_id)
    return _build_doc_response(doc, user_id)


def update_document_via_share_link(doc_id: str, token: str, updates: Dict) -> Dict:
    link, _existing_doc = _get_valid_share_link(token, doc_id)
    if link["role"] != "editor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This share link does not allow editing",
        )

    filtered = {k: v for k, v in updates.items() if v is not None}
    if any(key != "content" for key in filtered):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Share-link editors can only update document content",
        )

    doc = store.update_document(doc_id, filtered)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if "content" in filtered:
        _create_version(doc_id, filtered["content"], f"guest_{token[:8]}")
    return _build_shared_doc_response(doc, link["role"])


def delete_document(doc_id: str, user_id: str) -> None:
    _require_role(doc_id, user_id, "owner")
    store.delete_document(doc_id)


def get_versions(doc_id: str, user_id: str) -> List[Dict]:
    _require_role(doc_id, user_id, "viewer")
    return store.get_versions(doc_id)


def restore_version(doc_id: str, version_id: str, user_id: str) -> Dict:
    _require_role(doc_id, user_id, "editor")
    version = store.get_version(version_id)
    if not version or version.get("doc_id") != doc_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    doc = store.update_document(doc_id, {"content": version["content"]})
    _create_version(doc_id, version["content"], user_id)
    return _build_doc_response(doc, user_id)


# ---------------------------------------------------------------------------
# Sharing
# ---------------------------------------------------------------------------

def share_document(doc_id: str, owner_id: str, user_identifier: str, role: str) -> Dict:
    _require_role(doc_id, owner_id, "owner")

    # Resolve target user by email or username
    target = store.get_user_by_email(user_identifier)
    if not target:
        target = store.get_user_by_username(user_identifier)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target["id"] == owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot share with yourself"
        )

    existing = store.get_share(doc_id, target["id"])
    if existing:
        updated = store.update_share(existing["id"], {"role": role})
        return {"user_id": target["id"], "username": target["username"], "email": target["email"], "role": updated["role"]}

    share_data = {
        "id": str(uuid.uuid4()),
        "doc_id": doc_id,
        "user_id": target["id"],
        "role": role,
        "created_at": _now_iso(),
    }
    store.create_share(share_data)
    return {"user_id": target["id"], "username": target["username"], "email": target["email"], "role": role}


def get_shares(doc_id: str, user_id: str) -> List[Dict]:
    _require_role(doc_id, user_id, "owner")
    shares = store.get_shares_for_doc(doc_id)
    result = []
    for s in shares:
        u = store.get_user(s["user_id"])
        if u:
            result.append(
                {
                    "user_id": s["user_id"],
                    "username": u["username"],
                    "email": u["email"],
                    "role": s["role"],
                }
            )
    return result


def remove_share(doc_id: str, target_user_id: str, requester_id: str) -> None:
    _require_role(doc_id, requester_id, "owner")
    share = store.get_share(doc_id, target_user_id)
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    store.delete_share(share["id"])


def update_share_role(doc_id: str, target_user_id: str, requester_id: str, new_role: str) -> Dict:
    _require_role(doc_id, requester_id, "owner")
    share = store.get_share(doc_id, target_user_id)
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    updated = store.update_share(share["id"], {"role": new_role})
    u = store.get_user(target_user_id)
    return {
        "user_id": target_user_id,
        "username": u["username"] if u else "unknown",
        "email": u["email"] if u else "",
        "role": updated["role"],
    }


# ---------------------------------------------------------------------------
# Share links
# ---------------------------------------------------------------------------

def create_share_link(doc_id: str, user_id: str, role: str, expires_in_days: Optional[int]) -> Dict:
    _require_role(doc_id, user_id, "owner")
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=expires_in_days)).isoformat() if expires_in_days else None
    link_data = {
        "token": token,
        "doc_id": doc_id,
        "role": role,
        "created_by": user_id,
        "created_at": now.isoformat(),
        "expires_at": expires_at,
    }
    link = store.create_share_link(link_data)
    url = f"/api/documents/via-link/{token}"
    return {
        "token": link["token"],
        "url": url,
        "role": link["role"],
        "expires_at": link["expires_at"],
        "created_at": link["created_at"],
    }


def get_share_links(doc_id: str, user_id: str) -> List[Dict]:
    _require_role(doc_id, user_id, "owner")
    links = store.get_share_links_for_doc(doc_id)
    return [
        {
            "token": l["token"],
            "url": f"/api/documents/via-link/{l['token']}",
            "role": l["role"],
            "expires_at": l.get("expires_at"),
            "created_at": l["created_at"],
        }
        for l in links
    ]


def get_doc_via_share_link(token: str, requesting_user: Optional[Dict]) -> Dict:
    link, doc = _get_valid_share_link(token)
    return _build_shared_doc_response(doc, link["role"])


def revoke_share_link(doc_id: str, token: str, user_id: str) -> None:
    _require_role(doc_id, user_id, "owner")
    if not store.revoke_share_link(token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found")
