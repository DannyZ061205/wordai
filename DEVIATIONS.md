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

## 2. Real-Time Sync: Yjs CRDTs Instead of Last-Write-Wins

**A1 Design**: A basic operational-transform or last-write-wins approach was outlined for
concurrent editing.

**A2 Implementation**: Yjs (a CRDT library) is used over a `y-websocket` relay. The backend
WebSocket handler (`backend/app/websocket/`) is a pure binary relay — it does not parse Yjs
messages. All conflict resolution happens in the client-side Yjs runtime.

**Why**: Yjs provides character-level conflict resolution with no data loss under concurrent edits —
strictly better than last-write-wins. The relay-only backend is simpler than an OT server and more
correct. This also earns the CRDT bonus points.

**Verdict**: Improvement. Zero data loss, simpler backend, industry-standard approach.

---

## 3. Cursor Tracking: CollaborationCursor Extension Added

**A1 Design**: Presence was limited to a "who is online" list (the baseline).

**A2 Implementation**: Full remote cursor and selection tracking using Tiptap's
`CollaborationCursor` extension and Yjs awareness protocol, rendering each collaborator's cursor in
a distinct color with a name label.

**Why**: The Yjs awareness protocol already carries cursor position data at no extra cost. Rendering
it in Tiptap required only the `CollaborationCursor` extension. This earns the cursor-tracking bonus
points.

**Verdict**: Improvement. No architectural cost; pure feature addition.

---

## 4. AI Provider: Multi-Provider Abstraction Instead of Single Provider

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

## 5. Ghost-Text Autocomplete Feature Added

**A1 Design**: The six AI features (rewrite, summarize, translate, expand, grammar, custom) were
specified. Autocomplete was not in the A1 design.

**A2 Implementation**: A ghost-text autocomplete feature (`frontend/src/hooks/useGhostText.ts`)
triggers automatically after 6 seconds of typing inactivity. The suggestion appears as grey inline
text; Tab accepts it, Escape dismisses it.

**Why**: Ghost-text autocomplete is a standard feature of modern AI editors (GitHub Copilot, Notion
AI). It was straightforward to add as a streaming AI call with the existing infrastructure.

**Verdict**: Improvement. Adds value without breaking any existing contract.

---

## 6. Share-by-Link Added

**A1 Design**: Sharing was specified as email/username-only with role assignment.

**A2 Implementation**: In addition to email/username sharing, owners can generate a shareable link
with a configurable permission level (viewer or editor). Links can be revoked. This earns the
share-by-link bonus points.

**Why**: Link-based sharing is a common pattern (Google Docs) that requires minimal backend work
(a token lookup in the document store). The existing role-enforcement code is reused unchanged.

**Verdict**: Improvement.

---

## 7. AI Interaction History: JSON Log Instead of Database Table

**A1 Design**: AI interaction history was to be stored in the database.

**A2 Implementation**: Every AI interaction is appended to `backend/data/ai_history.json` via the
same JSON store used for all other data. The schema is identical to what was specified in A1.

**Why**: Consistent with deviation #1 (no database). The log is queryable per-document and
per-user.

**Verdict**: Consistent compromise — acceptable for PoC scope.

---

## 8. Version History: Snapshot-on-Save Instead of OT Log

**A1 Design**: Version history was described as an append-only operation log (similar to OT).

**A2 Implementation**: Each auto-save or explicit save creates a full document snapshot stored in
`backend/data/versions.json`. Restore replaces the current document content with the snapshot.

**Why**: Full snapshots are simpler to implement, sufficient for the version-history requirement, and
avoid the complexity of replaying an OT log. Storage overhead is acceptable for a PoC with small
documents.

**Verdict**: Compromise for simplicity. Production would use delta-based storage.

---

## 9. Token Refresh: Silent Axios Interceptor Instead of Explicit UI Prompt

**A1 Design**: Token expiration handling was described as showing a "session expired" modal.

**A2 Implementation**: An Axios request interceptor (`frontend/src/api/axios.ts`) catches 401
responses, silently calls `/api/auth/refresh` with the stored refresh token, and retries the
original request. The user never sees a modal or a raw 401 error during normal editing.

**Why**: Silent refresh is a strictly better user experience. The modal approach breaks collaborative
editing sessions on expiry — the Axios interceptor is transparent and maintains editor state.

**Verdict**: Improvement.
