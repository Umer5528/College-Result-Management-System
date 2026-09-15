import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, GraduationCap } from 'lucide-react';
import { NAV_ITEMS_FLAT } from '../../config/navigation.js';
import UserMenu from './UserMenu.jsx';
import MobileDrawer from './MobileDrawer.jsx';

function usePageTitle() {
  const { pathname } = useLocation();
  const match = NAV_ITEMS_FLAT.find((item) => (item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)));
  return match?.label || 'College Result Management System';
}

export default function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = usePageTitle();

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="lg:hidden h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center shrink-0">
            <GraduationCap className="h-4.5 w-4.5 text-white" />
          </span>
          <h1 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{title}</h1>
        </div>
        <UserMenu />
      </header>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
