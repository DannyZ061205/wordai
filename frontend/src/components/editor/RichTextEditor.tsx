import { useEffect, useRef, useMemo, useState, useLayoutEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';

import { useEditorContext } from './EditorContext';
import { Toolbar } from './Toolbar';
import { FloatingAIMenu } from './FloatingAIMenu';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useGhostText } from '../../hooks/useGhostText';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { GhostTextExtension } from '../../extensions/GhostTextExtension';
import { Sparkles } from 'lucide-react';

import { Collaborator } from '../../types';

interface RichTextEditorProps {
  docId: string;
  initialContent: string;
  editable?: boolean;
  shareToken?: string;
  onContentChange?: (content: string) => void;
  onAIAction?: (feature: 'rewrite' | 'summarize' | 'translate', text: string) => void;
  onCollaboratorsChange?: (collaborators: Collaborator[]) => void;
}

export function RichTextEditor({
  docId,
  initialContent,
  editable = true,
  shareToken,
  onContentChange,
  onAIAction,
  onCollaboratorsChange,
}: RichTextEditorProps) {
  const { setEditor } = useEditorContext();

  // Extensions are stable — created once.
  const extensions = useMemo(
    () => [
      StarterKit,
      CharacterCount,
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: 'Start writing… or select text for AI assistance',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ inline: false }),
      Typography,
      GhostTextExtension,
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getHTML());
    },
  });

  // Register editor in context
  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Real-time sync via simple JSON broadcast over WebSocket — no Yjs.
  // Always on: viewers (editable=false) still receive updates, they just
  // don't broadcast their own.
  const { collaborators } = useRealtimeSync(editor, docId, shareToken, true);

  // Bubble the collaborator list up to the page header.
  useEffect(() => {
    onCollaboratorsChange?.(collaborators);
  }, [collaborators, onCollaboratorsChange]);

  // Auto-save (HTTP) — separate from live sync, runs in both owner and
  // guest tabs so the latest content is always durable on the server.
  const content = editor?.getHTML() ?? '';
  useAutoSave(docId, content, shareToken);

  // Ghost text — rendered inline via ProseMirror decoration (GhostTextExtension)
  const { hasGhostText, isPredicting, ghostText, cancelStream } = useGhostText(
    editor,
    docId,
    shareToken,
  );

  // Anchor the "AI continuation" card to the cursor Y-position, placed to the
  // right of the page. Falls back to docked bottom-right when there isn't
  // enough horizontal room (narrow viewports).
  const pageRef = useRef<HTMLDivElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const [cardMounted, setCardMounted] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  const CARD_WIDTH = 320;
  const CARD_GAP = 24;
  const TRANSITION_MS = 240;
  const cardActive = hasGhostText || isPredicting;

  useEffect(() => {
    if (cardActive) {
      setCardMounted(true);
      const id = requestAnimationFrame(() => setCardRevealed(true));
      return () => cancelAnimationFrame(id);
    }
    setCardRevealed(false);
    const t = setTimeout(() => setCardMounted(false), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [cardActive]);

  useLayoutEffect(() => {
    if (!editor || !cardActive) return;
    const update = () => {
      if (!editor || !pageRef.current) return;
      const pos = editor.state.selection.from;
      try {
        const coords = editor.view.coordsAtPos(pos);
        const pageRect = pageRef.current.getBoundingClientRect();
        const left = pageRect.right + CARD_GAP;
        if (left + CARD_WIDTH > window.innerWidth - 8) {
          setCardPos(null);
          return;
        }
        const top = Math.max(8, coords.top);
        setCardPos({ top, left });
      } catch {
        setCardPos(null);
      }
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [editor, cardActive, ghostText]);

  return (
    <div className="flex flex-col h-full">
      {editable && <Toolbar editor={editor} />}

      <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-app)' }}>
        <div className="mx-auto my-8 max-w-[800px] px-4">
          <div
            ref={pageRef}
            className="relative bg-white dark:bg-[#2d2d2d] rounded-lg"
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.05)',
              minHeight: '1000px',
              padding: '80px 64px',
            }}
          >
            <EditorContent editor={editor} />

            {cardMounted && (
              <div
                className={`z-20 w-[320px] rounded-2xl border bg-[var(--bg-surface)] p-4 shadow-xl shadow-black/5 text-sm ${
                  cardPos ? 'fixed' : 'absolute bottom-6 right-6'
                } ${cardRevealed ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-2 scale-[0.96]'}`}
                aria-hidden={!cardRevealed}
                style={{
                  ...(cardPos ? { top: cardPos.top, left: cardPos.left } : {}),
                  transition:
                    'opacity 240ms cubic-bezier(0.16, 1, 0.3, 1), transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
                  transformOrigin: 'left center',
                  willChange: 'opacity, transform',
                }}
              >
                <div className="flex items-center gap-2 text-[var(--text-primary)] mb-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eaf4ff] text-[#1a73e8]">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <p className="font-semibold">AI continuation</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-5">
                      {isPredicting && !ghostText.trim()
                        ? 'Generating a suggestion for what to write next...'
                        : 'Press Tab to accept or Esc to dismiss.'}
                    </p>
                  </div>
                </div>
                {ghostText.trim() && (
                  <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-app)] p-3 text-[var(--text-primary)] text-sm leading-5">
                    {ghostText.trim()}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editor?.commands.acceptGhostText()}
                    disabled={!ghostText.trim()}
                    className={`rounded-lg border border-transparent bg-[#1a73e8] px-3 py-2 text-xs font-semibold text-white transition ${ghostText.trim() ? 'hover:bg-[#1765c1]' : 'cursor-not-allowed opacity-50'}`}
                  >
                    Accept with Tab
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelStream()}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[#f3f7ff]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {editor && (
              <div
                className="mt-6 pt-4 border-t text-xs select-none flex flex-wrap items-center gap-3"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  {editor.storage.characterCount?.characters() ?? 0} characters ·{' '}
                  {editor.storage.characterCount?.words() ?? 0} words
                </span>
                {isPredicting && !hasGhostText && (
                  <span className="flex items-center gap-1 text-[#1a73e8] animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] inline-block" />
                    AI continuation in progress…
                  </span>
                )}
                {hasGhostText && (
                  <span className="text-[#1a73e8]">
                    AI continuation available · Tab to accept · Esc to dismiss
                  </span>
                )}
                {(hasGhostText || isPredicting) && (
                  <button
                    onClick={() => cancelStream()}
                    className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:underline"
                  >
                    Dismiss (Esc)
                  </button>
                )}
                {hasGhostText && (
                  <button
                    onClick={() => editor?.commands.acceptGhostText()}
                    className="text-[#1a73e8] hover:underline font-medium"
                  >
                    Accept (Tab)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {editor && editable && onAIAction && (
        <FloatingAIMenu editor={editor} onAIAction={onAIAction} />
      )}
    </div>
  );
}
