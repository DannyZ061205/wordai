# wordAI — Session Handoff Document
> For the next Claude Code session. Start Claude Code with the `wordai/` directory as the project root.

---

## 1. Project Overview

**wordAI** is a real-time collaborative document editor with an integrated AI writing assistant.
Built for AI1220 Assignment 2 at MBZUAI.

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS, at `frontend/`
- **Backend**: FastAPI + Python, at `backend/`
- **Repo**: https://github.com/DannyZ061205/wordai (branch: `main`)
- **Dev servers**: frontend at `http://localhost:5173`, backend at `http://localhost:8000`

---

## 2. IMPORTANT: Session Setup

**Always start Claude Code from the `wordai/` directory**, not from a parent folder like `Assignment 1`.
The preview tool (`.claude/launch.json`) is sandboxed to the project root — it will fail if rooted elsewhere.

```bash
cd ".../Assignment 2/wordai"
claude
```

The `frontend/.claude/launch.json` is already configured to start Vite on port 5173 using the absolute node path at `/opt/homebrew/bin/node`.

---

## 3. Assignment Requirements vs. Implementation Status

### Part 1: Core Application (25%) — ✅ COMPLETE

| Requirement | Status | Notes |
|---|---|---|
| Registration + login with bcrypt-hashed passwords | ✅ Done | `backend/app/auth/` |
| JWT access tokens (15–30 min) + refresh tokens | ✅ Done | Access: 30min, Refresh: 7d |
| All API endpoints require authentication | ✅ Done | `get_current_user` dependency |
| Session persists across page refreshes | ✅ Done | Zustand + localStorage in `store/auth.ts` |
| Frontend handles token expiration gracefully (no raw 401) | ✅ Done | Axios interceptor auto-refreshes |
| Document CRUD with metadata (title, dates, owner) | ✅ Done | `backend/app/documents/` |
| Dashboard listing owned + shared documents | ✅ Done | `DashboardPage.tsx` |
| Rich-text editor (headings, bold, italic, lists, code blocks) | ✅ Done | Tiptap in `RichTextEditor.tsx` |
| Auto-save with status indication | ✅ Done | `useAutoSave.ts`, saves on content change |
| Version history with restore | ✅ Done | `VersionHistoryPanel.tsx` + backend endpoints |
| Owner/editor/viewer roles | ✅ Done | Server-side enforcement in `documents/service.py` |
| Sharing by email/username with role assignment | ✅ Done | `ShareModal.tsx` |
| Server-side permission enforcement | ✅ Done | Viewers blocked at API level |

---

### Part 2: Real-Time Collaboration (20%) — ✅ COMPLETE + BONUS

| Requirement | Status | Notes |
|---|---|---|
| Changes propagate <500ms (local network) | ✅ Done | Yjs CRDT over WebSocket |
| [BONUS] Character-level conflict resolution (CRDTs) | ✅ Done | Yjs — earns +2 bonus pts |
| Connection lifecycle: join, disconnect, reconnect | ✅ Done | `useCollaboration.ts` |
| Active user indicators (who is online) | ✅ Done | `PresenceBar.tsx` |
| [BONUS] Remote cursor and selection tracking | ✅ Done | Tiptap CollaborationCursor — earns +2 bonus pts |
| Typing indicators | ✅ Done | Presence awareness via Yjs awareness protocol |
| Authenticated WebSocket (no token = no session) | ✅ Done | `?token=<jwt>` query param validated on connect |
| Graceful degradation / reconnect | ✅ Done | y-websocket handles reconnect automatically |

---

### Part 3: AI Writing Assistant (25%) — ⚠️ MOSTLY COMPLETE, 2 GAPS

| Requirement | Status | Notes |
|---|---|---|
| Rewrite/Rephrase (with tone options) | ✅ Done | `prompts/rewrite.txt`, tone selector in AIPanel |
| Summarize | ✅ Done | `prompts/summarize.txt` |
| Translate (with language selector) | ✅ Done | `prompts/translate.txt` |
| Expand/Elaborate | ✅ Done | `prompts/expand.txt` |
| Fix Grammar & Spelling | ✅ Done | `prompts/grammar.txt` |
| Custom Prompt (free-form instruction) | ✅ Done | `prompts/custom.txt` |
| Ghost-text autocomplete (bonus-style) | ✅ Done | `useGhostText.ts` — triggers after 6s inactivity |
| SSE streaming, frontend renders progressively | ✅ Done | `StreamingResponse` in backend, SSE in frontend |
| **User can cancel in-progress generation** | ❌ MISSING | `useAI.ts` has `AbortController` internally but NO cancel button is exposed in the UI (`AIPanel.tsx`/`AIResultCard.tsx`). Must add a "Stop" button visible during streaming. |
| Original vs. suggestion comparison (side panel) | ✅ Done | Side panel with `AIResultCard` |
| Accept/Reject suggestion | ✅ Done | `AIResultCard.tsx` accept/reject buttons |
| **Undo after acceptance** | ❌ MISSING | After pressing Accept, the text is inserted but Tiptap's undo history (`editor.commands.undo()`) should reverse it. This is not explicitly wired up. Need to verify and expose undo button post-accept. |
| [BONUS] Partial acceptance of AI suggestions | ❌ NOT DONE | Individual sentence-level accept/reject not implemented. Worth +2 bonus pts. |
| Prompt templates configurable (not hardcoded) | ✅ Done | `.txt` files in `backend/app/ai/prompts/` |
| LLM provider abstraction (swap in one place) | ✅ Done | `backend/app/ai/service.py` + `backend/app/settings/` |
| AI Interaction History logged | ✅ Done | `backend/data/ai_history.json` |
| History UI per document | ✅ Done | `AIHistoryModal.tsx` |
| Multi-provider AI settings (per user) | ✅ Done | DeepSeek, OpenAI, Grok (xAI), Claude, Custom |
| Auto-test API key on paste (1.5s debounce) | ✅ Done | `AISettingsModal.tsx` — keyStatus indicator |

