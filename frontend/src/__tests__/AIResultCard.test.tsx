import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIResultCard } from '../components/ai/AIResultCard';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const baseProps = {
  result: '',
  loading: false,
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onClear: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AIResultCard', () => {
  describe('loading state', () => {
    it('shows thinking placeholder when loading with no result', () => {
      render(<AIResultCard {...baseProps} loading result="" />);
      expect(screen.getByText(/AI is thinking/i)).toBeInTheDocument();
    });

    it('shows result text with streaming cursor while loading', () => {
      render(<AIResultCard {...baseProps} loading result="Hello wor" />);
      expect(screen.getByText(/Hello wor/)).toBeInTheDocument();
    });

    it('shows Stop button when loading and onCancel provided', () => {
      const onCancel = vi.fn();
      render(<AIResultCard {...baseProps} loading result="" onCancel={onCancel} />);
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });

    it('calls onCancel when Stop button clicked', async () => {
      const onCancel = vi.fn();
      render(<AIResultCard {...baseProps} loading result="" onCancel={onCancel} />);
      await userEvent.click(screen.getByRole('button', { name: /stop/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not show Stop button when onCancel is not provided', () => {
      render(<AIResultCard {...baseProps} loading result="" />);
      expect(screen.queryByRole('button', { name: /stop/i })).not.toBeInTheDocument();
    });
  });

  describe('result state', () => {
    it('shows result text', () => {
      render(<AIResultCard {...baseProps} result="Here is the rewritten text." />);
      expect(screen.getByText('Here is the rewritten text.')).toBeInTheDocument();
    });

    it('shows Accept, Edit first, and Reject buttons', () => {
      render(<AIResultCard {...baseProps} result="Some text" />);
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit first/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('calls onAccept with result text when Accept is clicked', async () => {
      const onAccept = vi.fn();
      render(<AIResultCard {...baseProps} result="Rewritten text" onAccept={onAccept} />);
      await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));
      expect(onAccept).toHaveBeenCalledWith('Rewritten text');
    });

    it('calls onReject when Reject is clicked', async () => {
      const onReject = vi.fn();
      render(<AIResultCard {...baseProps} result="Rewritten text" onReject={onReject} />);
      await userEvent.click(screen.getByRole('button', { name: /reject/i }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });

  describe('edit mode', () => {
    it('enters edit mode when Edit first is clicked', async () => {
      render(<AIResultCard {...baseProps} result="Original AI text" />);
      await userEvent.click(screen.getByRole('button', { name: /edit first/i }));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /accept edited/i })).toBeInTheDocument();
    });

    it('calls onAccept with edited text when Accept edited is clicked', async () => {
      const onAccept = vi.fn();
      render(<AIResultCard {...baseProps} result="Original" onAccept={onAccept} />);
      await userEvent.click(screen.getByRole('button', { name: /edit first/i }));
      const textarea = screen.getByRole('textbox');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'My edited version');
      await userEvent.click(screen.getByRole('button', { name: /accept edited/i }));
      expect(onAccept).toHaveBeenCalledWith('My edited version');
    });

    it('returns to preview when Cancel edit is clicked', async () => {
      render(<AIResultCard {...baseProps} result="Some result" />);
      await userEvent.click(screen.getByRole('button', { name: /edit first/i }));
      await userEvent.click(screen.getByRole('button', { name: /cancel edit/i }));
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Some result')).toBeInTheDocument();
    });
  });

  describe('undo state', () => {
    it('shows Undo banner when onUndo is provided', () => {
      const onUndo = vi.fn();
      render(<AIResultCard {...baseProps} result="" onUndo={onUndo} />);
      expect(screen.getByText(/suggestion applied/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });

    it('calls onUndo when Undo button is clicked', async () => {
      const onUndo = vi.fn();
      render(<AIResultCard {...baseProps} result="" onUndo={onUndo} />);
      await userEvent.click(screen.getByRole('button', { name: /undo/i }));
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('does not show Undo banner when onUndo is not provided', () => {
      render(<AIResultCard {...baseProps} result="" />);
      expect(screen.queryByText(/suggestion applied/i)).not.toBeInTheDocument();
    });
  });
});
