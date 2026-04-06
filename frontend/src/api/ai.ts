import { AIRequest, AIInteraction } from '../types';

export const aiApi = {
  async stream(docId: string, request: AIRequest): Promise<ReadableStream<Uint8Array>> {
    const token = localStorage.getItem('access_token');

    const response = await fetch(`/api/ai/${docId}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`AI stream request failed: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from AI stream');
    }

    return response.body;
  },

  async recordOutcome(
    docId: string,
    interactionId: string,
    accepted: boolean,
    applied_text?: string
  ): Promise<void> {
    const token = localStorage.getItem('access_token');

    await fetch(`/api/ai/${docId}/interactions/${interactionId}/outcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ accepted, applied_text }),
    });
  },

  async getHistory(docId: string): Promise<AIInteraction[]> {
    const token = localStorage.getItem('access_token');

    const response = await fetch(`/api/ai/${docId}/history`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch AI history');
    }

    return response.json();
  },
};

/**
 * Helper: parse SSE stream into async iterable of chunks
 */
export interface SSEChunk {
  chunk?: string;
  done: boolean;
  interaction_id?: string;
  error?: string;
}

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<SSEChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const data = JSON.parse(raw) as SSEChunk;
            yield data;
            if (data.done) return;
          } catch {
            // ignore malformed JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
