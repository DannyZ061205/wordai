from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends

from app.documents.models import (
    DocumentCreate,
    DocumentListItem,
    DocumentResponse,
    DocumentUpdate,
    ShareCreate,
    ShareLinkCreate,
    ShareLinkResponse,
    ShareResponse,
    ShareRoleUpdate,
    VersionResponse,
)
from app.documents.service import (
    create_document,
    create_share_link,
    delete_document,
    get_doc_via_share_link,
    get_document,
    get_share_links,
    get_shares,
    get_versions,
    list_documents,
    remove_share,
    restore_version,
    revoke_share_link,
    share_document,
    update_document,
    update_share_role,
)
from app.middleware.auth import get_current_user, get_optional_user
from app.websocket.manager import manager

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ---------------------------------------------------------------------------
# Document CRUD
# ---------------------------------------------------------------------------

@router.get("/", response_model=List[DocumentListItem])
async def list_docs(current_user: dict = Depends(get_current_user)):
    return list_documents(current_user["id"])


@router.post("/", response_model=DocumentResponse, status_code=201)
async def create_doc(body: DocumentCreate, current_user: dict = Depends(get_current_user)):
    return create_document(body.title, current_user["id"])


@router.get("/via-link/{token}", response_model=DocumentResponse)
async def doc_via_link(token: str, current_user: Optional[dict] = Depends(get_optional_user)):
    """Access a document using a share link. Authentication is optional."""
    return get_doc_via_share_link(token, current_user)


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    return get_document(doc_id, current_user["id"])


@router.patch("/{doc_id}", response_model=DocumentResponse)
async def update_doc(
    doc_id: str,
    body: DocumentUpdate,
    current_user: dict = Depends(get_current_user),
):
    return update_document(doc_id, current_user["id"], body.model_dump())


@router.delete("/{doc_id}", status_code=204)
async def delete_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    delete_document(doc_id, current_user["id"])


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/versions", response_model=List[VersionResponse])
async def list_versions(doc_id: str, current_user: dict = Depends(get_current_user)):
    return get_versions(doc_id, current_user["id"])


@router.post("/{doc_id}/versions/{version_id}/restore", response_model=DocumentResponse)
async def restore_doc_version(
    doc_id: str,
    version_id: str,
    current_user: dict = Depends(get_current_user),
):
    doc = restore_version(doc_id, version_id, current_user["id"])
    # Clear stale Yjs state so reconnecting clients load the restored content
    manager.reset_yjs_state(doc_id)
    return doc


# ---------------------------------------------------------------------------
# Shares
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/shares", response_model=List[ShareResponse])
async def list_shares(doc_id: str, current_user: dict = Depends(get_current_user)):
    return get_shares(doc_id, current_user["id"])


@router.post("/{doc_id}/shares", response_model=ShareResponse, status_code=201)
async def add_share(
    doc_id: str,
    body: ShareCreate,
    current_user: dict = Depends(get_current_user),
):
    return share_document(doc_id, current_user["id"], body.user_identifier, body.role)


@router.delete("/{doc_id}/shares/{target_user_id}", status_code=204)
async def delete_share(
    doc_id: str,
    target_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    remove_share(doc_id, target_user_id, current_user["id"])


@router.patch("/{doc_id}/shares/{target_user_id}", response_model=ShareResponse)
async def patch_share_role(
    doc_id: str,
    target_user_id: str,
    body: ShareRoleUpdate,
    current_user: dict = Depends(get_current_user),
):
    return update_share_role(doc_id, target_user_id, current_user["id"], body.role)


# ---------------------------------------------------------------------------
# Share links
# ---------------------------------------------------------------------------

@router.post("/{doc_id}/share-links", response_model=ShareLinkResponse, status_code=201)
async def create_link(
    doc_id: str,
    body: ShareLinkCreate,
    current_user: dict = Depends(get_current_user),
):
    return create_share_link(doc_id, current_user["id"], body.role, body.expires_in_days)


@router.get("/{doc_id}/share-links", response_model=List[ShareLinkResponse])
async def list_links(doc_id: str, current_user: dict = Depends(get_current_user)):
    return get_share_links(doc_id, current_user["id"])


@router.delete("/{doc_id}/share-links/{token}", status_code=204)
async def delete_link(
    doc_id: str,
    token: str,
    current_user: dict = Depends(get_current_user),
):
    revoke_share_link(doc_id, token, current_user["id"])
