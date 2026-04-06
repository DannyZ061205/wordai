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

  describe('partial acceptance — visibility', () => {
    it('does not show Select parts button for single-sentence result', () => {
      render(<AIResultCard {...baseProps} result="Only one sentence here." />);
      expect(screen.queryByRole('button', { name: /select parts/i })).not.toBeInTheDocument();
    });

    it('shows Select parts button when result has multiple paragraphs', () => {
      render(
        <AIResultCard
          {...baseProps}
          result={"Paragraph one.\n\nParagraph two.\n\nParagraph three."}
        />
      );
      expect(screen.getByRole('button', { name: /select parts/i })).toBeInTheDocument();
    });

    it('shows Select parts button when result has multiple sentences', () => {
      render(
        <AIResultCard
          {...baseProps}
          result="First sentence. Second sentence. Third sentence."
        />
      );
      expect(screen.getByRole('button', { name: /select parts/i })).toBeInTheDocument();
    });

    it('does not show Select parts button while loading', () => {
      render(
        <AIResultCard
          {...baseProps}
          loading
          result={"Paragraph one.\n\nParagraph two."}
        />
      );
      expect(screen.queryByRole('button', { name: /select parts/i })).not.toBeInTheDocument();
    });
  });

  describe('partial acceptance — navigation', () => {
    const multiResult = "First sentence. Second sentence. Third sentence.";

    it('enters partial mode when Select parts is clicked', async () => {
      render(<AIResultCard {...baseProps} result={multiResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('starts with all segments checked in partial mode', async () => {
      render(<AIResultCard {...baseProps} result={multiResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      // Header shows "3 of 3 selected"
      expect(screen.getByText(/3 of 3 selected/i)).toBeInTheDocument();
    });

    it('Back button returns to preview mode', async () => {
      render(<AIResultCard {...baseProps} result={multiResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      await userEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select parts/i })).toBeInTheDocument();
    });
  });

  describe('partial acceptance — accepting', () => {
    const paraResult = "Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.";

    it('deselecting a segment updates the selected count', async () => {
      render(<AIResultCard {...baseProps} result={paraResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      // Deselect segment 2
      await userEvent.click(screen.getByRole('checkbox', { name: /segment 2/i }));
      expect(screen.getByText(/2 of 3 selected/i)).toBeInTheDocument();
    });

    it('calls onAccept with only selected paragraphs joined by double newline', async () => {
      const onAccept = vi.fn();
      render(<AIResultCard {...baseProps} result={paraResult} onAccept={onAccept} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      // Deselect segment 2
      await userEvent.click(screen.getByRole('checkbox', { name: /segment 2/i }));
      await userEvent.click(screen.getByRole('button', { name: /accept 2 parts/i }));
      expect(onAccept).toHaveBeenCalledWith('Alpha paragraph.\n\nGamma paragraph.');
    });

    it('calls onAccept with sentence segments joined by space', async () => {
      const onAccept = vi.fn();
      const sentenceResult = "First sentence. Second sentence. Third sentence.";
      render(<AIResultCard {...baseProps} result={sentenceResult} onAccept={onAccept} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      // Deselect segment 2 (second sentence)
      await userEvent.click(screen.getByRole('checkbox', { name: /segment 2/i }));
      await userEvent.click(screen.getByRole('button', { name: /accept 2 parts/i }));
      expect(onAccept).toHaveBeenCalledWith('First sentence. Third sentence.');
    });

    it('shows "Accept all" when all segments are selected', async () => {
      render(<AIResultCard {...baseProps} result={paraResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      expect(screen.getByRole('button', { name: /accept all/i })).toBeInTheDocument();
    });

    it('accept button is disabled when zero segments are selected', async () => {
      render(<AIResultCard {...baseProps} result={paraResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      await userEvent.click(screen.getByRole('button', { name: /select no segments/i }));
      const acceptBtn = screen.getByRole('button', { name: /accept/i });
      expect(acceptBtn).toBeDisabled();
    });

    it('None control deselects all segments', async () => {
      render(<AIResultCard {...baseProps} result={paraResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      await userEvent.click(screen.getByRole('button', { name: /select no segments/i }));
      expect(screen.getByText(/0 of 3 selected/i)).toBeInTheDocument();
    });

    it('All control re-selects all segments after deselection', async () => {
      render(<AIResultCard {...baseProps} result={paraResult} />);
      await userEvent.click(screen.getByRole('button', { name: /select parts/i }));
      await userEvent.click(screen.getByRole('button', { name: /select no segments/i }));
      await userEvent.click(screen.getByRole('button', { name: /select all segments/i }));
      expect(screen.getByText(/3 of 3 selected/i)).toBeInTheDocument();
    });

    it('single segment result: onAccept called with full text', async () => {
      const onAccept = vi.fn();
      render(<AIResultCard {...baseProps} result="Just one sentence." onAccept={onAccept} />);
      await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));
      expect(onAccept).toHaveBeenCalledWith('Just one sentence.');
    });
  });
});
