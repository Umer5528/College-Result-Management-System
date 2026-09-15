import React from 'react';
import { motion } from 'framer-motion';
import { Inbox, AlertCircle } from 'lucide-react';
import Button from './Button.jsx';

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-16 px-4"
    >
      <div className="h-16 w-16 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({ title = 'Something went wrong', description = 'Please try again.', onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-16 px-4"
    >
      <div className="h-16 w-16 rounded-2xl bg-danger-50 text-danger-500 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
      <p className="text-sm text-gray-500 mt-1.5 max-w-sm">{description}</p>
      {onRetry && (
        <div className="mt-5">
          <Button variant="secondary" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </motion.div>
  );
}
