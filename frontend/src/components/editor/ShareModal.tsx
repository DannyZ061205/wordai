import { useState, useEffect } from 'react';
import { UserPlus, Link, Copy, Trash2, Crown, Eye, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Avatar } from '../shared/Avatar';
import { documentsApi } from '../../api/documents';
import { Share, ShareLink } from '../../types';
import { useAuthStore } from '../../store/auth';
import { clsx } from 'clsx';
import { format } from 'date-fns';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  ownerId: string;
}

type Tab = 'people' | 'link';

const EXPIRY_OPTIONS = [
  { label: 'Never', value: undefined },
  { label: '1 day', value: 1 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
];

export function ShareModal({ isOpen, onClose, docId, ownerId }: ShareModalProps) {
  const [tab, setTab] = useState<Tab>('people');
  const [shares, setShares] = useState<Share[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [linkRole, setLinkRole] = useState<'editor' | 'viewer'>('viewer');
  const [linkExpiry, setLinkExpiry] = useState<number | undefined>(undefined);
  const [creatingLink, setCreatingLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([documentsApi.getShares(docId), documentsApi.getShareLinks(docId)])
      .then(([s, l]) => {
        setShares(s);
        setShareLinks(l);
      })
      .catch(() => toast.error('Failed to load sharing info'))
      .finally(() => setLoading(false));
  }, [isOpen, docId]);

  const handleInvite = async () => {
    if (!inviteInput.trim()) return;
    setInviting(true);
    try {
      const share = await documentsApi.addShare(docId, inviteInput.trim(), inviteRole);
      setShares((prev) => [...prev, share]);
      setInviteInput('');
      toast.success(`Invited ${share.username}`);
    } catch {
      toast.error('Could not invite user. Check username or email.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveShare = async (userId: string, username: string) => {
    try {
      await documentsApi.removeShare(docId, userId);
      setShares((prev) => prev.filter((s) => s.user_id !== userId));
      toast.success(`Removed ${username}`);
    } catch {
      toast.error('Failed to remove share');
    }
  };

  const handleRoleChange = async (userId: string, role: 'editor' | 'viewer') => {
    try {
      const updated = await documentsApi.updateShareRole(docId, userId, role);
      setShares((prev) => prev.map((s) => (s.user_id === userId ? updated : s)));
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleCreateLink = async () => {
    setCreatingLink(true);
    try {
      const link = await documentsApi.createShareLink(docId, linkRole, linkExpiry);
      setShareLinks((prev) => [...prev, link]);
      toast.success('Share link created');
    } catch {
      toast.error('Failed to create share link');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleRevokeLink = async (token: string) => {
    try {
      await documentsApi.revokeShareLink(docId, token);
      setShareLinks((prev) => prev.filter((l) => l.token !== token));
      toast.success('Link revoked');
    } catch {
      toast.error('Failed to revoke link');
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share document" size="lg">
      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {(['people', 'link'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-[#1a73e8] text-[#1a73e8]'
                : 'border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
            )}
          >
            {t === 'people' ? 'People' : 'Share Link'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full" />
        </div>
      ) : tab === 'people' ? (
        <div className="space-y-5">
          {/* Invite input */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Email or username"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}

              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
              className="px-3 py-2.5 text-sm rounded-md border bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] border-[color:var(--border)] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button
              onClick={handleInvite}
              loading={inviting}
              disabled={!inviteInput.trim()}
              size="md"
            >
              Invite
            </Button>
          </div>

          {/* Shares list */}
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              People with access
            </p>

            {shares.length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
                No one else has access yet.
              </p>
            ) : (
              shares.map((share) => (
                <div
                  key={share.user_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[color:var(--border)] transition-colors"
                >
                  <Avatar name={share.username} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {share.username}
                      </p>
                      {share.user_id === ownerId && (
                        <span className="flex items-center gap-1 text-xs text-[#f9ab00]">
                          <Crown className="w-3 h-3" /> Owner
                        </span>
                      )}
                      {share.user_id === currentUser?.id && (
                        <span className="text-xs text-[color:var(--text-secondary)]">(you)</span>
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {share.email}
                    </p>
                  </div>
                  {share.user_id !== ownerId && (
                    <div className="flex items-center gap-2">
                      <select
                        value={share.role}
                        onChange={(e) => handleRoleChange(share.user_id, e.target.value as 'editor' | 'viewer')}
                        className="text-xs px-2 py-1 rounded border bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] border-[color:var(--border)] focus:outline-none"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveShare(share.user_id, share.username)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-[color:var(--text-secondary)] hover:text-[#d93025] transition-colors"
                        aria-label={`Remove ${share.username}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Create link */}
          <div className="p-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
              Create share link
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={linkRole}
                onChange={(e) => setLinkRole(e.target.value as 'editor' | 'viewer')}
                className="px-3 py-2 text-sm rounded-md border bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] border-[color:var(--border)] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              >
                <option value="viewer">Can view</option>
                <option value="editor">Can edit</option>
              </select>
              <select
                value={linkExpiry ?? ''}
                onChange={(e) =>
                  setLinkExpiry(e.target.value ? Number(e.target.value) : undefined)
                }
                className="px-3 py-2 text-sm rounded-md border bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] border-[color:var(--border)] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ''}>
                    Expires: {opt.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleCreateLink}
                loading={creatingLink}
                icon={<Link className="w-4 h-4" />}
              >
                Generate link
              </Button>
            </div>
          </div>

          {/* Links list */}
          <div className="space-y-2">
            {shareLinks.length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--text-secondary)' }}>
                No share links yet.
              </p>
            ) : (
              shareLinks.map((link) => (
                <div
                  key={link.token}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {link.role === 'editor' ? (
                        <Edit3 className="w-3.5 h-3.5 text-[#1a73e8]" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-[color:var(--text-secondary)]" />
                      )}
                      <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                        {link.role} access
                      </span>
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {`${window.location.origin}/shared/${link.token}`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {link.expires_at
                        ? `Expires ${format(new Date(link.expires_at), 'MMM d, yyyy')}`
                        : 'Never expires'}
                      {' · '}
                      Created {format(new Date(link.created_at), 'MMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyLink(link.token)}
                      className="p-1.5 rounded hover:bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[#1a73e8] transition-colors"
                      aria-label="Copy link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRevokeLink(link.token)}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-[color:var(--text-secondary)] hover:text-[#d93025] transition-colors"
                      aria-label="Revoke link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
