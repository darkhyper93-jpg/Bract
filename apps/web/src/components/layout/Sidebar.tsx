import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { Role } from '@bract/shared';

function IconLayoutDashboard() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconMessageCircle() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconQuiz() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconBarChart2() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

interface NavItemDef {
  to: string;
  labelKey: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  badge?: number;
  separatorBefore?: boolean;
}

const NAV_ITEMS: NavItemDef[] = [
  { to: '/dashboard', labelKey: 'dashboard', icon: <IconLayoutDashboard /> },
  { to: '/planner', labelKey: 'planner', icon: <IconCalendar /> },
  { to: '/syllabus', labelKey: 'syllabus', icon: <IconBook /> },
  { to: '/flashcards', labelKey: 'flashcards', icon: <IconLayers /> },
  { to: '/chat', labelKey: 'chat', icon: <IconMessageCircle /> },
  { to: '/import', labelKey: 'import', icon: <IconImport /> },
  { to: '/quiz', labelKey: 'quiz', icon: <IconQuiz /> },
  { to: '/users', labelKey: 'users', icon: <IconUsers />, adminOnly: true },
  { to: '/analytics', labelKey: 'analytics', icon: <IconBarChart2 />, adminOnly: true },
  { to: '/notifications', labelKey: 'notifications', icon: <IconBell />, badge: 0 },
  { to: '/admin', labelKey: 'admin', icon: <IconShield />, adminOnly: true, separatorBefore: true },
];

interface UserMenuPortalProps {
  coords: { bottom: number; left: number; width: number };
  onClose: () => void;
  onProfile: () => void;
  onLogout: () => void;
}

function UserMenuPortal({ coords, onClose, onProfile, onLogout }: UserMenuPortalProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      role="menu"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        bottom: coords.bottom,
        left: coords.left,
        minWidth: Math.max(coords.width, 160),
        zIndex: 500,
      }}
      className="rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-xl shadow-black/30"
    >
      <button
        role="menuitem"
        onClick={onProfile}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-secondary hover:text-text-primary hover:bg-bg-overlay transition-colors duration-[150ms]"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
        {t('nav.profile')}
      </button>
      <div className="my-1 border-t border-border-subtle" role="separator" />
      <button
        role="menuitem"
        onClick={onLogout}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-error hover:bg-error/10 transition-colors duration-[150ms]"
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {t('auth.logout')}
      </button>
    </motion.div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ bottom: 0, left: 0, width: 0 });
  const userSectionRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const showLabel = sidebarOpen || isMobile;

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const openUserMenu = useCallback(() => {
    const el = userSectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuCoords({
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
      width: rect.width,
    });
    setUserMenuOpen(true);
  }, []);

  const handleProfile = useCallback(() => {
    navigate('/profile');
    setUserMenuOpen(false);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    logout();
    setUserMenuOpen(false);
  }, [logout]);

  const inner = (
    <div className="flex h-full flex-col overflow-hidden border-r border-border-subtle bg-bg-surface">
      {/* Logo + collapse toggle */}
      <div className="flex h-16 shrink-0 items-center border-b border-border-subtle px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-sm font-bold text-white">
            B
          </div>
          {showLabel && (
            <span className="whitespace-nowrap text-sm font-semibold text-text-primary">Bract</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="ml-auto shrink-0 rounded-md p-1 text-text-tertiary transition-colors duration-[150ms] hover:bg-bg-elevated hover:text-text-primary"
          aria-label={sidebarOpen ? t('a11y.collapseSidebar') : t('a11y.expandSidebar')}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {showLabel ? (
              <><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></>
            ) : (
              <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>
            )}
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label={t('a11y.mainNav')}>
        {visibleItems.map((item) => {
          const label = t(`nav.${item.labelKey}`);
          const isActive =
            location.pathname === item.to ||
            (item.to !== '/dashboard' && location.pathname.startsWith(item.to + '/'));
          const showBadge = typeof item.badge === 'number' && item.badge > 0;

          const link = (
            <NavLink
              to={item.to}
              className={cn(
                'flex h-9 items-center gap-3 rounded-lg border-l-2 text-sm',
                'transition-colors duration-[150ms]',
                showLabel ? 'pl-2 pr-2.5' : 'justify-center px-2',
                isActive
                  ? 'border-brand-primary bg-brand-muted text-brand-primary'
                  : 'border-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="relative shrink-0">
                {item.icon}
                {!showLabel && showBadge && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-primary" aria-hidden="true" />
                )}
              </span>
              {showLabel && (
                <>
                  <span className="flex-1 whitespace-nowrap">{label}</span>
                  {showBadge && (
                    <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-primary/20 px-1.5 text-[10px] font-bold text-brand-primary">
                      {item.badge! > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );

          return (
            <React.Fragment key={item.to}>
              {item.separatorBefore && (
                <div className="mx-1 my-1 border-t border-border-subtle" />
              )}
              {!showLabel ? (
                <Tooltip content={label} placement="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* User section */}
      <div className="shrink-0 border-t border-border-subtle p-2" ref={userSectionRef}>
        <button
          onClick={openUserMenu}
          aria-label={t('a11y.userMenu')}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg p-2 text-left',
            'transition-colors duration-[150ms] hover:bg-bg-elevated',
            !showLabel && 'justify-center',
          )}
        >
          <Avatar src={user?.avatarUrl ?? null} name={user?.name ?? null} size="sm" />
          {showLabel && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text-primary">{user?.name}</p>
              <p className="truncate text-xs text-text-tertiary">{user?.email}</p>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50"
                style={{ zIndex: 290 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                key="drawer"
                initial={{ x: -240 }}
                animate={{ x: 0 }}
                exit={{ x: -240 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="fixed left-0 top-0 h-full shadow-2xl shadow-black/50"
                style={{ zIndex: 300, width: 240 }}
              >
                {inner}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      ) : (
        <motion.aside
          initial={false}
          animate={{ width: sidebarOpen ? 240 : 64 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="relative h-full shrink-0"
          style={{ zIndex: 300 }}
        >
          {inner}
        </motion.aside>
      )}

      {createPortal(
        <AnimatePresence>
          {userMenuOpen && (
            <UserMenuPortal
              coords={menuCoords}
              onClose={() => setUserMenuOpen(false)}
              onProfile={handleProfile}
              onLogout={handleLogout}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
