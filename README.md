# wordAI

> Real-time collaborative document editor with an integrated AI writing assistant.
> Built for AI1220 – Software, Web & Mobile Engineering (MBZUAI, 2026).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript, TailwindCSS, shadcn/ui |
| Editor | Tiptap 2 (rich text) + Yjs CRDT (real-time sync) |
| Backend | FastAPI (Python 3.11), JWT auth, JSON file persistence |
| AI | DeepSeek API (`deepseek-chat`) via SSE streaming |
| Transport | WebSocket (Yjs binary) + HTTP REST |

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

- **Real-time collaboration** — Yjs CRDT over WebSocket; multiple users edit simultaneously with no conflicts
- **Presence indicators** — live cursors with per-user colour
- **AI writing assistant** — powered by DeepSeek:
  - Rewrite (with tone selection)
  - Summarise
  - Translate
  - Expand
  - Grammar check
  - Custom instruction
  - **Ghost autocomplete** — Copilot-style prediction after 6 s of inactivity
- **Version history** — automatic snapshots; restore any previous version
- **Sharing** — share by email/username (editor/viewer), share-by-link with optional expiry
- **Dark / Light mode** — system-preference aware, manually toggleable

---

## Project Structure

```
wordai/
├── backend/          # FastAPI Python backend
│   ├── app/
│   │   ├── auth/     # JWT auth
│   │   ├── documents/# CRUD + versions + sharing
│   │   ├── ai/       # DeepSeek streaming + prompts
│   │   ├── websocket/# Yjs WebSocket relay
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
All bonus features are implemented: real Yjs CRDT, remote cursors, share-by-link, partial AI acceptance, Playwright E2E tests.
