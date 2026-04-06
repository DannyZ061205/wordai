import { useEffect, useRef, useCallback } from 'react';
import { documentsApi } from '../api/documents';
import { useDocumentStore } from '../store/document';

const DEBOUNCE_MS = 1500;

export function useAutoSave(docId: string | null, content: string) {
  const setSaveStatus = useDocumentStore((s) => s.setSaveStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent = useRef<string>(content);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const save = useCallback(
    async (text: string) => {
      if (!docId) return;
      if (text === lastSavedContent.current) return;

      setSaveStatus('saving');
      try {
        await documentsApi.update(docId, { content: text });
        if (isMounted.current) {
          lastSavedContent.current = text;
          setSaveStatus('saved');
        }
      } catch {
        if (isMounted.current) {
          setSaveStatus('unsaved');
        }
      }
    },
    [docId, setSaveStatus]
  );

  useEffect(() => {
    if (!docId) return;
    if (content === lastSavedContent.current) return;

    setSaveStatus('unsaved');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      save(content);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, docId, save, setSaveStatus]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
}
