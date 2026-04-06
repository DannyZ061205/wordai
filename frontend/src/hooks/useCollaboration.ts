import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Editor } from '@tiptap/core';
import { Collaborator } from '../types';
import { useAuthStore } from '../store/auth';

const COLLAB_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#6d6875', '#b5838d', '#52b788', '#4cc9f0', '#7209b7',
];

function getColorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

interface UseCollaborationResult {
  provider: WebsocketProvider | null;
  ydoc: Y.Doc | null;
  collaborators: Collaborator[];
}

export function useCollaboration(
  docId: string | null,
  editor: Editor | null
): UseCollaborationResult {
  const user = useAuthStore((s) => s.user);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const updateCollaborators = useCallback((provider: WebsocketProvider) => {
    const states = provider.awareness.getStates();
    const collabs: Collaborator[] = [];

    states.forEach((state, clientId) => {
      if (clientId === provider.awareness.clientID) return;
      if (state.user) {
        collabs.push({
          user_id: String(clientId),
          username: state.user.name ?? 'Anonymous',
          color: state.user.color ?? '#999',
        });
      }
    });

    setCollaborators(collabs);
  }, []);

  useEffect(() => {
    if (!docId || !user) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const token = localStorage.getItem('access_token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//localhost:8000`;
    const roomName = `ws/${docId}${token ? `?token=${token}` : ''}`;

    const provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
      connect: true,
    });
    providerRef.current = provider;

    const userColor = getColorForUser(user.id);

    provider.awareness.setLocalStateField('user', {
      name: user.username,
      color: userColor,
      userId: user.id,
    });

    const handleAwarenessChange = () => {
      updateCollaborators(provider);
    };

    provider.awareness.on('change', handleAwarenessChange);

    return () => {
      provider.awareness.off('change', handleAwarenessChange);
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      setCollaborators([]);
    };
  }, [docId, user, updateCollaborators]);

  // Suppress editor dependency warning — editor is used in consumers
  void editor;

  return {
    provider: providerRef.current,
    ydoc: ydocRef.current,
    collaborators,
  };
}
