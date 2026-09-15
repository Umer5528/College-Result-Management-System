import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  ClipboardList,
  Award,
  FileSpreadsheet,
  BarChart3,
  Settings,
  ShieldCheck,
  History,
} from 'lucide-react';

/**
 * Single source of truth for navigation: used by the desktop Sidebar, the
 * mobile drawer/bottom nav, and the header's page title lookup.
 *
 * Grouped to match a college's actual workflow — set up the academic
 * structure, then work with results — rather than a generic admin-panel
 * taxonomy. Intentionally lean: every item here is something a college
 * office actually needs to click, not a page that merely exists.
 */
export const NAV_SECTIONS = [
  {
    section: null,
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
  },
  {
    section: 'Academic Management',
    items: [
      { label: 'Classes & Sections', path: '/classes', icon: BookOpen },
      { label: 'Students', path: '/students', icon: Users },
      { label: 'Examinations', path: '/examinations', icon: FileText },
    ],
  },
  {
    section: 'Results',
    items: [
      { label: 'Submission Monitoring', path: '/examinations/monitoring', icon: ClipboardList },
      { label: 'Finalized Results', path: '/results', icon: Award },
      { label: 'Reports', path: '/reports/exam', icon: FileSpreadsheet },
      { label: 'Overall Performance', path: '/reports/overall', icon: BarChart3 },
    ],
  },
  {
    section: 'Administration',
    items: [
      { label: 'College Settings', path: '/settings', icon: Settings },
      { label: 'Admin Management', path: '/admin-management', icon: ShieldCheck, superAdminOnly: true },
      { label: 'Audit Logs', path: '/audit-logs', icon: History, superAdminOnly: true },
    ],
  },
];

/** Flat list, handy for header title lookup and mobile bottom-nav "primary" items. */
export const NAV_ITEMS_FLAT = NAV_SECTIONS.flatMap((s) => s.items);

/** The 4 most-used destinations, shown directly in the mobile bottom nav bar. */
export const MOBILE_PRIMARY_PATHS = ['/', '/students', '/examinations', '/results'];
