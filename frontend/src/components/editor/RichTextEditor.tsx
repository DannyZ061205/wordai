import { useEffect, useRef, useMemo, useState, useLayoutEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
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
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { useEditorContext } from './EditorContext';
import { Toolbar } from './Toolbar';
import { FloatingAIMenu } from './FloatingAIMenu';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useGhostText } from '../../hooks/useGhostText';
import { useAuthStore } from '../../store/auth';
import { GhostTextExtension } from '../../extensions/GhostTextExtension';
import { Sparkles } from 'lucide-react';

interface RichTextEditorProps {
  docId: string;
  initialContent: string;
  editable?: boolean;
  shareToken?: string;
  onContentChange?: (content: string) => void;
  onAIAction?: (feature: 'rewrite' | 'summarize' | 'translate', text: string) => void;
}

const COLLAB_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a',
  '#f4a261', '#6d6875', '#52b788', '#4cc9f0',
];

function getColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

export function RichTextEditor({
  docId,
  initialContent,
  editable = true,
  shareToken,
  onContentChange,
  onAIAction,
}: RichTextEditorProps) {
  const { setEditor } = useEditorContext();
  const user = useAuthStore((s) => s.user);
  const collaborationUser = user
    ? {
        name: user.username,
        color: getColor(user.id),
        userId: user.id,
      }
    : shareToken
      ? {
          name: 'Guest',
          color: getColor(`guest_${shareToken.slice(0, 8)}`),
          userId: `guest_${shareToken.slice(0, 8)}`,
        }
      : null;

  // Create Y.Doc and WebsocketProvider once — stable refs, never recreated
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  if (!providerRef.current && editable && docId) {
    const token = localStorage.getItem('access_token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000`;
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (shareToken) params.set('share_token', shareToken);
    const roomName = `ws/${docId}?${params.toString()}`;
    providerRef.current = new WebsocketProvider(wsUrl, roomName, ydocRef.current, {
      connect: true,
    });
  }

  // Set awareness after provider exists
  useEffect(() => {
    const provider = providerRef.current;
    if (!provider || !collaborationUser) return;
    provider.awareness.setLocalStateField('user', collaborationUser);
  }, [collaborationUser]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      providerRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
    };
  }, []);

  // Stable extensions — created once, never changes between renders
  const extensions = useMemo(() => [
    StarterKit.configure({ history: false }),
    ...(editable && ydocRef.current
      ? [
          Collaboration.configure({ document: ydocRef.current }),
          ...(providerRef.current
            ? [CollaborationCursor.configure({
                provider: providerRef.current,
                user: {
                  name: collaborationUser?.name ?? 'Anonymous',
                  color: collaborationUser?.color ?? '#999',
                },
              })]
            : []),
        ]
      : []),
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
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onContentChange?.(html);
    },
  });

  // Register editor in context
  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Auto-save
  const content = editor?.getHTML() ?? '';
  useAutoSave(docId, content, shareToken);

  // Ghost text — rendered inline via ProseMirror decoration (GhostTextExtension)
  const { hasGhostText, isPredicting, ghostText, cancelStream } = useGhostText(editor, docId);

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

  // Mount/unmount with a deferred transition:
  //  - Entering: mount → next paint → set revealed=true (plays fade-in).
  //  - Exiting:  set revealed=false (plays fade-out) → unmount after duration.
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
    // While exiting (cardMounted && !cardActive) keep the last position so the
    // card fades out in place rather than snapping to the fallback corner.
    if (!editor || !cardActive) return;
    const update = () => {
      if (!editor || !pageRef.current) return;
      const pos = editor.state.selection.from;
      try {
        const coords = editor.view.coordsAtPos(pos);
        const pageRect = pageRef.current.getBoundingClientRect();
        const left = pageRect.right + CARD_GAP;
        if (left + CARD_WIDTH > window.innerWidth - 8) {
          setCardPos(null); // not enough room → fall back
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
            {/* Ghost text is rendered inline at the cursor via GhostTextExtension decoration */}
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
                  <div className="mb-3 rounded-xl border border-[var(--border)] bg-white p-3 text-[var(--text-primary)] text-sm leading-5">
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
                    onClick={cancelStream}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[#f3f7ff]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Character count + ghost text status */}
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
                    onClick={cancelStream}
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

      {/* Floating AI menu on text selection */}
      {editor && editable && onAIAction && (
        <FloatingAIMenu
          editor={editor}
          onAIAction={onAIAction}
        />
      )}
    </div>
  );
}
