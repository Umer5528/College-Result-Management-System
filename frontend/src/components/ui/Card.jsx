import React from 'react';
import { motion } from 'framer-motion';
import CountUp from './CountUp.jsx';

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

const TONE_STYLES = {
  brand: { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  success: { bg: 'bg-success-50', text: 'text-success-600', ring: 'ring-success-100' },
  danger: { bg: 'bg-danger-50', text: 'text-danger-600', ring: 'ring-danger-100' },
  warning: { bg: 'bg-warning-50', text: 'text-warning-600', ring: 'ring-warning-100' },
  insight: { bg: 'bg-insight-50', text: 'text-insight-600', ring: 'ring-insight-100' },
};

/**
 * Dashboard stat card with an animated count-up value and an icon chip.
 * `tone` drives the icon color per the app's consistent color language.
 */
export function StatCard({ label, value, icon: Icon, tone = 'brand', suffix = '', delay = 0 }) {
  const t = TONE_STYLES[tone] || TONE_STYLES.brand;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="card card-hover"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">
            <CountUp value={typeof value === 'number' ? value : 0} suffix={suffix} />
            {typeof value !== 'number' && value}
          </p>
        </div>
        {Icon && (
          <span className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${t.bg} ${t.text} ring-4 ${t.ring}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default Card;
