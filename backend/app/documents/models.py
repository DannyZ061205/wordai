from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    title: str
    content: str = ""


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class DocumentResponse(BaseModel):
    id: str
    title: str
    content: str
    owner_id: str
    owner_username: str
    created_at: str
    updated_at: str
    role: Literal["owner", "editor", "viewer"]


class DocumentListItem(BaseModel):
    id: str
    title: str
    owner_username: str
    updated_at: str
    role: Literal["owner", "editor", "viewer"]


class VersionResponse(BaseModel):
    id: str
    doc_id: str
    content: str
    created_at: str
    created_by_username: str
    version_number: int


class ShareCreate(BaseModel):
    user_identifier: str  # email or username
    role: Literal["editor", "viewer"]


class ShareRoleUpdate(BaseModel):
    role: Literal["editor", "viewer"]


class ShareLinkCreate(BaseModel):
    role: Literal["editor", "viewer"]
    expires_in_days: Optional[int] = None


class ShareResponse(BaseModel):
    user_id: str
    username: str
    email: str
    role: Literal["editor", "viewer"]


class ShareLinkResponse(BaseModel):
    token: str
    url: str
    role: Literal["editor", "viewer"]
    expires_at: Optional[str]
    created_at: str
