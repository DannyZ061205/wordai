from __future__ import annotations

import asyncio
import json
from typing import Dict, List, Optional

from fastapi import WebSocket

# ---------------------------------------------------------------------------
# Cursor colour palette (8 distinct colours)
# ---------------------------------------------------------------------------

_COLOUR_PALETTE = [
    "#F44336",  # red
    "#2196F3",  # blue
    "#4CAF50",  # green
    "#FF9800",  # orange
    "#9C27B0",  # purple
    "#00BCD4",  # cyan
    "#FF5722",  # deep-orange
    "#607D8B",  # blue-grey
]


class ConnectionManager:
    """
    Manages WebSocket connections for Yjs CRDT real-time sync.

    Message protocol (binary frames):
    - The client sends raw Yjs update bytes.
    - The server stores the cumulative update state and broadcasts it
      to all other connected clients in the same document room.

    Awareness (presence) messages are sent as JSON text frames:
        {"type": "awareness", "users": [...]}
    """

    def __init__(self) -> None:
        # doc_id -> { user_id -> WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

        # doc_id -> { user_id -> {"username": str, "color": str} }
        self.user_info: Dict[str, Dict[str, dict]] = {}

        # doc_id -> bytes  (latest Yjs document state)
        self.yjs_docs: Dict[str, bytes] = {}

    # ------------------------------------------------------------------
    # Connect / disconnect
    # ------------------------------------------------------------------

    async def connect(
        self,
        websocket: WebSocket,
        doc_id: str,
        user_id: str,
        username: str,
    ) -> None:
        await websocket.accept()

        if doc_id not in self.active_connections:
            self.active_connections[doc_id] = {}
            self.user_info[doc_id] = {}

        # Assign a deterministic colour from the palette
        existing_count = len(self.user_info[doc_id])
        color = _COLOUR_PALETTE[existing_count % len(_COLOUR_PALETTE)]

        self.active_connections[doc_id][user_id] = websocket
        self.user_info[doc_id][user_id] = {"username": username, "color": color}

        # Send current Yjs document state to the newly connected client
        current_state = self.yjs_docs.get(doc_id, b"")
        if current_state:
            await websocket.send_bytes(current_state)

        # Broadcast updated presence list to everyone (including the newcomer)
        await self._broadcast_presence(doc_id)

    async def disconnect(self, websocket: WebSocket, doc_id: str, user_id: str) -> None:
        connections = self.active_connections.get(doc_id, {})
        connections.pop(user_id, None)
        self.user_info.get(doc_id, {}).pop(user_id, None)

        if not connections:
            # Last user left — clean up the room but keep Yjs state in memory
            self.active_connections.pop(doc_id, None)
            self.user_info.pop(doc_id, None)
        else:
            await self._broadcast_presence(doc_id)

    # ------------------------------------------------------------------
    # Message handling
    # ------------------------------------------------------------------

    async def handle_yjs_message(
        self, doc_id: str, user_id: str, data: bytes
    ) -> None:
        """
        Process an incoming Yjs binary update from a client.

        The simplest correct approach: treat every incoming frame as a Yjs
        update, append it to the stored state, and broadcast it to all other
        clients.  This is sufficient for a PoC — production would use
        y-py (or yrs) to actually merge the CRDT states.
        """
        # Append the incoming update to our stored state
        existing = self.yjs_docs.get(doc_id, b"")
        self.yjs_docs[doc_id] = existing + data

        # Broadcast the raw update to all *other* clients in this document
        await self.broadcast(doc_id, data, exclude_user_id=user_id)

    async def broadcast(
        self,
        doc_id: str,
        message: bytes,
        exclude_user_id: Optional[str] = None,
    ) -> None:
        """Send a binary message to all connections in a document room."""
        connections = self.active_connections.get(doc_id, {})
        disconnected: List[str] = []

        for uid, ws in connections.items():
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_bytes(message)
            except Exception:
                disconnected.append(uid)

        for uid in disconnected:
            connections.pop(uid, None)
            self.user_info.get(doc_id, {}).pop(uid, None)

    async def broadcast_text(
        self,
        doc_id: str,
        message: str,
        exclude_user_id: Optional[str] = None,
    ) -> None:
        """Send a JSON text message to all connections in a document room."""
        connections = self.active_connections.get(doc_id, {})
        disconnected: List[str] = []

        for uid, ws in connections.items():
            if uid == exclude_user_id:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                disconnected.append(uid)

        for uid in disconnected:
            connections.pop(uid, None)
            self.user_info.get(doc_id, {}).pop(uid, None)

    # ------------------------------------------------------------------
    # Presence
    # ------------------------------------------------------------------

    def get_presence(self, doc_id: str) -> List[dict]:
        info = self.user_info.get(doc_id, {})
        return [
            {"user_id": uid, **meta}
            for uid, meta in info.items()
        ]

    def reset_yjs_state(self, doc_id: str) -> None:
        """Clear the stored Yjs state for a document (e.g. after a version restore)."""
        self.yjs_docs.pop(doc_id, None)

    async def _broadcast_presence(self, doc_id: str) -> None:
        presence = self.get_presence(doc_id)
        payload = json.dumps({"type": "awareness", "users": presence})
        await self.broadcast_text(doc_id, payload)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

manager = ConnectionManager()
