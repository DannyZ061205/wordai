import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Pencil,
  FileText,
  Users,
  Clock,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Button } from '../components/shared/Button';
import { Avatar } from '../components/shared/Avatar';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { Dropdown, DropdownItem, DropdownSeparator } from '../components/shared/Dropdown';
import { Modal } from '../components/shared/Modal';
import { Input } from '../components/shared/Input';
import { Spinner } from '../components/shared/Spinner';
import { documentsApi } from '../api/documents';
import { useDocumentStore } from '../store/document';
import { useAuthStore } from '../store/auth';
import { DocumentListItem } from '../types';

function RoleBadge({ role }: { role: string }) {
  const config = {
    owner: { label: 'Owner', className: 'bg-[#e8f0fe] text-[#1a73e8]' },
    editor: { label: 'Editor', className: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
    viewer: { label: 'Viewer', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  };
  const c = config[role as keyof typeof config] ?? config.viewer;

  return (
    <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', c.className)}>
      {c.label}
    </span>
  );
}

interface DocumentCardProps {
  doc: DocumentListItem;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

function DocumentCard({ doc, onDelete, onRename }: DocumentCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className={clsx(
        'group relative rounded-xl border p-5 cursor-pointer',
        'bg-[color:var(--bg-surface)]',
        'border-[color:var(--border)]',
        'hover:border-[#1a73e8]/50 hover:shadow-md transition-all duration-200',
        'flex flex-col gap-3'
      )}
      onClick={() => navigate(`/doc/${doc.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/doc/${doc.id}`)}
    >
      {/* Document icon */}
      <div className="flex items-start justify-between">
        <div
          className={clsx(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            doc.role === 'owner' ? 'bg-[#e8f0fe]' : 'bg-[color:var(--border)]'
          )}
        >
          <FileText
            className="w-5 h-5"
            style={{ color: doc.role === 'owner' ? '#1a73e8' : 'var(--text-secondary)' }}
          />
        </div>

        {/* 3-dot menu */}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Dropdown
            trigger={
              <button
                className="p-1.5 rounded-md hover:bg-[color:var(--border)] transition-colors"
                aria-label="Document options"
              >
                <MoreVertical className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            }
            align="right"
          >
            <DropdownItem
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => onRename(doc.id, doc.title)}
            >
              Rename
            </DropdownItem>
            {doc.role === 'owner' && (
              <>
                <DropdownSeparator />
                <DropdownItem
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  danger
                  onClick={() => onDelete(doc.id)}
                >
                  Delete
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {/* Title */}
      <div>
        <h3
          className="text-sm font-semibold line-clamp-2 leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {doc.title || 'Untitled document'}
        </h3>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Clock className="w-3.5 h-3.5" />
          <span>{formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}</span>
        </div>
        <div className="flex items-center gap-2">
          {doc.role !== 'owner' && (
            <Users className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
          )}
          <RoleBadge role={doc.role} />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { documents, fetchDocuments, isLoadingDocuments, removeDocument, updateDocumentTitle } =
    useDocumentStore();
  const { user, logout } = useAuthStore();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameModal, setRenameModal] = useState<{ id: string; title: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDocuments().catch(() => toast.error('Failed to load documents'));
  }, [fetchDocuments]);

  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter((d) => d.title.toLowerCase().includes(q));
  }, [documents, search]);

  const handleCreateDocument = async () => {
    setCreating(true);
    try {
      const doc = await documentsApi.create('Untitled document');
      toast.success('Document created');
      navigate(`/doc/${doc.id}`, { state: { doc } });
    } catch {
      toast.error('Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renameModal || !newTitle.trim()) return;
    setRenaming(true);
    try {
      await documentsApi.update(renameModal.id, { title: newTitle.trim() });
      updateDocumentTitle(renameModal.id, newTitle.trim());
      toast.success('Document renamed');
      setRenameModal(null);
    } catch {
      toast.error('Failed to rename document');
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await documentsApi.delete(id);
      removeDocument(id);
      toast.success('Document deleted');
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1a73e8] flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-[#1a73e8] tracking-tight">wordAI</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-[color:var(--border)] transition-colors">
                <Avatar name={user?.username ?? 'User'} size="xs" />
                <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>
                  {user?.username}
                </span>
              </button>
            }
            align="right"
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {user?.username}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {user?.email}
              </p>
            </div>
            <DropdownItem
              icon={<LogOut className="w-3.5 h-3.5" />}
              onClick={handleLogout}
            >
              Sign out
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              My Documents
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={handleCreateDocument}
            loading={creating}
            icon={<Plus className="w-4 h-4" />}
            size="md"
          >
            New document
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            type="search"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={clsx(
              'w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border',
              'bg-[color:var(--bg-surface)] text-[color:var(--text-primary)]',
              'border-[color:var(--border)] focus:border-[#1a73e8]',
              'focus:ring-2 focus:ring-[#1a73e8]/20 focus:outline-none',
              'placeholder:text-[color:var(--text-secondary)]',
              'transition-all duration-150'
            )}
          />
        </div>

        {/* Loading */}
        {isLoadingDocuments ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-[#1a73e8]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* New Document card */}
            <button
              onClick={handleCreateDocument}
              disabled={creating}
              className={clsx(
                'relative rounded-xl border-2 border-dashed p-5 min-h-[160px]',
                'flex flex-col items-center justify-center gap-3',
                'text-[#1a73e8] border-[#1a73e8]/30',
                'hover:border-[#1a73e8] hover:bg-[#e8f0fe]/50 dark:hover:bg-[#1a3a5c]/30',
                'transition-all duration-200 cursor-pointer',
                creating && 'opacity-60 cursor-wait'
              )}
            >
              {creating ? (
                <Spinner className="text-[#1a73e8]" />
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-[#e8f0fe] dark:bg-[#1a3a5c] flex items-center justify-center">
                    <Plus className="w-6 h-6 text-[#1a73e8]" />
                  </div>
                  <span className="text-sm font-semibold">New document</span>
                </>
              )}
            </button>

            {/* Document cards */}
            {filtered.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={(id) => setDeleteConfirm(id)}
                onRename={(id, title) => {
                  setRenameModal({ id, title });
                  setNewTitle(title);
                }}
              />
            ))}

            {/* Empty state */}
            {!isLoadingDocuments && filtered.length === 0 && search && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 gap-2">
                <Search className="w-10 h-10" style={{ color: 'var(--border)' }} />
                <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  No documents found
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Try a different search term
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Rename modal */}
      <Modal
        isOpen={!!renameModal}
        onClose={() => setRenameModal(null)}
        title="Rename document"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Document title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setRenameModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              loading={renaming}
              disabled={!newTitle.trim()}
            >
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete document"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to delete this document? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              loading={deleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
