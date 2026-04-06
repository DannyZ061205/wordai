import { useState, useEffect, useRef } from 'react';
import { X, Clock, RotateCcw, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Button } from '../shared/Button';
import { documentsApi } from '../../api/documents';
import { Version } from '../../types';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  onRestore: () => void;
}

function VersionPreview({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: false,
  });

  const prevContent = useRef(content);
  useEffect(() => {
    if (editor && content !== prevContent.current) {
      prevContent.current = content;
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div className="prose prose-sm max-w-none text-[color:var(--text-primary)]">
      <EditorContent editor={editor} />
    </div>
  );
}

export function VersionHistoryPanel({
  isOpen,
  onClose,
  docId,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    documentsApi
      .getVersions(docId)
      .then((v) => {
        const sorted = [...v].sort((a, b) => b.version_number - a.version_number);
        setVersions(sorted);
        if (sorted.length > 0) setSelectedVersion(sorted[0]);
      })
      .catch(() => toast.error('Failed to load version history'))
      .finally(() => setLoading(false));
  }, [isOpen, docId]);

  const handleRestore = async () => {
    if (!selectedVersion) return;
    setRestoring(true);
    try {
      await documentsApi.restoreVersion(docId, selectedVersion.id);
      toast.success(`Restored to version ${selectedVersion.version_number}`);
      onRestore();
      onClose();
    } catch {
      toast.error('Failed to restore version');
    } finally {
      setRestoring(false);
      setConfirmRestore(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-full w-[480px] z-40',
          'bg-[color:var(--bg-surface)] border-l border-[color:var(--border)]',
          'shadow-2xl flex flex-col transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#1a73e8]" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Version History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[color:var(--border)] transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Versions list */}
          <div
            className="w-48 border-r flex-shrink-0 overflow-y-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-5 h-5 border-2 border-[#1a73e8] border-t-transparent rounded-full" />
              </div>
            ) : versions.length === 0 ? (
              <p className="p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                No versions saved yet.
              </p>
            ) : (
              <div className="py-2">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVersion(v)}
                    className={clsx(
                      'w-full text-left px-4 py-3 transition-colors border-l-2',
                      selectedVersion?.id === v.id
                        ? 'border-[#1a73e8] bg-[#e8f0fe] dark:bg-[#1a3a5c]'
                        : 'border-transparent hover:bg-[color:var(--border)]'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        v{v.version_number}
                      </span>
                      {selectedVersion?.id === v.id && (
                        <ChevronRight className="w-3.5 h-3.5 text-[#1a73e8]" />
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(v.created_at), 'MMM d, h:mm a')}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedVersion ? (
              <>
                <div
                  className="flex-1 overflow-y-auto p-6"
                  style={{ background: 'var(--bg-app)' }}
                >
                  <div
                    className="bg-white dark:bg-[#2d2d2d] rounded-lg p-8 shadow-sm min-h-[400px]"
                  >
                    <VersionPreview content={selectedVersion.content} />
                  </div>
                </div>

                <div
                  className="p-4 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {!confirmRestore ? (
                    <Button
                      onClick={() => setConfirmRestore(true)}
                      icon={<RotateCcw className="w-4 h-4" />}
                      fullWidth
                    >
                      Restore version {selectedVersion.version_number}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                        This will replace the current document. Are you sure?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmRestore(false)}
                          fullWidth
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          onClick={handleRestore}
                          loading={restoring}
                          fullWidth
                        >
                          Yes, restore
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Select a version to preview
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
