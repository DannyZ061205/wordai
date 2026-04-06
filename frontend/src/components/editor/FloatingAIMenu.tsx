import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react';
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
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md',
        'text-[color:var(--text-primary)] hover:bg-[color:var(--primary-light)]',
        'hover:text-[#1a73e8] transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]'
      )}
      aria-label={label}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function FloatingAIMenu({ editor, onAIAction }: FloatingAIMenuProps) {
  const getSelectedText = () => {
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const handleCopy = () => {
    const text = getSelectedText();
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'top',
        maxWidth: 'none',
      }}
      shouldShow={({ editor, state }) => {
        const { from, to } = state.selection;
        return from !== to && !editor.isActive('codeBlock');
      }}
    >
      <div
        className={clsx(
          'flex items-center gap-0.5 p-1 rounded-lg shadow-lg',
          'bg-[color:var(--bg-surface)] border border-[color:var(--border)]',
          'animate-fade-in'
        )}
        role="toolbar"
        aria-label="Quick AI actions"
      >
        <QuickActionButton
          onClick={() => onAIAction('rewrite', getSelectedText())}
          icon={<Pencil className="w-3.5 h-3.5" />}
          label="Rewrite"
        />
        <QuickActionButton
          onClick={() => onAIAction('summarize', getSelectedText())}
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Summarise"
        />
        <QuickActionButton
          onClick={() => onAIAction('translate', getSelectedText())}
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
    </BubbleMenu>
  );
}
