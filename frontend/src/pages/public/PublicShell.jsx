import React from 'react';
import { GraduationCap } from 'lucide-react';

/**
 * Deliberately NOT using AppLayout (no sidebar/admin nav) — the teacher has
 * no account and should see nothing but the submission flow itself.
 */
export default function PublicShell({ collegeName, children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 flex items-center px-4 sm:px-6 bg-white border-b border-gray-100 shrink-0">
        <span className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center mr-2.5">
          <GraduationCap className="h-4.5 w-4.5 text-white" />
        </span>
        <span className="font-semibold text-gray-900 text-sm truncate">{collegeName || 'College Result Management System'}</span>
      </header>
      <main className="flex-1 px-4 py-5 sm:px-6 sm:py-8">
        <div className="max-w-lg mx-auto">{children}</div>
      </main>
    </div>
  );
}