---

### Part 4: Testing & Quality (20%) — ⚠️ BACKEND OK, FRONTEND MISSING

| Requirement | Status | Notes |
|---|---|---|
| Backend unit tests (auth, permissions, prompts) | ✅ Done | `backend/tests/test_auth.py`, `test_documents.py`, `test_ai.py` |
| Backend API integration tests with TestClient | ✅ Done | TestClient used throughout |
| LLM mocked in tests | ✅ Done | `test_ai.py` mocks the AI call |
| WebSocket tests | ⚠️ PARTIAL | Need to verify `test_ai.py` covers WebSocket auth |
| **Frontend component tests** | ❌ MISSING | No tests in `frontend/src/`. `package.json` has `vitest` configured but zero test files written. Need at least auth flow + document UI + AI suggestion UI tests. |
| **E2E tests (Playwright)** | ❌ MISSING | Playwright is in `package.json` (`test:e2e` script) but no `tests/` directory or spec files exist. Worth +2 bonus pts. Covers login → document creation → AI suggestion acceptance. |
| `run.sh` one-command startup | ✅ Done | Exists at repo root |
| `.env.example` | ✅ Done | Exists at `backend/.env.example` |
| Comprehensive README | ✅ Done | Covers setup, running, architecture, features |
| FastAPI auto-generated API docs | ✅ Done | Available at `http://localhost:8000/docs` |
| **DEVIATIONS.md** | ❌ MISSING | Required by assignment. Must document every difference from Assignment 1 architecture. Not a penalty if done — penalty is for deviating silently. |

---

### Part 5: Demo (10%) — 📋 PREP NEEDED

The live demo sequence required:
1. Registration and login with protected routes
2. Document creation with rich-text editing and auto-save
3. Sharing with role enforcement
4. Real-time collaboration in two browser windows
5. AI assistant with streaming (two features, suggestion UX, **cancellation**)
6. Version history restore

**⚠️ Item 5 (AI cancellation) will fail** until the Stop button is added.

---

## 4. What Needs to Be Done (Prioritized)

### 🔴 Critical (blocking demo or grading)

1. **Add "Stop" / Cancel button to AIPanel during streaming**
   - `useAI.ts` already has `AbortController` — just expose a `cancel()` function and add a button in `AIPanel.tsx` that appears when `loading === true`
   - The button should call `clear()` from `useAI.ts` which triggers abort

2. **DEVIATIONS.md**
   - Required by assignment submission
   - Document: JSON file storage instead of DB, Yjs CRDT (bonus), Ghost autocomplete addition, multi-provider AI vs. single provider in A1 design, etc.

3. **Frontend component tests**
   - Use Vitest + React Testing Library
   - Minimum: auth flow (login/register form), document list, AI suggestion accept/reject UI
   - Files go in `frontend/src/__tests__/` or alongside components as `*.test.tsx`

### 🟡 Important (affects grade)

4. **Undo after AI acceptance**
   - After accepting an AI suggestion in `AIResultCard.tsx`, expose an "Undo" button that calls `editor.commands.undo()`
   - Tiptap tracks history natively — this should be straightforward

5. **E2E tests with Playwright** (+2 bonus pts)
   - Config already exists in `package.json` (`test:e2e`)
   - Write specs in `frontend/tests/` covering:
     - Login flow
     - Create document, type text
     - Select text → invoke AI feature → accept suggestion
   - Run: `npm run test:e2e`

6. **Partial AI suggestion acceptance** (+2 bonus pts)
   - Currently shows the full AI result and accept/reject the entire thing
   - Enhancement: split result into sentences/paragraphs, allow accepting individual chunks
   - Complex UI change — lower priority if time is short

### 🟢 Polish (nice to have)

