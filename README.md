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
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in DEEPSEEK_API_KEY and JWT_SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

### 4. One-command startup (after first setup)

```bash
./run.sh
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DEEPSEEK_API_KEY` | Your DeepSeek API key (never commit!) |
| `JWT_SECRET_KEY` | Random secret for signing JWTs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default 30 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default 7 |
| `DATA_DIR` | Path for JSON data files (default `./data`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

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
