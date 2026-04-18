import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/core';
import { Pencil, FileText, Globe, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface FloatingAIMenuProps {
  editor: Editor;
  onAIAction: (feature: 'rewrite' | 'summarize' | 'translate', text: string) => void;
}

interface QuickActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function QuickActionButton({ onClick, icon, label }: QuickActionButtonProps) {
  return (
    <button
      // preventDefault on mousedown keeps the text selection intact when the
      // user clicks the button; actual action fires on the full click (up).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md',
        'text-[color:var(--text-primary)] hover:bg-[color:var(--primary-light)]',
        'hover:text-[#1a73e8] transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]',
      )}
      aria-label={label}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Floating menu shown above a text selection with quick-action buttons.
 * Self-positioned (no Tiptap BubbleMenu / tippy) so we have full control
 * over visibility — in particular, clicking an action hides it instantly
 * until the user makes a new selection.
 */
export function FloatingAIMenu({ editor, onAIAction }: FloatingAIMenuProps) {
  // "key" = from-to of the selection. When dismissed, we remember the key
  // and suppress the menu until the user makes a different selection.
  const dismissedKeyRef = useRef<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const recompute = () => {
      const { from, to } = editor.state.selection;
      if (from === to || editor.isActive('codeBlock') || !editor.isEditable) {
        setPos(null);
        return;
      }
      const key = `${from}-${to}`;
      if (dismissedKeyRef.current === key) {
        setPos(null);
        return;
      }
      // Reset dismissal once the selection has changed to a new range.
      dismissedKeyRef.current = null;
      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to, 1);
        const MENU_WIDTH = 280;
        const MENU_HEIGHT = 40;
        const GAP = 8;
        const centerX = (start.left + end.right) / 2;
        let top = Math.min(start.top, end.top) - MENU_HEIGHT - GAP;
        let left = centerX - MENU_WIDTH / 2;
        // Clamp to viewport
        left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
        if (top < 8) top = Math.max(start.bottom, end.bottom) + GAP;
        setPos({ top, left });
      } catch {
        setPos(null);
      }
    };
    recompute();
    editor.on('selectionUpdate', recompute);
    editor.on('transaction', recompute);
    editor.on('blur', () => setPos(null));
    window.addEventListener('scroll', recompute, true);
    window.addEventListener('resize', recompute);
    return () => {
      editor.off('selectionUpdate', recompute);
      editor.off('transaction', recompute);
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [editor]);

  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const dismiss = () => {
    const { from, to } = editor.state.selection;
    dismissedKeyRef.current = `${from}-${to}`;
    setPos(null);
  };

  const runAction = (feature: 'rewrite' | 'summarize' | 'translate') => {
    onAIAction(feature, getSelectedText());
    dismiss();
  };

  const handleCopy = () => {
    const text = getSelectedText();
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
    dismiss();
  };

  if (!pos) return null;

  return (
    <div
      className={clsx(
        'fixed z-40 flex items-center gap-0.5 p-1 rounded-lg shadow-lg',
        'bg-[color:var(--bg-surface)] border border-[color:var(--border)]',
        'animate-fade-in',
      )}
      style={{ top: pos.top, left: pos.left }}
      role="toolbar"
      aria-label="Quick AI actions"
    >
      <QuickActionButton
        onClick={() => runAction('rewrite')}
        icon={<Pencil className="w-3.5 h-3.5" />}
        label="Rewrite"
      />
      <QuickActionButton
        onClick={() => runAction('summarize')}
        icon={<FileText className="w-3.5 h-3.5" />}
        label="Summarise"
      />
      <QuickActionButton
        onClick={() => runAction('translate')}
        icon={<Globe className="w-3.5 h-3.5" />}
        label="Translate"
      />

      <div
        className="w-px h-4 mx-0.5 flex-shrink-0"
        style={{ backgroundColor: 'var(--border)' }}
      />

      <QuickActionButton
        onClick={handleCopy}
        icon={<Copy className="w-3.5 h-3.5" />}
        label="Copy"
      />
    </div>
  );
}
