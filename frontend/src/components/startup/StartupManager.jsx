import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useBackendHealth from '../../hooks/useBackendHealth.js';
import ColdStartScreen from './ColdStartScreen.jsx';

const SUCCESS_HOLD_MS = 650; // briefly show "You're all set!" before revealing the app

/**
 * Sits above the router's route content (but does NOT touch the URL, so
 * whatever route the user landed on — /login, /submit-result/<token>,
 * /admin/dashboard — is exactly what renders once the backend is ready).
 * Children are only mounted once the backend has actually responded.
 */
export default function StartupManager({ children }) {
  const { status, retry } = useBackendHealth();
  const [revealApp, setRevealApp] = useState(false);

  useEffect(() => {
    if (status !== 'ready') return;
    const t = setTimeout(() => setRevealApp(true), SUCCESS_HOLD_MS);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <>
      <AnimatePresence>
        {!revealApp && (
          <motion.div key="cold-start" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <ColdStartScreen status={status} onRetry={retry} />
          </motion.div>
        )}
      </AnimatePresence>
      {revealApp && children}
    </>
  );
}
