import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';

// Mock auth API
const mockLogin = vi.fn();
const mockMe = vi.fn();
vi.mock('../api/auth', () => ({
  authApi: {
    login: (...args: unknown[]) => mockLogin(...args),
    me: (...args: unknown[]) => mockMe(...args),
  },
}));

// Mock auth store
const mockSetUser = vi.fn();
const mockSetTokens = vi.fn();
vi.mock('../store/auth', () => ({
  useAuthStore: () => ({
    setUser: mockSetUser,
    setTokens: mockSetTokens,
  }),
}));

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Stub useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders email and password inputs and submit button', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when email is empty on submit', async () => {
    renderLoginPage();
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'notanemail');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it('shows validation error when password is too short', async () => {
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
  });

  it('calls authApi.login with email and password on valid submission', async () => {
    mockLogin.mockResolvedValue({ access_token: 'acc', refresh_token: 'ref' });
    mockMe.mockResolvedValue({ id: '1', username: 'alice', email: 'alice@example.com', created_at: '' });
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'secret123' }));
  });

  it('shows error toast when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Invalid credentials'));
  });

  it('navigates after successful login', async () => {
    mockLogin.mockResolvedValue({ access_token: 'acc', refresh_token: 'ref' });
    mockMe.mockResolvedValue({ id: '1', username: 'alice', email: 'alice@example.com', created_at: '' });
    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  it('has a link to the register page', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: /create one/i })).toHaveAttribute('href', '/register');
  });
});
