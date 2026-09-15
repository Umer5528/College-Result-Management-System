import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, CheckCircle2, WifiOff, RefreshCw } from 'lucide-react';
import Button from '../ui/Button.jsx';

const CHECKING_MESSAGES = [
  'Connecting to the result system...',
  'Getting things ready...',
  'Waking up the system...',
  'Preparing your workspace...',
];

/**
 * Rotates through friendly status lines slowly (one every ~3.5s) so it reads
 * as progress rather than a glitchy flicker.
 */
function useRotatingMessage(active, messages, intervalMs = 3500) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return messages[index];
}

export default function ColdStartScreen({ status, onRetry }) {
  const rotatingMessage = useRotatingMessage(status === 'checking', CHECKING_MESSAGES);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-gradient overflow-hidden">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 bg-aurora" />
      <motion.div
        className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-[90%] max-w-sm sm:max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-2xl px-6 py-8 sm:px-8 sm:py-10 text-center"
      >
        {/* Animated logo */}
        <motion.div
          className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-glow"
          animate={status === 'ready' ? { scale: [1, 1.15, 1] } : { rotate: [0, -6, 6, 0] }}
          transition={
            status === 'ready'
              ? { duration: 0.5 }
              : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <GraduationCap className="h-8 w-8 text-white" />
        </motion.div>

        <h1 className="text-lg font-bold text-gray-900">College Result Management System</h1>

        <AnimatePresence mode="wait">
          {status === 'error' ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-danger-50 text-danger-500 flex items-center justify-center">
                <WifiOff className="h-6 w-6" />
              </div>
              <p className="font-semibold text-gray-900">Unable to connect</p>
              <p className="text-sm text-gray-500 mt-1">We couldn't reach the result system right now.</p>
              <div className="flex items-center justify-center gap-2 mt-5">
                <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
                  Try Again
                </Button>
                <Button onClick={() => window.location.reload()}>Reload Page</Button>
              </div>
            </motion.div>
          ) : status === 'ready' ? (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
              <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-success-50 text-success-500 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="font-semibold text-gray-900">You're all set!</p>
            </motion.div>
          ) : (
            <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
              <p className="text-sm text-gray-500">Please wait a few seconds while we connect to the system.</p>

              {/* Animated progress indicator */}
              <div className="mt-5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-brand-gradient"
                  animate={{ x: ['-100%', '250%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={status === 'slow' ? 'slow' : rotatingMessage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 text-xs font-medium text-gray-400"
                >
                  {status === 'slow'
                    ? "The server is taking a little longer than usual. We're still trying to connect — please keep this page open."
                    : rotatingMessage}
                </motion.p>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
