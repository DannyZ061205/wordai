from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.ai.models import AIInteractionResponse, AIInteractionUpdate, AIRequest
from app.ai.service import record_interaction_outcome, stream_ai_response
from app.documents.service import _get_user_role
from app.middleware.auth import get_current_user
from app.storage.json_store import store

router = APIRouter(prefix="/api/ai", tags=["ai"])


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
    current_user: dict = Depends(get_current_user),
):
    """
    Stream an AI response using Server-Sent Events.

    Each SSE event has the shape:
        data: {"chunk": "...", "done": false}
        ...
        data: {"chunk": "", "done": true, "interaction_id": "<uuid>"}
    """
    _require_editor_plus(doc_id, current_user["id"])

    async def event_generator():
        async for chunk in stream_ai_response(request, doc_id, current_user["id"]):
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
    current_user: dict = Depends(get_current_user),
):
    """Record whether the user accepted or rejected the AI suggestion."""
    role = _get_user_role(doc_id, current_user["id"])
    if role is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
    current_user: dict = Depends(get_current_user),
):
    """Return the AI interaction history for a document."""
    role = _get_user_role(doc_id, current_user["id"])
    if role is None:
        doc = store.get_document(doc_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
