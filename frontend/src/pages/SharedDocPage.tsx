import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sparkles, ExternalLink, Eye, Edit3 } from 'lucide-react';
import { Spinner } from '../components/shared/Spinner';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { documentsApi } from '../api/documents';
import { Document } from '../types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link2 from '@tiptap/extension-link';
import { EditorProvider, useEditorContext } from '../components/editor/EditorContext';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import { AIPanel } from '../components/ai/AIPanel';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { AIFeature, Collaborator } from '../types';

interface SharedDoc extends Document {
  role: string;
}

// Live read-only viewer — receives real-time updates via the same WebSocket
// protocol the editors use, but never broadcasts its own changes.
function ReadOnlyViewer({
  content,
  docId,
  shareToken,
}: {
  content: string;
  docId: string;
  shareToken?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link2.configure({ openOnClick: true }),
    ],
    content,
    editable: false,
  });

  // Subscribe to live edits (receive-only because editor.isEditable === false).
  useRealtimeSync(editor, docId, shareToken, true);

  return (
    <div
      className="bg-white dark:bg-[#2d2d2d] rounded-lg mx-auto max-w-[800px] my-8"
      style={{
        boxShadow: '0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.05)',
        padding: '80px 64px',
        minHeight: '800px',
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

export function SharedDocPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    documentsApi
      .getViaLink(token)
      .then((d) => setDoc(d as SharedDoc))
      .catch(() => setError('This link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-app)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#1a73e8] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-[#1a73e8]">wordAI</span>
        </div>

        {doc && (
          <div className="flex-1 mx-6 flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
              style={{
                background: doc.role === 'editor' ? '#e8f0fe' : 'var(--border)',
                color: doc.role === 'editor' ? '#1a73e8' : 'var(--text-secondary)',
              }}
            >
              {doc.role === 'editor' ? (
                <Edit3 className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>
                "{doc.title}" — {doc.role === 'editor' ? 'editing via shared link' : 'view only'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[#1a73e8] text-white hover:bg-[#1557b0] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Sign in</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto px-4">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Spinner size="lg" className="text-[#1a73e8]" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Link not available
            </h2>
            <p className="text-sm text-center max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              {error}
            </p>
            <Link
              to="/"
              className="mt-2 px-4 py-2 rounded-full bg-[#1a73e8] text-white text-sm font-medium hover:bg-[#1557b0] transition-colors"
            >
              Go to wordAI
            </Link>
          </div>
        ) : doc ? (
          doc.role === 'editor' ? (
            // Editor role: full editor + AI Panel, same as the main app.
            <EditorProvider>
              <SharedEditorView doc={doc} shareToken={token!} />
            </EditorProvider>
          ) : (
            // Viewer role: read-only but still subscribes to live updates
            <ReadOnlyViewer content={doc.content} docId={doc.id} shareToken={token} />
          )
        ) : null}
      </main>
    </div>
  );
}

// Inner component so it can consume EditorContext populated by RichTextEditor.
function SharedEditorView({ doc, shareToken }: { doc: SharedDoc; shareToken: string }) {
  const { editor } = useEditorContext();
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [featureRequest, setFeatureRequest] = useState<{
    feature: AIFeature;
    key: number;
  } | null>(null);

  const handleAIAction = useCallback(
    (feature: 'rewrite' | 'summarize' | 'translate', _text: string) => {
      setAiPanelCollapsed(false);
      setFeatureRequest({ feature, key: Date.now() });
    },
    [],
  );

  return (
    <div className="flex h-[calc(100vh-60px)] min-h-0">
      <div className="relative flex-shrink-0">
        <AIPanel
          editor={editor}
          docId={doc.id}
          isCollapsed={aiPanelCollapsed}
          onToggleCollapse={() => setAiPanelCollapsed((p) => !p)}
          shareToken={shareToken}
          requestedFeature={featureRequest}
        />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <RichTextEditor
          docId={doc.id}
          initialContent={doc.content}
          editable={true}
          shareToken={shareToken}
          onContentChange={() => {}}
          onAIAction={handleAIAction}
          onCollaboratorsChange={setCollaborators}
        />
      </div>
    </div>
  );
}