import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  success: 'btn-success',
  ghost: 'btn-ghost',
};

/**
 * Standard button used across the whole app. Handles loading state,
 * left/right icons, and size variants consistently so no screen re-invents
 * its own button styling.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  className = '',
  type = 'button',
  ...props
}) {
  const cls = [VARIANT_CLASS[variant] || VARIANT_CLASS.primary, size === 'sm' ? 'btn-sm' : '', className].join(' ');

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.97 }}
      className={cls}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className="h-4 w-4 shrink-0" />
      )}
      {children}
      {!loading && IconRight && <IconRight className="h-4 w-4 shrink-0" />}
    </motion.button>
  );
}
