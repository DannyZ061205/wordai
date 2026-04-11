import { useEffect, useRef, useCallback } from 'react';
import { documentsApi } from '../api/documents';
import { useDocumentStore } from '../store/document';

const DEBOUNCE_MS = 1500;

export function useAutoSave(docId: string | null, content: string, shareToken?: string) {
  const setSaveStatus = useDocumentStore((s) => s.setSaveStatus);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent = useRef<string>(content);
  const latestContentRef = useRef<string>(content);
  const isMounted = useRef(true);

  latestContentRef.current = content;

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
        if (shareToken) {
          await documentsApi.updateViaLink(docId, shareToken, { content: text });
        } else {
          await documentsApi.update(docId, { content: text });
        }
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
    [docId, setSaveStatus, shareToken]
  );

  const flushPendingSave = useCallback(
    (text: string) => {
      if (!docId || text === lastSavedContent.current) return;

      const url = new URL(`/api/documents/${docId}`, window.location.origin);
      if (shareToken) {
        url.searchParams.set('share_token', shareToken);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = localStorage.getItem('access_token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      void fetch(url.toString(), {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ content: text }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [docId, shareToken]
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
    const handlePageHide = () => {
      flushPendingSave(latestContentRef.current);
    };

    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      flushPendingSave(latestContentRef.current);
    };
  }, [flushPendingSave]);
}
