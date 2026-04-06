import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { EditorPage } from './pages/EditorPage';
import { SharedDocPage } from './pages/SharedDocPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAuthStore } from './store/auth';
import { useThemeStore } from './store/theme';
import { Spinner } from './components/shared/Spinner';

// ─── Protected Route ───────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-app)' }}
      >
        <Spinner size="lg" className="text-[#1a73e8]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ─── Public-only Route (redirect if already authenticated) ─────────
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-app)' }}
      >
        <Spinner size="lg" className="text-[#1a73e8]" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ─── App Initializer ───────────────────────────────────────────────
function AppInitializer() {
  const { init: initAuth } = useAuthStore();
  const { init: initTheme } = useThemeStore();

  useEffect(() => {
    // Init theme synchronously first (avoids flash)
    initTheme();
    // Then restore auth session
    initAuth();
  }, [initAuth, initTheme]);

  return null;
}

// ─── Router ────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* Shared doc — no auth required */}
      <Route path="/shared/:token" element={<SharedDocPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doc/:id"
        element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

// ─── Root App ──────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer />
      <AppRoutes />
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: 'var(--shadow-lg)',
            padding: '10px 14px',
          },
          success: {
            iconTheme: {
              primary: '#34a853',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#d93025',
              secondary: '#fff',
            },
          },
        }}
      />
    </BrowserRouter>
  );
}
