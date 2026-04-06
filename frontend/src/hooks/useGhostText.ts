import { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tiptap/core';
import { aiApi, parseSSEStream } from '../api/ai';
import { ghostTextPluginKey } from '../extensions/GhostTextExtension';

// How long after the user stops typing before we request a suggestion
const GHOST_TRIGGER_DELAY_MS = 3000;
// Minimum characters before cursor before we bother predicting
const MIN_CHARS_BEFORE = 20;

interface UseGhostTextResult {
  hasGhostText: boolean;
  isPredicting: boolean;
  cancelStream: () => void;
}

export function useGhostText(
  editor: Editor | null,
  docId: string
): UseGhostTextResult {
  // Mirror plugin state into React so buttons/hints re-render correctly
  const [hasGhostText, setHasGhostText] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStreamRef = useRef(false);
  const accumulatedRef = useRef('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep React state in sync with ProseMirror plugin state
  useEffect(() => {
    if (!editor) return;
    const syncState = () => {
      const ghost = ghostTextPluginKey.getState(editor.state);
      setHasGhostText(!!ghost?.text);
      setIsPredicting(!!ghost?.isPredicting);
    };
    editor.on('transaction', syncState);
    return () => { editor.off('transaction', syncState); };
  }, [editor]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelStream = useCallback(() => {
    activeStreamRef.current = false;
    accumulatedRef.current = '';
    clearTimer();
    editor?.commands.clearGhostText();
  }, [editor, clearTimer]);

  const triggerAutocomplete = useCallback(async () => {
    if (!editor || !docId || activeStreamRef.current) return;

    const { state } = editor;
    const pos = state.selection.$head.pos;
    const textBefore = state.doc.textBetween(0, pos, '\n', '\n');
    const textAfter = state.doc.textBetween(pos, state.doc.content.size, '\n', '\n');

    if (textBefore.trim().length < MIN_CHARS_BEFORE) return;

    // If the text before cursor doesn't end with whitespace, the AI continuation
    // needs a leading space so the two sentences don't run together.
    const needsLeadingSpace = textBefore.length > 0 && !/[\s\n]$/.test(textBefore);

    activeStreamRef.current = true;
    accumulatedRef.current = '';
    editor.commands.setGhostText('', true);

    // Returns accumulated text with a leading space prepended when required.
    const displayText = () => {
      const t = accumulatedRef.current;
      return needsLeadingSpace && t.length > 0 && !/^[\s\n]/.test(t) ? ' ' + t : t;
    };

    try {
      const stream = await aiApi.stream(docId, {
        feature: 'autocomplete',
        selected_text: '',
        context_before: textBefore,
        context_after: textAfter,
      });

      const generator = parseSSEStream(stream);

      for await (const chunk of generator) {
        if (!isMountedRef.current || !activeStreamRef.current) break;
        if (chunk.done) break;
        if (chunk.chunk) {
          accumulatedRef.current += chunk.chunk;
          editor.commands.setGhostText(displayText(), true);
        }
      }

      if (isMountedRef.current && activeStreamRef.current) {
        editor.commands.setGhostText(displayText(), false);
      }
    } catch {
      if (isMountedRef.current) {
        editor.commands.clearGhostText();
      }
    } finally {
      activeStreamRef.current = false;
    }
  }, [editor, docId]);

  // On every editor update: cancel the current stream and schedule a new one
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // If a stream is active, cancel it (user is typing — suggestion is stale)
      if (activeStreamRef.current) {
        cancelStream();
      }
      clearTimer();
      timerRef.current = setTimeout(triggerAutocomplete, GHOST_TRIGGER_DELAY_MS);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      clearTimer();
    };
  }, [editor, cancelStream, clearTimer, triggerAutocomplete]);

  return { hasGhostText, isPredicting, cancelStream };
}
