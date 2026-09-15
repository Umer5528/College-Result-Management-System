import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge } from '../ui/Badge.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';

function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function UserMenu() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl pl-1.5 pr-2.5 py-1.5 hover:bg-gray-100 transition-colors"
      >
        <span className="h-8 w-8 rounded-lg bg-brand-gradient text-white text-xs font-bold flex items-center justify-center">
          {initials(user.name)}
        </span>
        <span className="hidden sm:block text-left">
          <span className="block text-sm font-semibold text-gray-800 leading-tight">{user.name}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-glow border border-gray-100 py-2 z-50"
          >
            <div className="px-3.5 py-2 border-b border-gray-100 mb-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
              <Badge tone={isSuperAdmin ? 'info' : 'neutral'} className="mt-1.5">
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </Badge>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setPasswordModalOpen(true);
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <KeyRound className="h-4 w-4" />
              Change Password
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-danger-600 hover:bg-danger-50"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
