import { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tiptap/core';
import { aiApi, parseSSEStream } from '../api/ai';

const GHOST_TRIGGER_DELAY_MS = 6000;

interface UseGhostTextResult {
  ghostText: string;
  isPredicting: boolean;
  acceptGhost: () => void;
  dismissGhost: () => void;
}

export function useGhostText(
  editor: Editor | null,
  docId: string
): UseGhostTextResult {
  const [ghostText, setGhostText] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStreamRef = useRef<boolean>(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissGhost = useCallback(() => {
    setGhostText('');
    setIsPredicting(false);
    activeStreamRef.current = false;
    clearTimer();
  }, [clearTimer]);

  const acceptGhost = useCallback(() => {
    if (!editor || !ghostText) return;
    editor.commands.insertContent(ghostText);
    dismissGhost();
  }, [editor, ghostText, dismissGhost]);

  const triggerAutocomplete = useCallback(async () => {
    if (!editor || !docId || activeStreamRef.current) return;

    const { state } = editor;
    const { selection } = state;
    const pos = selection.$head.pos;

    const textBefore = state.doc.textBetween(0, pos, '\n', '\n');
    const textAfter = state.doc.textBetween(pos, state.doc.content.size, '\n', '\n');

    // Only trigger if there's meaningful content before cursor
    if (textBefore.trim().length < 10) return;

    activeStreamRef.current = true;
    setIsPredicting(true);
    setGhostText('');

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
          setGhostText((prev) => prev + chunk.chunk);
        }
      }

      if (isMountedRef.current) {
        setIsPredicting(false);
      }
    } catch {
      if (isMountedRef.current) {
        setIsPredicting(false);
        setGhostText('');
      }
      activeStreamRef.current = false;
    }
  }, [editor, docId]);

  // Watch editor updates and schedule autocomplete
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Dismiss any existing ghost text on typing
      if (ghostText || isPredicting) {
        dismissGhost();
      }

      clearTimer();

      timerRef.current = setTimeout(() => {
        triggerAutocomplete();
      }, GHOST_TRIGGER_DELAY_MS);
    };

    editor.on('update', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      clearTimer();
    };
  }, [editor, ghostText, isPredicting, dismissGhost, clearTimer, triggerAutocomplete]);

  // Keyboard shortcuts: Tab to accept, Escape to dismiss
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!ghostText && !isPredicting) return;

      if (event.key === 'Tab' && ghostText) {
        event.preventDefault();
        acceptGhost();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        dismissGhost();
      }
    };

    const editorEl = editor.view.dom;
    editorEl.addEventListener('keydown', handleKeyDown);

    return () => {
      editorEl.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, ghostText, isPredicting, acceptGhost, dismissGhost]);

  return { ghostText, isPredicting, acceptGhost, dismissGhost };
}
