import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  Clock,
  History,
  Sparkles,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useThemeStore } from '../store/theme';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { EditorProvider, useEditorContext } from '../components/editor/EditorContext';
import { RichTextEditor } from '../components/editor/RichTextEditor';
import { ShareModal } from '../components/editor/ShareModal';
import { VersionHistoryPanel } from '../components/editor/VersionHistoryPanel';
import { AIPanel } from '../components/ai/AIPanel';
import { AIHistoryModal } from '../components/ai/AIHistoryModal';
import { AISettingsModal } from '../components/ai/AISettingsModal';
import { AISetupBanner } from '../components/ai/AISetupBanner';
import { Tooltip } from '../components/shared/Tooltip';
import { Avatar } from '../components/shared/Avatar';
import { Spinner } from '../components/shared/Spinner';
import { documentsApi } from '../api/documents';
import { aiApi } from '../api/ai';
import { settingsApi } from '../api/settings';
import { useDocumentStore } from '../store/document';
import { useAuthStore } from '../store/auth';
import { Document, AIInteraction, Collaborator } from '../types';

const SAVE_STATUS_MAP = {
  saved: { icon: <Check className="w-3.5 h-3.5" />, label: 'Saved', color: '#34a853' },
  saving: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'Saving…', color: '#fbbc04' },
  unsaved: { icon: <CloudOff className="w-3.5 h-3.5" />, label: 'Unsaved', color: '#d93025' },
};

function SaveStatusIndicator() {
  const saveStatus = useDocumentStore((s) => s.saveStatus);
  const status = SAVE_STATUS_MAP[saveStatus];

  return (
    <div
      className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-all duration-300"
      style={{ color: status.color }}
    >
      {status.icon}
      <span className="hidden sm:inline">{status.label}</span>
    </div>
  );
}

interface EditableTitleProps {
  title: string;
  onSave: (title: string) => void;
}

function EditableTitle({ title, onSave }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) {
      onSave(trimmed);
    } else {
      setValue(title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      setValue(title);
      setEditing(false);
    }
  };

  return editing ? (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={clsx(
        'text-sm font-semibold px-2 py-1 rounded-md border',
        'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
        'border-[#1a73e8] ring-2 ring-[#1a73e8]/20 outline-none',
        'min-w-[120px] max-w-[300px]'
      )}
      maxLength={100}
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      className={clsx(
        'text-sm font-semibold px-2 py-1 rounded-md',
        'text-[color:var(--text-primary)]',
        'hover:bg-[color:var(--border)] transition-colors',
        'max-w-[300px] truncate'
      )}
      title="Click to rename"
    >
      {title || 'Untitled document'}
    </button>
  );
}

function EditorPageInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { editor } = useEditorContext();
  const { setCurrentDoc, updateDocumentTitle } = useDocumentStore();
  const user = useAuthStore((s) => s.user);

  // If navigated from dashboard with doc in state, use it immediately (no extra GET)
  const prefetchedDoc = (location.state as { doc?: Document } | null)?.doc ?? null;

  const [doc, setDoc] = useState<Document | null>(prefetchedDoc);
  const [loading, setLoading] = useState(!prefetchedDoc);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);
  const [featureRequest, setFeatureRequest] = useState<{
    feature: 'rewrite' | 'summarize' | 'translate';
    key: number;
  } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [aiHistoryOpen, setAiHistoryOpen] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [aiInteractions, setAiInteractions] = useState<AIInteraction[]>([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  // AI settings state
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null); // null = loading

  // Sync prefetched doc into store
  useEffect(() => {
    if (prefetchedDoc) setCurrentDoc(prefetchedDoc);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load document only when not already available via navigation state
  useEffect(() => {
    if (!id || prefetchedDoc) return;
    setLoading(true);
    documentsApi
      .get(id)
      .then((d) => {
        setDoc(d);
        setCurrentDoc(d);
      })
      .catch(() => {
        toast.error('Document not found');
        navigate('/');
      })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check AI configuration on mount
  useEffect(() => {
    settingsApi.getAI().then((s) => setAiConfigured(s?.is_configured ?? false));
  }, []);

  // Load AI history
  useEffect(() => {
    if (!id) return;
    aiApi
      .getHistory(id)
      .then(setAiInteractions)
      .catch(() => {}); // non-critical
  }, [id]);

  const handleTitleSave = useCallback(
    async (title: string) => {
      if (!id || !doc) return;
      try {
        await documentsApi.update(id, { title });
        setDoc((prev) => (prev ? { ...prev, title } : null));
        updateDocumentTitle(id, title);
      } catch {
        toast.error('Failed to rename document');
      }
    },
    [id, doc, updateDocumentTitle]
  );

  const handleAIAction = useCallback(
    (feature: 'rewrite' | 'summarize' | 'translate', _text: string) => {
      // Open the panel and auto-expand the chosen feature's options.
      setAiPanelCollapsed(false);
      setFeatureRequest({ feature, key: Date.now() });
    },
    []
  );

  const handleVersionRestore = useCallback(async () => {
    if (!id) return;
    try {
      const updated = await documentsApi.get(id);
      setDoc(updated);
      setCurrentDoc(updated);
      // Force full remount of RichTextEditor — tears down old Yjs provider
      // and reconnects with the restored content from scratch
      setEditorKey((k) => k + 1);
      toast.success('Document restored');
    } catch {
      toast.error('Failed to reload document after restore');
    }
  }, [id, setCurrentDoc]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-app)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" className="text-[#1a73e8]" />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading document…
          </p>
        </div>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--bg-app)' }}
    >
      {/* ── Header ──────────────────────────────────────── */}
      <header
        className="flex items-center gap-2 px-4 h-12 flex-shrink-0 border-b z-20"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Left: back + title */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Tooltip content="Back to dashboard">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-md hover:bg-[color:var(--border)] transition-colors flex-shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </Tooltip>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#1a73e8]" />
          </div>

          <EditableTitle title={doc.title} onSave={handleTitleSave} />

          <SaveStatusIndicator />
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Grouped icon actions — floating pill */}
          <HeaderIconGroup
            onAiHistory={() => setAiHistoryOpen(true)}
            onVersionHistory={() => setVersionHistoryOpen(true)}
            onAiSettings={() => setAiSettingsOpen(true)}
          />

          {/* Share */}
          <button
            onClick={() => setShareOpen(true)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium',
              'bg-[#1a73e8] text-white hover:bg-[#1557b0] active:bg-[#13509a]',
              'shadow-sm hover:shadow-md transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/40 focus-visible:ring-offset-2',
            )}
            aria-label="Share document"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>

          {/* User avatar */}
          <Avatar name={user?.username ?? 'U'} size="xs" />
        </div>
      </header>

      {/* ── AI Setup Banner (shown when AI is not configured) ── */}
      {aiConfigured === false && (
        <AISetupBanner onConfigureClick={() => setAiSettingsOpen(true)} />
      )}

      {/* ── Body: AI Panel + Editor ──────────────────── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* AI Panel */}
        <div className="relative flex-shrink-0">
          <AIPanel
            editor={editor}
            docId={doc.id}
            isCollapsed={aiPanelCollapsed}
            onToggleCollapse={() => setAiPanelCollapsed((p) => !p)}
            isPredicting={isPredicting}
            interactions={aiInteractions}
            requestedFeature={featureRequest}
          />
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <RichTextEditor
            key={editorKey}
            docId={doc.id}
            initialContent={doc.content}
            editable={true}
            onContentChange={() => {}}
            onAIAction={handleAIAction}
            onCollaboratorsChange={setCollaborators}
          />
        </div>
      </div>

      {/* ── Modals & Panels ──────────────────────────── */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        docId={doc.id}
        ownerId={doc.owner_id}
      />

      <VersionHistoryPanel
        isOpen={versionHistoryOpen}
        onClose={() => setVersionHistoryOpen(false)}
        docId={doc.id}
        onRestore={handleVersionRestore}
      />

      <AIHistoryModal
        isOpen={aiHistoryOpen}
        onClose={() => setAiHistoryOpen(false)}
        docId={doc.id}
      />

      <AISettingsModal
        isOpen={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        onSaved={() => setAiConfigured(true)}
      />
    </div>
  );
}

export function EditorPage() {
  return (
    <EditorProvider>
      <EditorPageInner />
    </EditorProvider>
  );
}

// ────────────────────────────────────────────────────────────────
// Header icon group: AI history, version history, AI settings,
// theme toggle — all inside a single floating pill.
// ────────────────────────────────────────────────────────────────

interface HeaderIconButtonProps {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function HeaderIconButton({ onClick, label, children }: HeaderIconButtonProps) {
  return (
    <Tooltip content={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={clsx(
          'p-1.5 rounded-md transition-all duration-150',
          'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]',
          'hover:bg-[color:var(--border)]/60 active:bg-[color:var(--border)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]/40',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function HeaderIconGroup({
  onAiHistory,
  onVersionHistory,
  onAiSettings,
}: {
  onAiHistory: () => void;
  onVersionHistory: () => void;
  onAiSettings: () => void;
}) {
  const { theme, toggle } = useThemeStore();
  return (
    <div
      className={clsx(
        'flex items-center gap-0.5 p-1 rounded-full',
        'bg-[color:var(--bg-surface)] border border-[color:var(--border)]',
        'shadow-sm',
      )}
    >
      <HeaderIconButton onClick={onAiHistory} label="AI history">
        <Sparkles className="w-4 h-4" />
      </HeaderIconButton>
      <HeaderIconButton onClick={onVersionHistory} label="Version history">
        <Clock className="w-4 h-4" />
      </HeaderIconButton>
      <HeaderIconButton onClick={onAiSettings} label="AI settings">
        <Settings className="w-4 h-4" />
      </HeaderIconButton>
      <HeaderIconButton
        onClick={toggle}
        label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </HeaderIconButton>
    </div>
  );
}
