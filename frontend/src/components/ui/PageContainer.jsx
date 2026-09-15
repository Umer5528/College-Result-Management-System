import React from 'react';
import { motion } from 'framer-motion';

/** Wraps every screen's content with consistent max-width + padding + a gentle entrance. */
export function PageContainer({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`page-container ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Title + optional description + right-aligned actions, used at the top of every page. */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PageContainer;
