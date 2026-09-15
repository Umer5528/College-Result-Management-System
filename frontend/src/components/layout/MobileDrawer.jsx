import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { GraduationCap, X } from 'lucide-react';
import { NAV_SECTIONS } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function MobileDrawer({ open, onClose }) {
  const { isSuperAdmin } = useAuth();

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            className="absolute inset-0 bg-gray-900/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-white shadow-2xl flex flex-col"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-brand-gradient flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-white" />
                </span>
                <span className="font-bold text-gray-900 text-sm">College Result System</span>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
              {NAV_SECTIONS.map((section, idx) => {
                const items = section.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
                if (items.length === 0) return null;
                return (
                  <div key={idx}>
                    {section.section && (
                      <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        {section.section}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {items.map((item) => (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end={item.path === '/'}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium min-h-[44px] transition-colors ${
                              isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
                            }`
                          }
                        >
                          <item.icon className="h-4.5 w-4.5 shrink-0" />
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
