# wordAI

> Real-time collaborative document editor with an integrated AI writing assistant.
> Built for AI1220 – Software, Web & Mobile Engineering (MBZUAI, 2026).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript, TailwindCSS |
| Editor | Tiptap 2 (rich text, no CRDT) |
| Real-time | Custom JSON-over-WebSocket broadcast (last-write-wins; ~100 ms propagation) |
| Backend | FastAPI (Python 3.11), JWT access + refresh, JSON file persistence |
| AI | Multi-provider (DeepSeek / OpenAI / Anthropic / Grok / custom OpenAI-compatible) over SSE streaming |
| Transport | WebSocket (JSON frames) + HTTP REST |

---

## Quick Start

### 1. Clone

```bash
git clone https://github.com/DannyZ061205/wordai.git
cd wordai
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # set JWT_SECRET_KEY (AI keys are configured per-user in-app)
uvicorn app.main:app --reload --port 8000
```

> **Note:** `uvicorn` keeps the terminal busy. Open a **new terminal tab** for step 3, or skip to step 4 and let `./run.sh` handle both servers for you.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

### 4. One-command startup (works on a fresh checkout too)

```bash
./run.sh
```

On first run, this script creates `backend/.env` from the template, the Python virtualenv, installs `pip` and `npm` dependencies, and launches both servers. On subsequent runs it just launches them.

### Prerequisites

- Python **3.11+**
- Node.js **18+** (required by Vite 5)
- npm 9+

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required? | Description |
|----------|-----------|-------------|
| `JWT_SECRET_KEY` | **Yes** | Random secret for signing JWTs — change from the default before any real use |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | Default `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional | Default `7` |
| `DATA_DIR` | Optional | Path for JSON data files (default `./data`) |
| `CORS_ORIGINS` | Optional | Comma-separated allowed origins (default covers `localhost:5173` + `:5174`) |

> **AI keys are NOT environment variables.** Each user configures their own provider (DeepSeek / OpenAI / Anthropic / Grok / custom) and API key from **Settings → AI Configuration** inside the app. Keys are stored per-user in `backend/data/ai_settings.json`.

---

## Features

- **Real-time collaboration** — lightweight JSON-over-WebSocket broadcast. Typing in one tab reflects in every other tab editing the same document within ~100 ms. Last-write-wins semantics.
- **Presence indicators** — live "who's here" list derived from WebSocket connect/disconnect events.
- **AI writing assistant** — multi-provider (DeepSeek / OpenAI / Anthropic / Grok / custom OpenAI-compatible) over SSE streaming:
  - Rewrite (with tone selection)
  - Summarise
  - Translate (target language selectable)
  - Expand
  - Grammar check
  - Custom instruction
  - **Ghost autocomplete** — Copilot-style prediction after a pause in typing
- **Suggestion UX** — side-by-side original vs. suggestion, partial acceptance (select which segments to apply), edit-before-accept, undo after accept.
- **Version history** — automatic snapshots; restore any previous version.
- **Sharing** — invite by email/username with editor/viewer role, *or* generate a share-by-link with configurable permissions and revocation.
- **Dark / Light mode** — system-preference aware, manually toggleable.

---

## Project Structure

```
wordai/
├── backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── auth/     # JWT auth
│   │   ├── documents/# CRUD + versions + sharing
│   │   ├── ai/       # Multi-provider streaming + prompts (prompts in prompts/*.txt)
│   │   ├── websocket/# JSON broadcast relay (edits + presence)
│   │   └── storage/  # JSON file persistence
│   └── tests/        # 36 pytest tests
├── frontend/         # React + Vite + TypeScript
│   └── src/
│       ├── api/      # Axios clients
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── store/    # Zustand
│       └── types/
└── run.sh            # one-command startup
```

---

## Assignment Context

This is the Proof-of-Concept implementation for **AI1220 Assignment 2**.

Bonus features implemented: **share-by-link with configurable permissions & revocation**, **partial acceptance of AI suggestions**, **Playwright E2E tests**. CRDT-based conflict resolution and remote cursor rendering were dropped in favour of a simpler, reliably-working JSON broadcast — see `DEVIATIONS.md` §2 for the full rationale.
