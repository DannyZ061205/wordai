import { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { Modal } from '../shared/Modal';
import { aiApi } from '../../api/ai';
import { AIInteraction, AIFeature } from '../../types';
import toast from 'react-hot-toast';

interface AIHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
}

const FEATURE_LABELS: Record<AIFeature, string> = {
  rewrite: 'Rewrite',
  summarize: 'Summarise',
  translate: 'Translate',
  expand: 'Expand',
  grammar: 'Grammar',
  custom: 'Custom',
  autocomplete: 'Autocomplete',
};

const FEATURE_COLORS: Record<AIFeature, string> = {
  rewrite: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  summarize: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  translate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  expand: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  grammar: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  custom: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  autocomplete: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
};

function groupByFeature(
  interactions: AIInteraction[]
): Record<string, AIInteraction[]> {
  return interactions.reduce(
    (acc, item) => {
      const key = item.feature;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, AIInteraction[]>
  );
}

function InteractionCard({ item }: { item: AIInteraction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border rounded-lg overflow-hidden transition-colors"
      style={{ borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-[color:var(--border)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={clsx(
                'px-1.5 py-0.5 rounded text-xs font-medium',
                FEATURE_COLORS[item.feature]
              )}
            >
              {FEATURE_LABELS[item.feature]}
            </span>
            {item.accepted === true && (
              <span className="text-[10px] font-medium text-[#34a853] bg-green-100 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                Accepted
              </span>
            )}
            {item.accepted === false && (
              <span className="text-[10px] font-medium text-[#d93025] bg-red-100 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                Rejected
              </span>
            )}
            {item.accepted === null && (
              <span className="text-[10px] font-medium text-[color:var(--text-secondary)] bg-[color:var(--border)] px-1.5 py-0.5 rounded">
                Pending
              </span>
            )}
            <span className="ml-auto text-xs" style={{ color: 'var(--text-secondary)' }}>
              {format(new Date(item.created_at), 'MMM d, h:mm a')}
            </span>
          </div>
          <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
            {item.input_text.slice(0, 80)}{item.input_text.length > 80 ? '…' : ''}
          </p>
        </div>
        <div className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 pt-2 border-t space-y-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Input
            </p>
            <p
              className="text-sm leading-relaxed p-2.5 rounded-md"
              style={{
                color: 'var(--text-primary)',
                background: 'var(--bg-app)',
              }}
            >
              {item.input_text}
            </p>
          </div>
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              AI Response
            </p>
            <p
              className="text-sm leading-relaxed p-2.5 rounded-md"
              style={{
                color: 'var(--text-primary)',
                background: 'var(--bg-app)',
              }}
            >
              {item.response_text}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AIHistoryModal({ isOpen, onClose, docId }: AIHistoryModalProps) {
  const [interactions, setInteractions] = useState<AIInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    aiApi
      .getHistory(docId)
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setInteractions(sorted);
      })
      .catch(() => toast.error('Failed to load AI history'))
      .finally(() => setLoading(false));
  }, [isOpen, docId]);

  const grouped = groupByFeature(interactions);
  const features = Object.keys(grouped) as AIFeature[];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Interaction History" size="xl">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full" />
        </div>
      ) : interactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <History className="w-12 h-12" style={{ color: 'var(--border)' }} />
          <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
            No AI interactions yet
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Use the AI panel to start getting writing assistance.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-app)' }}>
              <p className="text-2xl font-bold text-[#1a73e8]">{interactions.length}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Total</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-app)' }}>
              <p className="text-2xl font-bold text-[#34a853]">
                {interactions.filter((i) => i.accepted === true).length}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Accepted</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--bg-app)' }}>
              <p className="text-2xl font-bold text-[#d93025]">
                {interactions.filter((i) => i.accepted === false).length}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Rejected</p>
            </div>
          </div>

          {/* Feature filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveGroup(null)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                activeGroup === null
                  ? 'bg-[#1a73e8] text-white'
                  : 'bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
              )}
            >
              All ({interactions.length})
            </button>
            {features.map((f) => (
              <button
                key={f}
                onClick={() => setActiveGroup(activeGroup === f ? null : f)}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  activeGroup === f
                    ? 'bg-[#1a73e8] text-white'
                    : 'bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                {FEATURE_LABELS[f as AIFeature]} ({grouped[f].length})
              </button>
            ))}
          </div>

          {/* Interactions list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {(activeGroup
              ? interactions.filter((i) => i.feature === activeGroup)
              : interactions
            ).map((item) => (
              <InteractionCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
