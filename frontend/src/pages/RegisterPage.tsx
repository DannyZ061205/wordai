import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/axios';
import { useAuthStore } from '../store/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!username) newErrors.username = 'Username is required';
    else if (username.length < 3)
      newErrors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(username))
      newErrors.username = 'Username can only contain letters, numbers and underscores';

    if (!email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = 'Enter a valid email address';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8)
      newErrors.password = 'Password must be at least 8 characters';

    if (!confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword)
      newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await authApi.register({ username, email, password });
      setTokens({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });
      setUser(response.user);
      toast.success(`Welcome to wordAI, ${response.user.username}!`);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-app)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-[#1a73e8]">wordAI</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div
          className="w-full max-w-[420px] rounded-2xl p-8"
          style={{
            background: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Logo + title */}
          <div className="text-center mb-7">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-[#1a73e8] items-center justify-center mb-4 shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Create your account
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Start collaborating with AI-powered writing
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Username"
              type="text"
              placeholder="john_doe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={errors.username}
              autoComplete="username"
              autoFocus
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
                helperText={!errors.password ? 'At least 8 characters' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-[34px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              className="mt-2"
            >
              Create account
            </Button>
          </form>

          {/* Terms */}
          <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            By creating an account, you agree to our{' '}
            <span className="text-[#1a73e8] cursor-pointer hover:underline">Terms of Service</span>
            {' '}and{' '}
            <span className="text-[#1a73e8] cursor-pointer hover:underline">Privacy Policy</span>
          </p>

          <div className="mt-5 pt-5 text-center border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-[#1a73e8] font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
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
