from __future__ import annotations

from typing import List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from app.ai.models import AIInteractionResponse, AIInteractionUpdate, AIRequest
from app.ai.service import record_interaction_outcome, stream_ai_response
from app.auth.service import decode_token
from app.documents.service import _get_user_role, get_doc_via_share_link
from app.middleware.auth import get_current_user
from app.storage.json_store import store

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _resolve_actor(
    request: Request,
    doc_id: str,
    share_token: Optional[str],
) -> Tuple[str, str]:
    """
    Resolve (user_id, role) for an AI call.

    Accepts either a JWT (Authorization: Bearer ...) or a share_token query
    parameter. Returns 401/403 on auth/access failures. Role must be at
    least "editor".
    """
    _rank = {"viewer": 0, "editor": 1, "owner": 2}

    # 1) Try JWT
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(None, 1)[1].strip()
        try:
            payload = decode_token(token)
            if payload.get("type", "access") == "access":
                uid = payload.get("sub", "")
                user = store.get_user(uid)
                if user:
                    role = _get_user_role(doc_id, uid)
                    if role is None:
                        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
                    if _rank[role] < _rank["editor"]:
                        raise HTTPException(
                            status.HTTP_403_FORBIDDEN,
                            "Editor or owner role required to use AI features",
                        )
                    return uid, role
        except HTTPException:
            raise
        except Exception:
            pass  # fall through to share-token path

    # 2) Try share-link token
    if share_token:
        link_doc = get_doc_via_share_link(share_token, None)
        if link_doc and link_doc["id"] == doc_id:
            link_role = link_doc.get("role")
            if link_role and _rank.get(link_role, -1) >= _rank["editor"]:
                # Stable pseudo user-id for this guest session
                return f"guest_{share_token[:8]}", link_role
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "This share link is view-only",
            )

    raise HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _require_editor_plus(doc_id: str, user_id: str) -> None:
    """Raise 403 if user is only a viewer or has no access."""
    _rank = {"viewer": 0, "editor": 1, "owner": 2}
    role = _get_user_role(doc_id, user_id)
    if role is None:
        doc = store.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if _rank.get(role, -1) < _rank["editor"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor or owner role required to use AI features",
        )


@router.post("/{doc_id}/stream")
async def ai_stream(
    doc_id: str,
    request: AIRequest,
    req: Request,
    share_token: Optional[str] = Query(None),
):
    """
    Stream an AI response using Server-Sent Events.

    Accepts either JWT (Authorization header) or a share-link token
    (share_token query param, editor role only).
    """
    user_id, _ = _resolve_actor(req, doc_id, share_token)

    async def event_generator():
        async for chunk in stream_ai_response(request, doc_id, user_id):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{doc_id}/interactions/{interaction_id}/outcome", response_model=AIInteractionResponse)
async def record_outcome(
    doc_id: str,
    interaction_id: str,
    body: AIInteractionUpdate,
    req: Request,
    share_token: Optional[str] = Query(None),
):
    """Record whether the user accepted or rejected the AI suggestion."""
    _resolve_actor(req, doc_id, share_token)  # raises on failure

    interaction = store.get_ai_interaction(interaction_id)
    if not interaction or interaction.get("doc_id") != doc_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interaction not found")

    updated = record_interaction_outcome(interaction_id, body.accepted, body.applied_text)
    return AIInteractionResponse(
        id=updated["id"],
        doc_id=updated["doc_id"],
        feature=updated["feature"],
        input_text=updated["input_text"],
        prompt_used=updated["prompt_used"],
        response_text=updated["response_text"],
        accepted=updated.get("accepted"),
        created_at=updated["created_at"],
    )


@router.get("/{doc_id}/history", response_model=List[AIInteractionResponse])
async def ai_history(
    doc_id: str,
    req: Request,
    share_token: Optional[str] = Query(None),
):
    """Return the AI interaction history for a document."""
    _resolve_actor(req, doc_id, share_token)  # raises on failure

    interactions = store.get_ai_history(doc_id)
    return [
        AIInteractionResponse(
            id=i["id"],
            doc_id=i["doc_id"],
            feature=i["feature"],
            input_text=i["input_text"],
            prompt_used=i["prompt_used"],
            response_text=i["response_text"],
            accepted=i.get("accepted"),
            created_at=i["created_at"],
        )
        for i in interactions
    ]
