from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel


class AIFeature(str, Enum):
    rewrite = "rewrite"
    summarize = "summarize"
    translate = "translate"
    expand = "expand"
    grammar = "grammar"
    custom = "custom"
    autocomplete = "autocomplete"


class AIRequest(BaseModel):
    feature: AIFeature
    selected_text: str
    context_before: Optional[str] = ""
    context_after: Optional[str] = ""
    # Feature-specific options:
    #   rewrite: tone
    #   summarize: format, length
    #   translate: target_language
    #   custom: instruction
    options: Dict[str, Any] = {}


class AIInteractionUpdate(BaseModel):
    accepted: bool
    applied_text: Optional[str] = None


class AIInteractionResponse(BaseModel):
    id: str
    doc_id: str
    feature: str
    input_text: str
    prompt_used: str
    response_text: str
    accepted: Optional[bool]
    created_at: str
