import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/utils';
import { useAuthStore } from '@/store';
import { hasSubmittedQuestionnaire } from '@/services/questionnaireService';
import { getUnreadNotificationCount } from '@/services/notificationService';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (!isAuthenticated) {
        if (!cancelled) {
          setUnreadCount(0);
        }
        return;
      }

      const count = await getUnreadNotificationCount();
      if (!cancelled) {
        setUnreadCount(count);
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30000);

    const handleUnreadUpdate = () => {
      void refresh();
    };

    window.addEventListener('notification-updated', handleUnreadUpdate);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('notification-updated', handleUnreadUpdate);
    };
  }, [isAuthenticated]);

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/questionnaire', label: '问卷' },
    { path: '/waiting', label: '我的匹配' },
  ];

  const isActive = (path: string) => {
    if (location.pathname === '/questionnaire-required') {
      if (path === '/waiting') return true;
      if (path === '/questionnaire') return false;
    }

    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getTargetPath = (path: string) => {
    const protectedPaths = new Set(['/questionnaire', '/waiting', '/chat', '/chat-entry', '/profile']);
    if (!isAuthenticated && protectedPaths.has(path)) {
      return '/login';
    }

    if (path === '/waiting' && isAuthenticated && !hasSubmittedQuestionnaire()) {
      return '/questionnaire-required';
    }

    return path;
  };

  return (
    <nav
      className={cn(
        'sticky top-4 mx-auto w-[92%] max-w-7xl rounded-2xl',
        'bg-white/70 dark:bg-stone-900/60 backdrop-blur-3xl',
        'outline outline-1 outline-orange-200/20 dark:outline-stone-700/20',
        'shadow-[0_4px_24px_rgba(28,28,24,0.04)]',
        'flex justify-between items-center px-5 md:px-8 py-3.5 z-50',
        className
      )}
    >
      {/* Logo */}
      <div className="text-xl md:text-2xl font-black text-orange-700 dark:text-orange-500 tracking-tighter">
        <Link to="/" className="flex items-center gap-1">
          🍊意配
        </Link>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex gap-8 items-center font-manrope font-medium text-sm tracking-tight text-stone-600 dark:text-stone-400">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={getTargetPath(item.path)}
            className={cn(
              'hover:text-orange-600 transition-colors',
              isActive(item.path) && 'text-orange-700 dark:text-orange-400 font-bold border-b-2 border-orange-500 pb-1'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Right Icons */}
      <div className="flex items-center gap-2 md:gap-4 text-orange-600 dark:text-orange-400">
        <Link
          to={getTargetPath('/chat-entry')}
          className="relative p-2 hover:bg-orange-50/50 dark:hover:bg-stone-800/50 rounded-lg transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-2xl">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <Link
          to={getTargetPath('/profile')}
          className="p-2 hover:bg-orange-50/50 dark:hover:bg-stone-800/50 rounded-lg transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-2xl">account_circle</span>
        </Link>
      </div>
    </nav>
  );
};

export default Header;