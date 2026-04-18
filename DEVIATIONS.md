# Architecture Deviations from Assignment 1 Design

This document records every difference between the Assignment 1 architecture document and the final
implementation, explaining what changed, why, and whether the change was an improvement or a
compromise.

---

## 1. Storage: JSON File Persistence Instead of PostgreSQL

**A1 Design**: A relational database (PostgreSQL) was specified for all persistent data.

**A2 Implementation**: All data is stored in JSON files on disk (`backend/data/`), managed by a
thread-safe in-memory store (`backend/app/storage/json_store.py`) that periodically flushes to disk.

**Why**: The assignment explicitly permits file-based persistence for a PoC. Removing the database
dependency eliminates infrastructure setup, making the project runnable with a single `pip install`
and no Docker/Postgres service. All data contracts (documents, users, versions, AI history) are
unchanged — only the storage layer differs.

**Verdict**: Improvement for the PoC scope. In production, the storage interface would be swapped for
a real database without touching the service or router layers.

---

## 2. Real-Time Sync: Simple HTML Broadcast (Last-Write-Wins)

**A1 Design**: A basic operational-transform or last-write-wins approach was outlined for
concurrent editing.

**A2 Implementation**: A minimal JSON WebSocket protocol. Each client debounces local edits
through a leading-edge throttle (~80 ms) and broadcasts `{ "type": "edit", "html": "...",
"origin": "<clientId>" }`. The FastAPI backend (`backend/app/websocket/manager.py`) is a pure
JSON relay — it forwards every frame to all other clients in the same document room without
parsing the payload. Receivers apply the incoming HTML via `editor.commands.setContent(...)`
while preserving the caret position. Presence is broadcast separately as
`{ "type": "awareness", "users": [...] }` whenever someone connects or disconnects.

**Why we moved here from Yjs**: An earlier implementation used Tiptap's `Collaboration`
extension on top of `y-websocket`. The extension silently failed to push local edits through
the socket in our setup (no `sync-update` frames ever reached the server), so other tabs
only saw changes after a manual refresh. Several hours of debugging the Yjs / y-websocket /
Tiptap boundary made it clear that the right trade-off for this PoC was a simpler protocol
we fully understand, rather than a CRDT stack we can't confidently reason about.

**Trade-offs**:
- ✅ Real-time sync is reliable: typing in one tab appears in other tabs within ~100 ms.
- ✅ The backend is trivial to reason about and to test.
- ✅ HTTP auto-save still runs in parallel, so content is durable on the server.
- ❌ Conflict semantics are **last-writer-wins** on a per-broadcast-window basis. Two users
  typing into the *same paragraph* simultaneously will overwrite each other. This is the
  baseline the assignment explicitly allows; the CRDT bonus is not claimed.

**Verdict**: Compromise in terms of conflict resolution (we lost the CRDT bonus), but a
clear improvement in reliability, debuggability, and code volume.

---

## 3. AI Provider: Multi-Provider Abstraction Instead of Single Provider

**A1 Design**: A single LLM provider (OpenAI) was specified.

**A2 Implementation**: An abstraction layer (`backend/app/ai/service.py`) supports DeepSeek,
OpenAI, Grok (xAI), Anthropic Claude, and custom OpenAI-compatible endpoints. Provider selection
and API key storage is per-user, configurable through the AI Settings modal. All non-Claude
providers use the `openai` SDK (OpenAI-compatible API); Claude uses the `anthropic` SDK.

**Why**: Switching providers should require changes in one place (assignment requirement 3.4). The
abstraction makes this trivially true. Users can supply their own API keys, removing the need for
project-level API key management.

**Verdict**: Improvement. Meets the provider-abstraction requirement and increases user flexibility.

---

## 4. Ghost-Text Autocomplete Feature Added

**A1 Design**: The six AI features (rewrite, summarize, translate, expand, grammar, custom) were
specified. Autocomplete was not in the A1 design.

**A2 Implementation**: A ghost-text autocomplete feature (`frontend/src/hooks/useGhostText.ts`)
triggers automatically after 6 seconds of typing inactivity. The suggestion appears as grey inline
text; Tab accepts it, Escape dismisses it.

**Why**: Ghost-text autocomplete is a standard feature of modern AI editors (GitHub Copilot, Notion
AI). It was straightforward to add as a streaming AI call with the existing infrastructure.

**Verdict**: Improvement. Adds value without breaking any existing contract.

---

## 5. Share-by-Link Added

**A1 Design**: Sharing was specified as email/username-only with role assignment.

**A2 Implementation**: In addition to email/username sharing, owners can generate a shareable link
with a configurable permission level (viewer or editor). Links can be revoked. This earns the
share-by-link bonus points.

**Why**: Link-based sharing is a common pattern (Google Docs) that requires minimal backend work
(a token lookup in the document store). The existing role-enforcement code is reused unchanged.

**Verdict**: Improvement.

---

## 6. AI Interaction History: JSON Log Instead of Database Table

**A1 Design**: AI interaction history was to be stored in the database.

**A2 Implementation**: Every AI interaction is appended to `backend/data/ai_history.json` via the
same JSON store used for all other data. The schema is identical to what was specified in A1.

**Why**: Consistent with deviation #1 (no database). The log is queryable per-document and
per-user.

**Verdict**: Consistent compromise — acceptable for PoC scope.

---

## 7. Version History: Snapshot-on-Save Instead of OT Log

**A1 Design**: Version history was described as an append-only operation log (similar to OT).

**A2 Implementation**: Each auto-save or explicit save creates a full document snapshot stored in
`backend/data/versions.json`. Restore replaces the current document content with the snapshot.

**Why**: Full snapshots are simpler to implement, sufficient for the version-history requirement, and
avoid the complexity of replaying an OT log. Storage overhead is acceptable for a PoC with small
documents.

**Verdict**: Compromise for simplicity. Production would use delta-based storage.

---

## 8. Token Refresh: Silent Axios Interceptor Instead of Explicit UI Prompt

**A1 Design**: Token expiration handling was described as showing a "session expired" modal.

**A2 Implementation**: An Axios request interceptor (`frontend/src/api/axios.ts`) catches 401
responses, silently calls `/api/auth/refresh` with the stored refresh token, and retries the
original request. The user never sees a modal or a raw 401 error during normal editing.

**Why**: Silent refresh is a strictly better user experience. The modal approach breaks collaborative
editing sessions on expiry — the Axios interceptor is transparent and maintains editor state.

**Verdict**: Improvement.
