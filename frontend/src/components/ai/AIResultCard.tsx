import { useState } from 'react';
import { Check, X, Edit3, Copy, Square, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../shared/Button';
import toast from 'react-hot-toast';

interface AIResultCardProps {
  result: string;
  loading: boolean;
  onAccept: (text: string) => void;
  onReject: () => void;
  onClear: () => void;
  onCancel?: () => void;
  onUndo?: () => void;
}

export function AIResultCard({
  result,
  loading,
  onAccept,
  onReject,
  onClear,
  onCancel,
  onUndo,
}: AIResultCardProps) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editedText, setEditedText] = useState('');

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

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied to clipboard');
  };

  return (
    <div
      className={clsx(
        'rounded-xl border overflow-hidden',
        'bg-gradient-to-b from-[#e8f0fe]/30 to-transparent dark:from-[#1a3a5c]/20',
        'border-[#1a73e8]/30'
      )}
    >
      {/* Result header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[#1a73e8]/20"
      >
        <span className="text-xs font-semibold text-[#1a73e8] uppercase tracking-wide">
          AI Result
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
          {!loading && result && (
            <button
              onClick={handleCopy}
              className="p-1 rounded hover:bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
              aria-label="Copy result"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => { onClear(); setMode('preview'); setEditedText(''); }}
            className="p-1 rounded hover:bg-[color:var(--border)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors"
            aria-label="Clear result"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {mode === 'preview' ? (
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
        ) : (
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
      </div>

      {/* Actions */}
      {!loading && result && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-t border-[#1a73e8]/20 flex-wrap"
        >
          {mode === 'preview' ? (
            <>
              <Button
                size="sm"
                onClick={handleAccept}
                icon={<Check className="w-3.5 h-3.5" />}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePartialAccept}
                icon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit first
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onReject}
                icon={<X className="w-3.5 h-3.5" />}
              >
                Reject
              </Button>
            </>
          ) : (
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
