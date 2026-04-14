import { useState, useMemo } from 'react';
import { Check, X, Edit3, Copy, Square, Undo2, ListChecks } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../shared/Button';
import toast from 'react-hot-toast';

interface AIResultCardProps {
  result: string;
  loading: boolean;
  originalText?: string;
  feature?: string | null;
  onAccept: (text: string) => void;
  onReject: () => void;
  onClear: () => void;
  onCancel?: () => void;
  onUndo?: () => void;
}

type SplitType = 'paragraph' | 'newline' | 'sentence';

function getHeaderTitle(feature?: string | null): string {
  switch (feature) {
    case 'rewrite':
      return 'Rewrite suggestion';
    case 'summarize':
      return 'Summary suggestion';
    case 'translate':
      return 'Translation suggestion';
    case 'expand':
      return 'Expansion suggestion';
    case 'grammar':
      return 'Grammar suggestion';
    default:
      return 'AI Result';
  }
}

function splitIntoSegments(text: string): { segments: string[]; splitType: SplitType } {
  // Priority 1: double newlines (paragraphs)
  if (/\n{2,}/.test(text)) {
    const segs = text.split(/\n{2,}/).filter((s) => s.trim().length > 0);
    if (segs.length > 1) return { segments: segs, splitType: 'paragraph' };
  }
  // Priority 2: single newlines
  if (/\n/.test(text)) {
    const segs = text.split(/\n/).filter((s) => s.trim().length > 0);
    if (segs.length > 1) return { segments: segs, splitType: 'newline' };
  }
  // Priority 3: sentences
  const segs = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (segs.length > 1) return { segments: segs, splitType: 'sentence' };
  return { segments: [text], splitType: 'sentence' };
}

function joinSegments(selected: string[], splitType: SplitType): string {
  if (splitType === 'paragraph') return selected.join('\n\n');
  if (splitType === 'newline') return selected.join('\n');
  return selected.join(' ');
}

