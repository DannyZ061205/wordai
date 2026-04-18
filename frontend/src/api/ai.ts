import { AIRequest, AIInteraction } from '../types';

function buildUrl(path: string, shareToken?: string): string {
  if (!shareToken) return path;
  return `${path}?share_token=${encodeURIComponent(shareToken)}`;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const aiApi = {
  async stream(
    docId: string,
    request: AIRequest,
    shareToken?: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(buildUrl(`/api/ai/${docId}/stream`, shareToken), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
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
    applied_text?: string,
    shareToken?: string,
  ): Promise<void> {
    await fetch(
      buildUrl(`/api/ai/${docId}/interactions/${interactionId}/outcome`, shareToken),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(),
        },
        body: JSON.stringify({ accepted, applied_text }),
      },
    );
  },

  async getHistory(docId: string, shareToken?: string): Promise<AIInteraction[]> {
    const response = await fetch(buildUrl(`/api/ai/${docId}/history`, shareToken), {
      headers: { ...authHeader() },
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
  stream: ReadableStream<Uint8Array>,
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
