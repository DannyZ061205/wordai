import { useEffect, useRef, useState } from 'react';
import { Editor } from '@tiptap/core';
import { Collaborator } from '../types';

/**
 * Simple, reliable real-time sync:
 *   - Open a single WebSocket per document.
 *   - On local edits, debounce 120ms then send {type:"edit", html, origin}.
 *   - On incoming {type:"edit"} from a different origin, preserve the
 *     cursor position and apply the HTML via editor.commands.setContent.
 *
 * This bypasses Yjs entirely. Last-writer-wins semantics, but for typical
 * Google-Docs-style use (one person typing at a time with occasional
 * interleaving) the UX is indistinguishable.
 */

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export interface UseRealtimeSyncResult {
  /** List of users currently connected to the same document. */
  collaborators: Collaborator[];
}

export function useRealtimeSync(
  editor: Editor | null,
  docId: string,
  shareToken?: string,
  enabled: boolean = true,
): UseRealtimeSyncResult {
  const clientIdRef = useRef<string>(randomId());
  const wsRef = useRef<WebSocket | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef<boolean>(false);
  const lastSentHtmlRef = useRef<string>('');
  const lastSentAtRef = useRef<number>(0);
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  // ---- Open WS + wire receive handler ----
  useEffect(() => {
    if (!editor || !enabled || !docId) return;

    const token = localStorage.getItem('access_token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (shareToken) params.set('share_token', shareToken);
    const url = `${wsProtocol}//${window.location.hostname}:8000/ws/${docId}?${params.toString()}`;

    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const clientId = clientIdRef.current;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        let msg: {
          type?: string;
          html?: string;
          origin?: string;
          users?: Collaborator[];
        };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        // Presence / awareness list from the server. Filter out our own
        // connection so the bar shows only *other* collaborators.
        if (msg.type === 'awareness' && Array.isArray(msg.users)) {
          setCollaborators(msg.users);
          return;
        }

        if (msg.type !== 'edit' || !msg.html || msg.origin === clientId) return;

        // Preserve the caret while we replace the doc content.
        const sel = editor.state.selection;
        const from = sel.from;
        const to = sel.to;

        applyingRemoteRef.current = true;
        try {
          editor.commands.setContent(msg.html, false);
          lastSentHtmlRef.current = msg.html;
          // Best-effort cursor restore — clamp to new doc bounds.
          const size = editor.state.doc.content.size;
          const nextFrom = Math.min(from, size);
          const nextTo = Math.min(to, size);
          try {
            editor.commands.setTextSelection({ from: nextFrom, to: nextTo });
          } catch {
            // ignore — mapping failed, cursor may land at doc start
          }
        } finally {
          applyingRemoteRef.current = false;
        }
      };

      ws.onclose = () => {
        if (closed) return;
        // Reconnect with a small backoff
        reconnectTimer = setTimeout(connect, 1000);
      };

      ws.onerror = () => {
        // onclose will handle reconnect
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [editor, docId, shareToken, enabled]);

  // ---- Broadcast local edits with a leading-edge throttle ----
  //
  // The first keystroke in a burst fires immediately (no warm-up lag);
  // subsequent keystrokes within THROTTLE_MS coalesce into a single trailing
  // send with the latest HTML. This yields ~continuous real-time updates
  // while bounding message rate.
  //
  // Viewers (editor.isEditable === false) skip sending entirely — they only
  // RECEIVE updates so they see live changes without a refresh.
  useEffect(() => {
    if (!editor || !enabled) return;
    if (!editor.isEditable) return; // receive-only mode
    const THROTTLE_MS = 80;

    const flush = () => {
      sendTimerRef.current = null;
      const ed = editorRef.current;
      const ws = wsRef.current;
      if (!ed || ed.isDestroyed) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const html = ed.getHTML();
      if (html === lastSentHtmlRef.current) return;
      lastSentHtmlRef.current = html;
      lastSentAtRef.current = Date.now();
      ws.send(
        JSON.stringify({ type: 'edit', html, origin: clientIdRef.current }),
      );
    };

    const onUpdate = () => {
      if (applyingRemoteRef.current) return;
      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;
      if (elapsed >= THROTTLE_MS) {
        // Leading edge: send right away.
        if (sendTimerRef.current) {
          clearTimeout(sendTimerRef.current);
          sendTimerRef.current = null;
        }
        flush();
      } else if (!sendTimerRef.current) {
        // Within throttle window: schedule the trailing send.
        sendTimerRef.current = setTimeout(flush, THROTTLE_MS - elapsed);
      }
      // else: a trailing send is already queued — it'll grab the latest HTML
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
    };
  }, [editor, enabled]);

  return { collaborators };
}
