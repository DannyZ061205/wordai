import { Link } from 'react-router-dom';
import { Sparkles, Home, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../components/shared/ThemeToggle';

export function NotFoundPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-app)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-[#1a73e8]">wordAI</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center max-w-md">
          {/* 404 illustration */}
          <div
            className="inline-flex w-24 h-24 rounded-3xl items-center justify-center mb-8"
            style={{ background: 'var(--bg-surface)', boxShadow: 'var(--shadow-md)' }}
          >
            <span className="text-4xl font-black text-[#1a73e8]">404</span>
          </div>

          <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Page not found
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The page you're looking for doesn't exist or has been moved. Let's get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1a73e8] text-white text-sm font-medium hover:bg-[#1557b0] transition-colors shadow-sm"
            >
              <Home className="w-4 h-4" />
              Go to Dashboard
            </Link>
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border hover:bg-[color:var(--border)] transition-colors"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          wordAI — Collaborative documents with AI
        </p>
      </div>
    </div>
  );
}
