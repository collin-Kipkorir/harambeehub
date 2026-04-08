import { useEffect, useRef } from 'react';

type Options = {
  initialDelayMs?: number;
  maxAttempts?: number;
  backoffFactor?: number;
  onSuccess?: () => void;
  onFailure?: () => void;
};

export function useStatusPolling(donationId: string | null, active: boolean, options: Options = {}) {
  const { initialDelayMs = 3000, maxAttempts = 6, backoffFactor = 1.5, onSuccess, onFailure } = options;
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active || !donationId) return;
    attemptRef.current = 0;

    const poll = async () => {
      attemptRef.current += 1;
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/payhero/status?donationId=${encodeURIComponent(donationId)}`, {
          signal: abortRef.current.signal,
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.donationStatus === 'completed') {
          onSuccess?.();
          return; // stop polling
        }
        if (res.ok && json?.donationStatus === 'failed') {
          onFailure?.();
          return; // stop polling
        }
      } catch (err) {
        // network error or abort; we'll backoff and retry until maxAttempts
      }

      if (attemptRef.current >= maxAttempts) {
        onFailure?.();
        return;
      }

      const nextDelay = Math.round(initialDelayMs * Math.pow(backoffFactor, attemptRef.current - 1));
      timerRef.current = window.setTimeout(poll, nextDelay);
    };

    timerRef.current = window.setTimeout(poll, initialDelayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [donationId, active, initialDelayMs, maxAttempts, backoffFactor, onSuccess, onFailure]);
}
