import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TONE = {
  success: { icon: CheckCircle2, class: 'bg-success-500' },
  error: { icon: XCircle, class: 'bg-danger-500' },
  info: { icon: Info, class: 'bg-brand-500' },
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, tone = 'info', duration = 4000) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg, duration) => push(msg, 'success', duration),
    error: (msg, duration) => push(msg, 'error', duration),
    info: (msg, duration) => push(msg, 'info', duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed z-[100] top-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const meta = TONE[t.tone] || TONE.info;
            const Icon = meta.icon;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
                className="pointer-events-auto flex items-start gap-3 bg-white rounded-xl shadow-glow border border-gray-100 px-4 py-3 w-full sm:w-96"
              >
                <span className={`shrink-0 h-8 w-8 rounded-lg ${meta.class} text-white flex items-center justify-center`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <p className="text-sm text-gray-700 font-medium pt-1 grow">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-gray-300 hover:text-gray-500 p-1 shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
