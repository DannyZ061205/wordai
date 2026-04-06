import { useState } from 'react';
import { Editor } from '@tiptap/core';
import {
  Pencil,
  FileText,
  Globe,
  Expand,
  SpellCheck,
  MessageSquare,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';
import { FeatureButton } from './FeatureButton';
import { AIResultCard } from './AIResultCard';
import { Button } from '../shared/Button';
import { Select } from '../shared/Select';
import { useAI } from '../../hooks/useAI';
import { AIFeature, AIInteraction } from '../../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface AIPanelProps {
  editor: Editor | null;
  docId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isPredicting?: boolean;
  interactions?: AIInteraction[];
}

type Tab = 'tools' | 'history';

const FEATURES: Array<{
  id: AIFeature;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  needsSelection: boolean;
}> = [
  {
    id: 'rewrite',
    label: 'Rewrite',
    description: 'Rewrite selected text with better clarity',
    icon: <Pencil className="w-4 h-4" />,
    color: '#1a73e8',
    needsSelection: true,
  },
  {
    id: 'summarize',
    label: 'Summarise',
    description: 'Condense selected text into key points',
    icon: <FileText className="w-4 h-4" />,
    color: '#34a853',
    needsSelection: true,
  },
  {
    id: 'translate',
    label: 'Translate',
    description: 'Translate selected text to another language',
    icon: <Globe className="w-4 h-4" />,
    color: '#fbbc04',
    needsSelection: true,
  },
  {
    id: 'expand',
    label: 'Expand',
    description: 'Elaborate and add more detail to selected text',
    icon: <Expand className="w-4 h-4" />,
    color: '#e9c46a',
    needsSelection: true,
  },
  {
    id: 'grammar',
    label: 'Grammar Check',
    description: 'Fix grammar, spelling and style issues',
    icon: <SpellCheck className="w-4 h-4" />,
    color: '#457b9d',
    needsSelection: true,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Ask AI anything about your selected text',
    icon: <MessageSquare className="w-4 h-4" />,
    color: '#6d6875',
    needsSelection: false,
  },
];

const FEATURE_LABELS: Record<AIFeature, string> = {
  rewrite: 'Rewrite',
  summarize: 'Summarise',
  translate: 'Translate',
  expand: 'Expand',
  grammar: 'Grammar',
  custom: 'Custom',
  autocomplete: 'Autocomplete',
};

function FeatureBadge({ feature }: { feature: AIFeature }) {
  const colors: Record<AIFeature, string> = {
    rewrite: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    summarize: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    translate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    expand: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    grammar: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    custom: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    autocomplete: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  };

  return (
    <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', colors[feature])}>
      {FEATURE_LABELS[feature]}
    </span>
  );
}

