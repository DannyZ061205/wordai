from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.auth.service import decode_token
from app.documents.service import _get_user_role
from app.storage.json_store import store
from app.websocket.manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{doc_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    doc_id: str,
    token: str = Query(..., description="JWT access token"),
):
    """
    WebSocket endpoint for real-time Yjs CRDT collaboration.

    Clients must pass a valid JWT access token as a query parameter because
    the WebSocket handshake does not support custom HTTP headers in browser
    environments.

    Message protocol:
    - Binary frames: raw Yjs update bytes (forwarded to all other clients)
    - Text frames: ignored (future: could handle JSON commands)
    """
    # 1. Validate token
    try:
        payload = decode_token(token)
    except HTTPException:
        await websocket.close(code=4001)
        return

    if payload.get("type", "access") != "access":
        await websocket.close(code=4001)
        return

    user_id: str = payload.get("sub", "")
    user = store.get_user(user_id)
    if not user:
        await websocket.close(code=4001)
        return

    # 2. Check document access
    role = _get_user_role(doc_id, user_id)
    if role is None:
        await websocket.close(code=4003)
        return

    # 3. Connect
    await manager.connect(websocket, doc_id, user_id, user["username"])

    try:
        while True:
            # Receive the next frame.  We accept both bytes (Yjs updates)
            # and text (future control messages).
            message = await websocket.receive()

            # Client closed the connection — exit cleanly.
            if message["type"] == "websocket.disconnect":
                break

            if "bytes" in message and message["bytes"] is not None:
                await manager.handle_yjs_message(doc_id, user_id, message["bytes"])
            # Text frames are currently ignored; extend here as needed.

    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket, doc_id, user_id)
