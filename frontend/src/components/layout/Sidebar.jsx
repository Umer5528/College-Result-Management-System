import React from 'react';
import { NavLink } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { NAV_SECTIONS } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge } from '../ui/Badge.jsx';

function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar() {
  const { user, isSuperAdmin } = useAuth();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-gray-100 bg-white">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100 shrink-0">
        <span className="h-9 w-9 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-white" />
        </span>
        <span className="font-bold text-gray-900 text-sm truncate">College Result System</span>
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
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:translate-x-0.5'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-brand-500" />
                        )}
                        <item.icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-brand-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile footer */}
      {user && (
        <div className="border-t border-gray-100 px-4 py-3.5 flex items-center gap-2.5 shrink-0">
          <span className="h-9 w-9 rounded-lg bg-brand-gradient text-white text-xs font-bold flex items-center justify-center shrink-0">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{user.name}</p>
            <Badge tone={isSuperAdmin ? 'info' : 'neutral'} className="mt-0.5">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </Badge>
          </div>
        </div>
      )}
    </aside>
  );
}
