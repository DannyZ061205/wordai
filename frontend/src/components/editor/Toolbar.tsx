import { Editor } from '@tiptap/core';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Code2,
  Undo2,
  Redo2,
  Link,
  ChevronDown,
  Minus,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Tooltip } from '../shared/Tooltip';
import { useState, useRef, useEffect } from 'react';

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  tooltip,
  children,
  className,
}: ToolbarButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        disabled={disabled}
        aria-label={tooltip}
        aria-pressed={active}
        className={clsx(
          'flex items-center justify-center w-8 h-8 rounded-md text-sm',
          'transition-colors duration-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]',
          active
            ? 'bg-[#e8f0fe] text-[#1a73e8]'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--border)] hover:text-[color:var(--text-primary)]',
          disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
          className
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ToolbarSeparator() {
  return (
    <div
      className="w-px h-5 mx-1 flex-shrink-0"
      style={{ backgroundColor: 'var(--border)' }}
    />
  );
}

const HEADING_OPTIONS = [
  { label: 'Normal text', value: 0 },
  { label: 'Heading 1', value: 1 },
  { label: 'Heading 2', value: 2 },
  { label: 'Heading 3', value: 3 },
];

function HeadingDropdown({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = HEADING_OPTIONS.find((o) => {
    if (o.value === 0) return editor.isActive('paragraph');
    return editor.isActive('heading', { level: o.value });
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        className={clsx(
          'flex items-center gap-1 px-2 h-8 rounded-md text-xs font-medium',
          'text-[color:var(--text-primary)] hover:bg-[color:var(--border)]',
          'transition-colors duration-100 min-w-[110px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]'
        )}
        aria-label="Text style"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex-1 text-left truncate">{current?.label ?? 'Normal text'}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <div
          className={clsx(
            'absolute top-full left-0 mt-1 z-50 rounded-lg shadow-lg overflow-hidden',
            'bg-[color:var(--bg-surface)] border border-[color:var(--border)]',
            'animate-fade-in min-w-[140px]'
          )}
          role="listbox"
        >
          {HEADING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onMouseDown={(e) => {
                e.preventDefault();
                if (opt.value === 0) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor
                    .chain()
                    .focus()
                    .toggleHeading({ level: opt.value as 1 | 2 | 3 })
                    .run();
                }
                setOpen(false);
              }}
              role="option"
              aria-selected={current?.value === opt.value}
              className={clsx(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                'hover:bg-[color:var(--border)]',
                current?.value === opt.value
                  ? 'text-[#1a73e8] font-medium bg-[#e8f0fe]'
                  : 'text-[color:var(--text-primary)]'
              )}
              style={{
                fontSize:
                  opt.value === 1
                    ? '1.1em'
                    : opt.value === 2
                    ? '1em'
                    : opt.value === 3
                    ? '0.9em'
                    : '0.875em',
                fontWeight: opt.value > 0 ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const handleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
    }
  };

  return (
    <ToolbarButton
      onClick={handleLink}
      active={editor.isActive('link')}
      tooltip="Insert link (Ctrl+K)"
    >
      <Link className="w-4 h-4" />
    </ToolbarButton>
  );
}

export function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div
      className={clsx(
        'flex items-center px-4 py-2 gap-0.5 flex-wrap',
        'border-b border-[color:var(--border)]',
        'bg-[color:var(--bg-surface)]',
        'sticky top-0 z-10'
      )}
      role="toolbar"
      aria-label="Formatting toolbar"
    >
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        tooltip="Undo (Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        tooltip="Redo (Ctrl+Y)"
      >
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Heading */}
      <HeadingDropdown editor={editor} />

      <ToolbarSeparator />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        tooltip="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        tooltip="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        tooltip="Underline (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        tooltip="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        tooltip="Inline code"
      >
        <Code className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        tooltip="Align left"
      >
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        tooltip="Align center"
      >
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        tooltip="Align right"
      >
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        tooltip="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        tooltip="Bullet list"
      >
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        tooltip="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        tooltip="Task list"
      >
        <CheckSquare className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Code block */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        tooltip="Code block"
      >
        <Code2 className="w-4 h-4" />
      </ToolbarButton>

      {/* Horizontal rule */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        tooltip="Horizontal rule"
      >
        <Minus className="w-4 h-4" />
      </ToolbarButton>

      {/* Link */}
      <LinkButton editor={editor} />
    </div>
  );
}
