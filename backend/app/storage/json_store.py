from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: str) -> Any:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def _dump_json(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# JSONStore
# ---------------------------------------------------------------------------

class JSONStore:
    """Simple file-backed in-memory store.

    All mutating operations acquire a threading.Lock before modifying
    in-memory state and (optionally) flushing to disk, so the store is
    safe to use from multiple threads.
    """

    def __init__(self, data_dir: str) -> None:
        self._data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

        self._lock = threading.Lock()

        # In-memory collections
        self._users: Dict[str, Dict] = {}          # user_id -> user dict
        self._documents: Dict[str, Dict] = {}      # doc_id -> doc dict
        self._document_versions: Dict[str, Dict] = {}  # version_id -> version dict
        self._shares: Dict[str, Dict] = {}         # share_id -> share dict
        self._share_links: Dict[str, Dict] = {}    # token -> link dict
        self._ai_history: Dict[str, Dict] = {}     # interaction_id -> interaction dict
        self._ai_settings: Dict[str, Dict] = {}    # user_id -> ai provider settings

        self.load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _path(self, name: str) -> str:
        return os.path.join(self._data_dir, f"{name}.json")

    def save(self) -> None:
        with self._lock:
            _dump_json(self._path("users"), self._users)
            _dump_json(self._path("documents"), self._documents)
            _dump_json(self._path("document_versions"), self._document_versions)
            _dump_json(self._path("shares"), self._shares)
            _dump_json(self._path("share_links"), self._share_links)
            _dump_json(self._path("ai_history"), self._ai_history)
            _dump_json(self._path("ai_settings"), self._ai_settings)

    def load(self) -> None:
        with self._lock:
            self._users = _load_json(self._path("users")) or {}
            self._documents = _load_json(self._path("documents")) or {}
            self._document_versions = _load_json(self._path("document_versions")) or {}
            self._shares = _load_json(self._path("shares")) or {}
            self._share_links = _load_json(self._path("share_links")) or {}
            self._ai_history = _load_json(self._path("ai_history")) or {}
            self._ai_settings = _load_json(self._path("ai_settings")) or {}

    def _flush(self) -> None:
        """Write all collections to disk (called while lock is held)."""
        _dump_json(self._path("users"), self._users)
        _dump_json(self._path("documents"), self._documents)
        _dump_json(self._path("document_versions"), self._document_versions)
        _dump_json(self._path("shares"), self._shares)
        _dump_json(self._path("share_links"), self._share_links)
        _dump_json(self._path("ai_history"), self._ai_history)
        _dump_json(self._path("ai_settings"), self._ai_settings)

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------

    def get_user(self, user_id: str) -> Optional[Dict]:
        return self._users.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        email_lower = email.lower()
        for user in self._users.values():
            if user.get("email", "").lower() == email_lower:
                return user
        return None

    def get_user_by_username(self, username: str) -> Optional[Dict]:
        username_lower = username.lower()
        for user in self._users.values():
            if user.get("username", "").lower() == username_lower:
                return user
        return None

    def create_user(self, user_data: Dict) -> Dict:
        with self._lock:
            self._users[user_data["id"]] = user_data
            self._flush()
        return user_data

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    def get_document(self, doc_id: str) -> Optional[Dict]:
        return self._documents.get(doc_id)

    def get_documents_for_user(self, user_id: str) -> List[Dict]:
        """Return documents owned by or explicitly shared with user_id."""
        result = []

        # Collect doc_ids shared with the user
        shared_doc_ids = set()
        for share in self._shares.values():
            if share.get("user_id") == user_id:
                shared_doc_ids.add(share.get("doc_id"))

        for doc in self._documents.values():
            if doc.get("owner_id") == user_id or doc.get("id") in shared_doc_ids:
                result.append(doc)

        return result

    def create_document(self, doc_data: Dict) -> Dict:
        with self._lock:
            self._documents[doc_data["id"]] = doc_data
            self._flush()
        return doc_data

    def update_document(self, doc_id: str, updates: Dict) -> Optional[Dict]:
        with self._lock:
            doc = self._documents.get(doc_id)
            if doc is None:
                return None
            doc.update(updates)
            doc["updated_at"] = _now_iso()
            self._flush()
        return doc

    def delete_document(self, doc_id: str) -> bool:
        with self._lock:
            if doc_id not in self._documents:
                return False
            del self._documents[doc_id]
            # Cascade: remove versions, shares, share links, ai history
            for vid in [k for k, v in self._document_versions.items() if v.get("doc_id") == doc_id]:
                del self._document_versions[vid]
            for sid in [k for k, v in self._shares.items() if v.get("doc_id") == doc_id]:
                del self._shares[sid]
            for tok in [k for k, v in self._share_links.items() if v.get("doc_id") == doc_id]:
                del self._share_links[tok]
            for aid in [k for k, v in self._ai_history.items() if v.get("doc_id") == doc_id]:
                del self._ai_history[aid]
            self._flush()
        return True

    # ------------------------------------------------------------------
    # Versions
    # ------------------------------------------------------------------

    def create_version(self, version_data: Dict) -> Dict:
        with self._lock:
            self._document_versions[version_data["id"]] = version_data
            self._flush()
        return version_data

    def get_versions(self, doc_id: str) -> List[Dict]:
        versions = [v for v in self._document_versions.values() if v.get("doc_id") == doc_id]
        return sorted(versions, key=lambda v: v.get("version_number", 0))

    def get_version(self, version_id: str) -> Optional[Dict]:
        return self._document_versions.get(version_id)

    # ------------------------------------------------------------------
    # Shares (user-to-doc)
    # ------------------------------------------------------------------

    def get_share(self, doc_id: str, user_id: str) -> Optional[Dict]:
        for share in self._shares.values():
            if share.get("doc_id") == doc_id and share.get("user_id") == user_id:
                return share
        return None

    def get_shares_for_doc(self, doc_id: str) -> List[Dict]:
        return [s for s in self._shares.values() if s.get("doc_id") == doc_id]

    def create_share(self, share_data: Dict) -> Dict:
        with self._lock:
            self._shares[share_data["id"]] = share_data
            self._flush()
        return share_data

    def update_share(self, share_id: str, updates: Dict) -> Optional[Dict]:
        with self._lock:
            share = self._shares.get(share_id)
            if share is None:
                return None
            share.update(updates)
            self._flush()
        return share

    def delete_share(self, share_id: str) -> bool:
        with self._lock:
            if share_id not in self._shares:
                return False
            del self._shares[share_id]
            self._flush()
        return True

    # ------------------------------------------------------------------
    # Share Links (token-based)
    # ------------------------------------------------------------------

    def create_share_link(self, link_data: Dict) -> Dict:
        with self._lock:
            self._share_links[link_data["token"]] = link_data
            self._flush()
        return link_data

    def get_share_link(self, token: str) -> Optional[Dict]:
        return self._share_links.get(token)

    def get_share_links_for_doc(self, doc_id: str) -> List[Dict]:
        return [l for l in self._share_links.values() if l.get("doc_id") == doc_id]

    def revoke_share_link(self, token: str) -> bool:
        with self._lock:
            if token not in self._share_links:
                return False
            del self._share_links[token]
            self._flush()
        return True

    # ------------------------------------------------------------------
    # AI History
    # ------------------------------------------------------------------

    def create_ai_interaction(self, data: Dict) -> Dict:
        with self._lock:
            self._ai_history[data["id"]] = data
            self._flush()
        return data

    def get_ai_interaction(self, interaction_id: str) -> Optional[Dict]:
        return self._ai_history.get(interaction_id)

    def update_ai_interaction(self, interaction_id: str, updates: Dict) -> Optional[Dict]:
        with self._lock:
            interaction = self._ai_history.get(interaction_id)
            if interaction is None:
                return None
            interaction.update(updates)
            self._flush()
        return interaction

    def get_ai_history(self, doc_id: str) -> List[Dict]:
        interactions = [i for i in self._ai_history.values() if i.get("doc_id") == doc_id]
        return sorted(interactions, key=lambda i: i.get("created_at", ""), reverse=True)

    # ------------------------------------------------------------------
    # AI Settings (per-user provider configuration)
    # ------------------------------------------------------------------

    def get_ai_settings(self, user_id: str) -> Optional[Dict]:
        return self._ai_settings.get(user_id)

    def upsert_ai_settings(self, user_id: str, settings_data: Dict) -> Dict:
        with self._lock:
            self._ai_settings[user_id] = settings_data
            self._flush()
        return settings_data

    def delete_ai_settings(self, user_id: str) -> bool:
        with self._lock:
            if user_id not in self._ai_settings:
                return False
            del self._ai_settings[user_id]
            self._flush()
        return True


# ---------------------------------------------------------------------------
# Global singleton — imported by the rest of the app
# ---------------------------------------------------------------------------

from app.config import settings  # noqa: E402  (avoid circular at module level)

store = JSONStore(data_dir=settings.data_dir)
