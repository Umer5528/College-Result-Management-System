import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT_MS = 8000; // a single health request should fail fast
const RETRY_INTERVAL_MS = 3000; // how often we try again while sleeping
const SLOW_AFTER_MS = 15000; // switch to "taking longer than usual" copy
const ERROR_AFTER_MS = 45000; // give up and show a real error state

/**
 * Polls GET /health until the backend responds, or gives up after a genuine
 * timeout. This is the single source of truth for "is the backend awake" —
 * nothing here uses a fixed fake delay; every state transition is driven by
 * an actual network response (or the lack of one).
 *
 * status: 'checking' | 'slow' | 'ready' | 'error'
 */
export default function useBackendHealth() {
  const [status, setStatus] = useState('checking');
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const stoppedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const check = useCallback(async () => {
    if (stoppedRef.current) return;

    // Guard against overlapping requests (e.g. a manual retry while a poll
    // is already in flight).
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await axios.get(`${API_URL}/health`, {
        timeout: REQUEST_TIMEOUT_MS,
        signal: controller.signal,
      });
      if (stoppedRef.current) return;
      clearTimer();
      setStatus('ready');
      return;
    } catch (err) {
      if (stoppedRef.current || axios.isCancel(err)) return;

      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed >= ERROR_AFTER_MS) {
        clearTimer();
        setStatus('error');
        return;
      }
      setStatus(elapsed >= SLOW_AFTER_MS ? 'slow' : 'checking');
      timerRef.current = setTimeout(check, RETRY_INTERVAL_MS);
    }
  }, []);

  const retry = useCallback(() => {
    stoppedRef.current = false;
    startedAtRef.current = Date.now();
    setStatus('checking');
    check();
  }, [check]);

  useEffect(() => {
    stoppedRef.current = false;
    startedAtRef.current = Date.now();
    check();
    return () => {
      stoppedRef.current = true;
      clearTimer();
      if (abortRef.current) abortRef.current.abort();
    };
  }, [check]);

  return { status, retry };
}