export function AIResultCard({
  result,
  loading,
  originalText,
  feature,
  onAccept,
  onReject,
  onClear,
  onCancel,
  onUndo,
}: AIResultCardProps) {
  const [mode, setMode] = useState<'preview' | 'edit' | 'partial'>('preview');
  const [editedText, setEditedText] = useState('');
  const [checkedSegments, setCheckedSegments] = useState<Set<number>>(new Set());

  const { segments, splitType } = useMemo(() => splitIntoSegments(result || ''), [result]);

  const showComparison = Boolean(
    originalText?.trim() &&
      ['rewrite', 'summarize', 'translate', 'expand', 'grammar'].includes(feature ?? '')
  );
  const headerTitle = mode === 'partial' ? `${checkedSegments.size} of ${segments.length} selected` : getHeaderTitle(feature);
  const hasMultipleSegments = segments.length > 1;

  const handleAccept = () => {
    const textToInsert = mode === 'edit' ? editedText : result;
    onAccept(textToInsert);
    setMode('preview');
    setEditedText('');
  };

  const handlePartialAccept = () => {
    setEditedText(result);
    setMode('edit');
  };

  const handleEnterPartial = () => {
    // Start with all segments checked
    setCheckedSegments(new Set(segments.map((_, i) => i)));
    setMode('partial');
  };

  const handleAcceptPartial = () => {
    const selected = segments.filter((_, i) => checkedSegments.has(i));
    onAccept(joinSegments(selected, splitType));
    setMode('preview');
    setCheckedSegments(new Set());
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard');
  };

  const toggleSegment = (idx: number) => {
    setCheckedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectAll = () => setCheckedSegments(new Set(segments.map((_, i) => i)));
  const handleSelectNone = () => setCheckedSegments(new Set());

  const selectedCount = checkedSegments.size;

  return (
    <div
      className={clsx(
        'rounded-xl border overflow-hidden',
        'bg-gradient-to-b from-[#e8f0fe]/30 to-transparent dark:from-[#1a3a5c]/20',
        'border-[#1a73e8]/30'
      )}
    >
      {/* Result header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a73e8]/20">
        <span className="text-xs font-semibold text-[#1a73e8] uppercase tracking-wide">
          {headerTitle}
        </span>
        <div className="flex items-center gap-1">
          {loading && onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
              aria-label="Stop generation"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop
            </button>
          )}
          {!loading && result && mode !== 'partial' && (
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
              aria-label="Copy result"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {mode === 'partial' && (
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={handleSelectAll}
                className="text-xs text-[#1a73e8] hover:underline font-medium"
                aria-label="Select all segments"
              >
                All
              </button>
              <span className="text-[color:var(--text-secondary)] text-xs">/</span>
              <button
                onClick={handleSelectNone}
                className="text-xs text-[#1a73e8] hover:underline font-medium"
                aria-label="Select no segments"
              >
                None
              </button>
            </div>
          )}
          <button
            onClick={() => { onClear(); setMode('preview'); setEditedText(''); setCheckedSegments(new Set()); }}
            className="p-1 rounded hover:bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
            aria-label="Clear result"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {mode === 'preview' && (
          <div className="space-y-3">
            {showComparison ? (
              <div className="space-y-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 max-h-[160px] overflow-y-auto">
                  <div className="text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.2em] mb-2">
                    Original
                  </div>
                  <div className="text-sm leading-6 text-[color:var(--text-primary)] whitespace-pre-wrap">
                    {originalText}
                  </div>
                </div>
                <div className="rounded-xl border border-[#1a73e8]/25 bg-[#eff6ff] dark:bg-[#10243a] p-3 max-h-[180px] overflow-y-auto shadow-sm">
                  <div className="text-[var(--text-secondary)] text-[10px] uppercase tracking-[0.2em] mb-2">
                    Suggestion
                  </div>
                  <div className="text-sm leading-6 text-[color:var(--text-primary)] dark:text-[var(--text-primary)] whitespace-pre-wrap">
                    {loading && !result ? (
                      <span className="animate-pulse">AI is thinking...</span>
                    ) : (
                      <>
                        {result}
                        {loading && (
                          <span className="inline-block w-0.5 h-4 bg-[#1a73e8] animate-pulse ml-0.5 align-middle" />
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={clsx(
                  'text-sm leading-relaxed min-h-[80px] max-h-[300px] overflow-y-auto',
                  'text-[color:var(--text-primary)] whitespace-pre-wrap',
                  loading && !result && 'text-[color:var(--text-secondary)] italic'
                )}
              >
                {loading && !result ? (
                  <span className="animate-pulse">AI is thinking...</span>
                ) : (
                  <>
                    {result}
                    {loading && (
                      <span className="inline-block w-0.5 h-4 bg-[#1a73e8] animate-pulse ml-0.5 align-middle" />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'edit' && (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className={clsx(
              'w-full text-sm leading-relaxed min-h-[120px] max-h-[300px]',
              'bg-transparent text-[color:var(--text-primary)]',
              'border border-[#1a73e8]/30 rounded-md p-2',
              'focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-[#1a73e8]',
              'resize-none'
            )}
            autoFocus
          />
        )}

        {mode === 'partial' && (
          <ul className="max-h-[300px] overflow-y-auto space-y-1.5 pr-0.5">
            {segments.map((seg, idx) => {
              const checked = checkedSegments.has(idx);
              return (
                <li key={idx}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`Segment ${idx + 1}`}
                    onClick={() => toggleSegment(idx)}
                    className="flex items-start gap-2 w-full text-left group select-none focus:outline-none"
                  >
                    {/* Custom checkbox indicator */}
                    <span
                      className={clsx(
                        'mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                        checked
                          ? 'bg-[#1a73e8] border-[#1a73e8]'
                          : 'border-[color:var(--text-secondary)] group-hover:border-[#1a73e8]'
                      )}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <span
                      className={clsx(
                        'text-sm leading-relaxed transition-all',
                        checked
                          ? 'text-[color:var(--text-primary)]'
                          : 'line-through opacity-50 text-[color:var(--text-secondary)]'
                      )}
                    >
                      {seg}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Actions */}
      {!loading && result && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#1a73e8]/20 flex-wrap">
          {mode === 'preview' && (
            <>
              <Button
                size="sm"
                onClick={handleAccept}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                Apply suggestion
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePartialAccept}
                icon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit first
              </Button>
              {hasMultipleSegments && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleEnterPartial}
                  icon={<ListChecks className="w-3.5 h-3.5" />}
                >
                  Select parts
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={onReject}
                icon={<X className="w-3.5 h-3.5" />}
              >
                Reject
              </Button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <Button
                size="sm"
                onClick={handleAccept}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                Accept edited
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMode('preview')}
              >
                Cancel edit
              </Button>
            </>
          )}

          {mode === 'partial' && (
            <>
              <Button
                size="sm"
                onClick={handleAcceptPartial}
                disabled={selectedCount === 0}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                {selectedCount === segments.length ? 'Accept all' : `Accept ${selectedCount} part${selectedCount !== 1 ? 's' : ''}`}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMode('preview')}
              >
                Back
              </Button>
            </>
          )}
        </div>
      )}

      {/* Undo banner — shown after acceptance */}
      {onUndo && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#1a73e8]/20 bg-green-50/50 dark:bg-green-900/10">
          <span className="text-xs text-green-700 dark:text-green-400">Suggestion applied</span>
          <button
            onClick={onUndo}
            className="flex items-center gap-1 text-xs font-medium text-[#1a73e8] hover:underline"
            aria-label="Undo acceptance"
          >
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