export function AIPanel({
  editor,
  docId,
  isCollapsed,
  onToggleCollapse,
  isPredicting = false,
  interactions = [],
}: AIPanelProps) {
  const [tab, setTab] = useState<Tab>('tools');
  const [activeFeature, setActiveFeature] = useState<AIFeature | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [translateLang, setTranslateLang] = useState('Spanish');
  const [rewriteTone, setRewriteTone] = useState('professional');

  const { loading, result, interactionId, error, streamAI, accept, reject, clear } =
    useAI(docId);

  const getSelectedText = () => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  };

  const hasSelection = !!getSelectedText();

  const handleRunFeature = async (featureId: AIFeature) => {
    const selectedText = getSelectedText();
    if (!selectedText && featureId !== 'custom') {
      toast.error('Please select some text first');
      return;
    }

    setActiveFeature(featureId);
    clear();

    const options: Record<string, unknown> = {};
    if (featureId === 'translate') options.language = translateLang;
    if (featureId === 'rewrite') options.tone = rewriteTone;
    if (featureId === 'custom') options.prompt = customPrompt;

    toast.success(`Running ${FEATURE_LABELS[featureId]}...`, { duration: 1500 });

    await streamAI({
      feature: featureId,
      selected_text: selectedText,
      options,
    });
  };

  const handleAccept = async (text: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from !== to) {
      editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, text).run();
    } else {
      editor.commands.insertContent(text);
    }
    await accept(text);
    clear();
    setActiveFeature(null);
    toast.success('AI suggestion accepted');
  };

  const handleReject = async () => {
    await reject();
    setActiveFeature(null);
    toast('Suggestion rejected', { icon: '👎' });
  };

  return (
    <div
      className={clsx(
        'flex flex-col h-full border-r transition-all duration-300 ease-in-out',
        'bg-[color:var(--bg-sidebar)]',
        'border-[color:var(--border)]',
        isCollapsed ? 'w-12' : 'w-80'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggleCollapse}
        className={clsx(
          'absolute top-[calc(50%)] z-10 -right-3',
          'w-6 h-6 rounded-full shadow-md flex items-center justify-center',
          'bg-[color:var(--bg-surface)] border border-[color:var(--border)]',
          'hover:bg-[color:var(--primary-light)] hover:border-[#1a73e8] transition-colors',
          'text-[color:var(--text-secondary)]'
        )}
        aria-label={isCollapsed ? 'Expand AI panel' : 'Collapse AI panel'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {isCollapsed ? (
        /* Collapsed state — icon column */
        <div className="flex flex-col items-center py-4 gap-4">
          <button
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-[color:var(--border)] transition-colors"
            aria-label="Open AI panel"
          >
            <Sparkles className="w-5 h-5 text-[#1a73e8]" />
          </button>
        </div>
      ) : (
        /* Expanded state */
        <>
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <Sparkles className="w-4 h-4 text-[#1a73e8] flex-shrink-0" />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              AI Assistant
            </span>
            {isPredicting && (
              <span className="ml-auto flex items-center gap-1 text-xs text-[#1a73e8] animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Predicting…
              </span>
            )}
          </div>

          {/* Tabs */}
          <div
            className="flex border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            {(['tools', 'history'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'flex-1 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px',
                  tab === t
                    ? 'border-[#1a73e8] text-[#1a73e8]'
                    : 'border-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'
                )}
              >
                {t === 'tools' ? 'AI Tools' : 'History'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'tools' ? (
              <div className="p-3 space-y-3">
                {/* Selection hint */}
                <div
                  className={clsx(
                    'px-3 py-2 rounded-lg text-xs transition-colors',
                    hasSelection
                      ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a3a5c]'
                      : 'bg-[color:var(--border)] text-[color:var(--text-secondary)]'
                  )}
                >
                  {hasSelection
                    ? `Text selected — ready for AI`
                    : 'Select text in the editor to use AI features'}
                </div>

                {/* Feature buttons */}
                <div className="space-y-1.5">
                  {FEATURES.map((feature) => (
                    <div key={feature.id}>
                      <FeatureButton
                        icon={feature.icon}
                        label={feature.label}
                        description={feature.description}
                        color={feature.color}
                        active={activeFeature === feature.id}
                        disabled={feature.needsSelection && !hasSelection}
                        onClick={() => {
                          if (activeFeature === feature.id) {
                            setActiveFeature(null);
                          } else {
                            setActiveFeature(feature.id);
                            clear();
                          }
                        }}
                      />

                      {/* Feature options (shown when selected) */}
                      {activeFeature === feature.id && !result && !loading && (
                        <div className="mt-2 ml-2 p-3 rounded-lg bg-[color:var(--border)] space-y-2">
                          {feature.id === 'translate' && (
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                Target language
                              </label>
                              <Select
                                value={translateLang}
                                onChange={setTranslateLang}
                                options={['Spanish', 'French', 'German', 'Arabic', 'Chinese', 'Japanese', 'Portuguese', 'Russian', 'Hindi'].map(l => ({ label: l, value: l }))}
                                size="sm"
                              />
                            </div>
                          )}

                          {feature.id === 'rewrite' && (
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                Tone
                              </label>
                              <Select
                                value={rewriteTone}
                                onChange={setRewriteTone}
                                options={['professional', 'casual', 'concise', 'academic', 'persuasive', 'creative'].map(t => ({ label: t, value: t }))}
                                size="sm"
                              />
                            </div>
                          )}

                          {feature.id === 'custom' && (
                            <div>
                              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                Your instruction
                              </label>
                              <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="e.g. Make this more engaging..."
                                className="w-full text-xs px-2 py-1.5 rounded border bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] border-[color:var(--border)] focus:outline-none focus:ring-1 focus:ring-[#1a73e8] resize-none"
                                rows={3}
                              />
                            </div>
                          )}

                          <Button
                            size="sm"
                            fullWidth
                            onClick={() => handleRunFeature(feature.id)}
                            loading={loading}
                            icon={<Sparkles className="w-3.5 h-3.5" />}
                          >
                            Run {feature.label}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Result card */}
                {(result || loading) && (
                  <div className="mt-2">
                    <AIResultCard
                      result={result}
                      loading={loading}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      onClear={() => { clear(); setActiveFeature(null); }}
                    />
                  </div>
                )}

                {error && (
                  <div className="px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-[#d93025]">
                    Error: {error}
                  </div>
                )}
              </div>
            ) : (
              /* History tab */
              <div className="p-3 space-y-2">
                {interactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <History className="w-8 h-8 text-[color:var(--border)]" />
                    <p className="text-sm text-[color:var(--text-secondary)] text-center">
                      No AI interactions yet
                    </p>
                  </div>
                ) : (
                  interactions.map((item) => (
                    <InteractionItem key={item.id} item={item} />
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InteractionItem({ item }: { item: AIInteraction }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded((p) => !p)}
      className="w-full text-left p-3 rounded-lg border border-[color:var(--border)] hover:border-[#1a73e8]/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-1.5">
        <FeatureBadge feature={item.feature} />
        <div className="flex items-center gap-1.5">
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
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {format(new Date(item.created_at), 'h:mm a')}
          </span>
        </div>
      </div>

      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
        Input: {item.input_text.slice(0, 60)}{item.input_text.length > 60 ? '…' : ''}
      </p>

      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
              Input
            </p>
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{item.input_text}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
              Response
            </p>
            <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{item.response_text}</p>
          </div>
        </div>
      )}
    </button>
  );
}
