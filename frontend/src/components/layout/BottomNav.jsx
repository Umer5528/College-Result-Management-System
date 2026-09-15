import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { NAV_ITEMS_FLAT, MOBILE_PRIMARY_PATHS } from '../../config/navigation.js';
import MobileDrawer from './MobileDrawer.jsx';

export default function BottomNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const primaryItems = MOBILE_PRIMARY_PATHS.map((p) => NAV_ITEMS_FLAT.find((i) => i.path === p)).filter(Boolean);

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="grid grid-cols-5 h-16">
          {primaryItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  isActive ? 'text-brand-600' : 'text-gray-400'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label.split(' ')[0]}
            </NavLink>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-gray-400"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
