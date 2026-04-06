import { useState, useCallback, useRef } from 'react';
import { aiApi, parseSSEStream } from '../api/ai';
import { AIRequest } from '../types';

interface UseAIResult {
  loading: boolean;
  result: string;
  interactionId: string | null;
  error: string | null;
  streamAI: (request: AIRequest) => Promise<void>;
  accept: (appliedText?: string) => Promise<void>;
  reject: () => Promise<void>;
  clear: () => void;
}

export function useAI(docId: string): UseAIResult {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const streamAI = useCallback(
    async (request: AIRequest) => {
      // Cancel any in-progress stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      setLoading(true);
      setResult('');
      setInteractionId(null);
      setError(null);

      try {
        const stream = await aiApi.stream(docId, request);
        const generator = parseSSEStream(stream);

        for await (const chunk of generator) {
          if (chunk.error) {
            setError(chunk.error);
            break;
          }
          if (chunk.done) {
            if (chunk.interaction_id) {
              setInteractionId(chunk.interaction_id);
            }
            break;
          }
          if (chunk.chunk) {
            setResult((prev) => prev + chunk.chunk);
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [docId]
  );

  const accept = useCallback(
    async (appliedText?: string) => {
      if (!interactionId) return;
      try {
        await aiApi.recordOutcome(docId, interactionId, true, appliedText);
      } catch {
        // non-critical — don't surface to user
      }
    },
    [docId, interactionId]
  );

  const reject = useCallback(async () => {
    if (!interactionId) return;
    try {
      await aiApi.recordOutcome(docId, interactionId, false);
    } catch {
      // non-critical
    }
    clear();
  }, [docId, interactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
    setResult('');
    setInteractionId(null);
    setError(null);
  }, []);

  return { loading, result, interactionId, error, streamAI, accept, reject, clear };
}
