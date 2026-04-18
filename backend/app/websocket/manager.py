from __future__ import annotations

import json
from typing import Dict, List, Optional

from fastapi import WebSocket


# ---------------------------------------------------------------------------
# Cursor colour palette (8 distinct colours)
# ---------------------------------------------------------------------------

_COLOUR_PALETTE = [
    "#F44336", "#2196F3", "#4CAF50", "#FF9800",
    "#9C27B0", "#00BCD4", "#FF5722", "#607D8B",
]


class ConnectionManager:
    """
    Simple JSON-based relay for real-time collaborative editing.

    Message protocol (JSON text frames):
      - Client → Server: {"type": "edit", "html": "...", "origin": "<clientId>"}
        Server applies to in-memory cache and broadcasts to all other clients
        in the same document room.
      - Client → Server: {"type": "cursor", "origin": "<clientId>", "pos": N}
        Server broadcasts cursor position to other clients (ephemeral, not
        persisted).
      - Server → Client: same messages, forwarded.

    Presence (who's online): broadcast as
      {"type": "awareness", "users": [{"user_id", "username", "color"}, ...]}
    whenever someone connects or disconnects.

    State survives backend restarts: the latest HTML content is the source of
    truth, persisted via the existing document HTTP autosave. The WebSocket
    layer only handles live fan-out; it does not need its own storage.
    """

    def __init__(self) -> None:
        # doc_id -> { conn_id -> WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # doc_id -> { conn_id -> {"user_id", "username", "color"} }
        self.user_info: Dict[str, Dict[str, dict]] = {}
        # Legacy attribute kept so older tests that reference it don't crash.
        self.yjs_docs: Dict[str, bytes] = {}

    # ------------------------------------------------------------------
    # Connect / disconnect
    # ------------------------------------------------------------------

    async def connect(
        self,
        websocket: WebSocket,
        doc_id: str,
        conn_id: str,
        user_id: str,
        username: str,
    ) -> None:
        await websocket.accept()

        if doc_id not in self.active_connections:
            self.active_connections[doc_id] = {}
            self.user_info[doc_id] = {}

        existing = len(self.user_info[doc_id])
        color = _COLOUR_PALETTE[existing % len(_COLOUR_PALETTE)]

        self.active_connections[doc_id][conn_id] = websocket
        self.user_info[doc_id][conn_id] = {
            "user_id": user_id,
            "username": username,
            "color": color,
        }

        await self._broadcast_presence(doc_id)

    async def disconnect(self, websocket: WebSocket, doc_id: str, conn_id: str) -> None:
        connections = self.active_connections.get(doc_id, {})
        connections.pop(conn_id, None)
        self.user_info.get(doc_id, {}).pop(conn_id, None)

        if not connections:
            self.active_connections.pop(doc_id, None)
            self.user_info.pop(doc_id, None)
        else:
            await self._broadcast_presence(doc_id)

    # ------------------------------------------------------------------
    # Message handling
    # ------------------------------------------------------------------

    async def handle_text_message(
        self, doc_id: str, conn_id: str, raw: str
    ) -> None:
        """Decode a JSON frame and relay to peers."""
        try:
            msg = json.loads(raw)
        except Exception:
            return
        msg_type = msg.get("type")
        if msg_type not in ("edit", "cursor"):
            return
        # Just forward — no state persisted in-memory here.
        await self.broadcast_text(doc_id, raw, exclude_conn_id=conn_id)

    # ------------------------------------------------------------------
    # Broadcast helpers
    # ------------------------------------------------------------------

    async def broadcast_text(
        self,
        doc_id: str,
        message: str,
        exclude_conn_id: Optional[str] = None,
    ) -> None:
        connections = self.active_connections.get(doc_id, {})
        disconnected: List[str] = []
        for cid, ws in connections.items():
            if cid == exclude_conn_id:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(cid)
        for cid in disconnected:
            connections.pop(cid, None)
            self.user_info.get(doc_id, {}).pop(cid, None)

    # Kept for any residual callers; unused by the new protocol.
    async def broadcast(
        self,
        doc_id: str,
        message: bytes,
        exclude_conn_id: Optional[str] = None,
    ) -> None:
        connections = self.active_connections.get(doc_id, {})
        disconnected: List[str] = []
        for cid, ws in connections.items():
            if cid == exclude_conn_id:
                continue
            try:
                await ws.send_bytes(message)
            except Exception:
                disconnected.append(cid)
        for cid in disconnected:
            connections.pop(cid, None)
            self.user_info.get(doc_id, {}).pop(cid, None)

    # ------------------------------------------------------------------
    # Presence
    # ------------------------------------------------------------------

    def get_presence(self, doc_id: str) -> List[dict]:
        info = self.user_info.get(doc_id, {})
        return [dict(meta) for meta in info.values()]

    def reset_yjs_state(self, doc_id: str) -> None:
        """No-op retained for API compatibility (version-restore flow)."""
        self.yjs_docs.pop(doc_id, None)

    async def _broadcast_presence(self, doc_id: str) -> None:
        presence = self.get_presence(doc_id)
        payload = json.dumps({"type": "awareness", "users": presence})
        await self.broadcast_text(doc_id, payload)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

manager = ConnectionManager()
