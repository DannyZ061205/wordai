import { useEffect, useRef, useMemo } from 'react';
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

interface RichTextEditorProps {
  docId: string;
  initialContent: string;
  editable?: boolean;
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
  onContentChange,
  onAIAction,
}: RichTextEditorProps) {
  const { setEditor } = useEditorContext();
  const user = useAuthStore((s) => s.user);

  // Create Y.Doc and WebsocketProvider once — stable refs, never recreated
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  if (!providerRef.current && editable && docId) {
    const token = localStorage.getItem('access_token');
    const shareToken = new URLSearchParams(window.location.search).get('share_token');
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
    if (!provider || !user) return;
    provider.awareness.setLocalStateField('user', {
      name: user.username,
      color: getColor(user.id),
      userId: user.id,
    });
  }, [user]);

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
                  name: user?.username ?? 'Anonymous',
                  color: user ? getColor(user.id) : '#999',
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
  useAutoSave(docId, content);

  // Ghost text — rendered inline via ProseMirror decoration (GhostTextExtension)
  const { hasGhostText, isPredicting, cancelStream } = useGhostText(editor, docId);

  return (
    <div className="flex flex-col h-full">
      {editable && <Toolbar editor={editor} />}

      <div className="flex-1 overflow-auto" style={{ background: 'var(--bg-app)' }}>
        <div className="mx-auto my-8 max-w-[800px] px-4">
          <div
            className="relative bg-white dark:bg-[#2d2d2d] rounded-lg"
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.05)',
              minHeight: '1000px',
              padding: '80px 64px',
            }}
          >
            {/* Ghost text is rendered inline at the cursor via GhostTextExtension decoration */}
            <EditorContent editor={editor} />

            {/* Character count + ghost text status */}
            {editor && (
              <div
                className="mt-6 pt-4 border-t text-xs select-none flex items-center gap-3"
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
                    AI writing suggestion…
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
                    onClick={() => editor.commands.acceptGhostText()}
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