7. **Verify WebSocket tests exist** in `backend/tests/` — if not, add basic connection auth test
8. **AI error mid-stream** — verify partial output is cleanly discarded with a clear error message (check `useAI.ts` error handling in AIPanel)

---

## 5. Key Technical Decisions (for Q&A)

- **Yjs CRDT**: binary protocol over WebSocket, all clients sync via `y-websocket` server relay. The backend `websocket/manager.py` is a pure relay — it does not interpret Yjs messages.
- **JWT**: access token = 30min, refresh = 7 days. Axios interceptor in `frontend/src/api/axios.ts` catches 401, calls `/api/auth/refresh`, retries original request transparently.
- **AI Provider abstraction**: `backend/app/ai/service.py` calls `backend/app/settings/router.py` to get per-user provider config. Claude uses `anthropic` SDK; all others use `openai` SDK (OpenAI-compatible).
- **File-based storage**: `backend/app/storage/json_store.py` — in-memory dict + threading.Lock + periodic flush to JSON files in `backend/data/`. No database needed for PoC.
- **SSE streaming**: `StreamingResponse` in FastAPI yields `data: <chunk>\n\n` events. Frontend uses `EventSource`-style fetch with `ReadableStream`.

---

## 6. File Map (Key Files Only)

```
wordai/
├── run.sh                          # One-command startup (backend + frontend)
├── DEVIATIONS.md                   # ❌ NEEDS TO BE CREATED
├── README.md                       # ✅ Comprehensive
├── backend/
│   ├── .env.example                # ✅ All env vars documented
│   ├── requirements.txt            # bcrypt==4.0.1 pinned (passlib compat fix)
│   ├── app/
│   │   ├── main.py                 # App factory, router registration
│   │   ├── auth/router.py          # /api/auth/* endpoints
│   │   ├── documents/router.py     # /api/documents/* endpoints
│   │   ├── documents/service.py    # Server-side permission enforcement
│   │   ├── ai/router.py            # /api/ai/* endpoints (SSE stream)
│   │   ├── ai/service.py           # Provider abstraction, streaming logic
│   │   ├── ai/prompts/             # 7 .txt prompt templates
│   │   ├── settings/router.py      # /api/settings/ai (provider config)
│   │   ├── websocket/router.py     # /ws/{doc_id} WebSocket relay
│   │   └── storage/json_store.py   # Thread-safe JSON persistence
│   └── tests/
│       ├── test_auth.py
│       ├── test_documents.py
│       └── test_ai.py
└── frontend/
    ├── .claude/launch.json         # Preview server config (uses /opt/homebrew/bin/node)
    ├── src/
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── RegisterPage.tsx
    │   │   ├── DashboardPage.tsx
    │   │   ├── EditorPage.tsx      # Main editor, AI panel, presence, versions, share
    │   │   └── SharedDocPage.tsx
    │   ├── components/
    │   │   ├── shared/             # Button, Input, Select, Modal, Dropdown, Avatar...
    │   │   ├── editor/             # RichTextEditor, Toolbar, ShareModal, VersionHistoryPanel
    │   │   ├── ai/                 # AIPanel, AIResultCard, AISettingsModal, AISetupBanner
    │   │   └── collaboration/      # PresenceBar
    │   ├── hooks/
    │   │   ├── useAI.ts            # SSE streaming + AbortController (cancel logic is HERE)
    │   │   ├── useAutoSave.ts
    │   │   ├── useCollaboration.ts # Yjs + WebSocket + presence
    │   │   └── useGhostText.ts     # Ghost autocomplete after 6s inactivity
    │   ├── api/
    │   │   └── axios.ts            # Auto-refresh interceptor on 401
    │   └── store/
    │       ├── auth.ts             # Zustand auth store
    │       └── theme.ts            # Dark/light mode
    └── tests/                      # ❌ NEEDS TO BE CREATED (Playwright E2E)
```

---

## 7. Bonus Points Tracker

| Bonus Feature | Status | Points |
|---|---|---|
| Character-level CRDT (Yjs) | ✅ Done | +2 |
| Remote cursors + selection tracking | ✅ Done | +2 |
| Share-by-link with permissions + revocation | ✅ Done | +2 |
| Partial AI suggestion acceptance | ❌ Not done | +2 available |
| E2E tests (Playwright) covering login → AI acceptance | ❌ Not done | +2 available |

**Currently earned: +6 bonus pts. Up to +4 more available.**

---

## 8. Running the App

```bash
# Backend (from wordai/backend/)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (from wordai/frontend/)
npm install
npm run dev   # http://localhost:5173

# Or one command from wordai/
./run.sh
```

**Environment variables** (copy `backend/.env.example` to `backend/.env`):
```
JWT_SECRET_KEY=<random-secret>
DEEPSEEK_API_KEY=<optional-fallback-key>   # Users set their own key in the UI
```
**Never commit API keys. Users input their own keys via the AI Configuration modal.**
