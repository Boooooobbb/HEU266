import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { cn } from '@/utils';

interface LayoutProps {
  className?: string;
  hideNav?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ className, hideNav = false }) => {
  return (
    <div className={cn('min-h-screen bg-surface overflow-x-clip', className)}>
      <Header />
      <main className="relative z-10">
        <Outlet />
      </main>
      {!hideNav && <MobileNav />}
    </div>
  );
};

export default Layout;