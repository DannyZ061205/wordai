from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.auth.service import decode_token
from app.documents.service import _get_user_role, get_doc_via_share_link
from app.storage.json_store import store
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{doc_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    doc_id: str,
    token: Optional[str] = Query(None),
    share_token: Optional[str] = Query(None),
):
    user_id: str | None = None
    username: str = "Guest"

    # --- Auth via JWT ---
    if token:
        try:
            payload = decode_token(token)
            if payload.get("type", "access") == "access":
                uid = payload.get("sub", "")
                user = store.get_user(uid)
                if user:
                    user_id = uid
                    username = user["username"]
        except Exception:
            pass

    # --- Auth via share link token ---
    if not user_id and share_token:
        try:
            # Reuse the existing share link lookup — it validates expiry etc.
            doc = get_doc_via_share_link(share_token, None)
            if doc and doc["id"] == doc_id:
                # Give them a stable guest ID derived from share token
                user_id = f"guest_{share_token[:8]}"
                username = "Guest"
        except Exception:
            pass

    if not user_id:
        await websocket.close(code=4001)
        return

    # Check document access (owners/editors/viewers all get read, guests via share link too)
    role = _get_user_role(doc_id, user_id)
    if role is None and not share_token:
        await websocket.close(code=4003)
        return

    await manager.connect(websocket, doc_id, user_id, username)

    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            if "bytes" in message and message["bytes"] is not None:
                await manager.handle_yjs_message(doc_id, user_id, message["bytes"])
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket, doc_id, user_id)