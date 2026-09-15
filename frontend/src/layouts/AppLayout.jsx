import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar.jsx';
import Header from '../components/layout/Header.jsx';
import BottomNav from '../components/layout/BottomNav.jsx';
import PageTransition from '../components/layout/PageTransition.jsx';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 pb-20 lg:pb-0">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
