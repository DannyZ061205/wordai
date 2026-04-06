#!/bin/bash
# wordAI — one-command startup
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting wordAI..."

# Check .env
if [ ! -f "$ROOT/backend/.env" ]; then
  echo "⚠️  backend/.env not found. Copying from .env.example ..."
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "    Please fill in DEEPSEEK_API_KEY and JWT_SECRET_KEY in backend/.env"
fi

# Backend
echo ""
echo "📡 Starting backend on http://localhost:8000 ..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  echo "   Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -r requirements.txt -q

uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Frontend
echo ""
echo "🎨 Starting frontend on http://localhost:5173 ..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "   Installing npm dependencies..."
  npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ wordAI is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait and clean up
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
