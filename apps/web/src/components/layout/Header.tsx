import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar } from '../ui/Avatar';
import { Dropdown, DropdownMenuItem } from '../ui/Dropdown';
import { NotificationBell } from '../../features/notifications';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HeaderProps {
  title?: string;
  breadcrumb?: BreadcrumbItem[];
  className?: string;
}

export function Header({ title, breadcrumb, className }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const isSpanish = i18n.language.startsWith('es');
  const { toggleSidebar } = useUIStore();

  const userMenuItems: DropdownMenuItem[] = [
    {
      key: 'profile',
      label: t('nav.profile'),
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    { key: 'sep', separator: true },
    {
      key: 'logout',
      label: t('auth.logout'),
      danger: true,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      onClick: logout,
    },
  ];

  const hasBreadcrumb = breadcrumb && breadcrumb.length > 0;

  function toggleLanguage() {
    void i18n.changeLanguage(isSpanish ? 'en' : 'es');
  }

  return (
    <header
      className={cn(
        'sticky top-0 flex h-16 shrink-0 items-center justify-between border-b border-border-default px-6',
        'bg-bg-base/80 backdrop-blur-md',
        className,
      )}
    >
      {/* Left: hamburger + title / breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="shrink-0 rounded-md p-1.5 text-text-tertiary transition-colors duration-[150ms] hover:bg-bg-elevated hover:text-text-primary"
          aria-label={t('a11y.toggleSidebar')}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {hasBreadcrumb ? (
          <nav aria-label={t('a11y.breadcrumb')} className="flex items-center gap-1.5 text-sm">
            {breadcrumb!.map((crumb, i) => {
              const isLast = i === breadcrumb!.length - 1;
              return (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <svg className="h-3.5 w-3.5 shrink-0 text-text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                  {isLast || !crumb.href ? (
                    <span className={cn(isLast ? 'font-medium text-text-primary' : 'text-text-secondary')}>
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.href}
                      className="text-text-secondary transition-colors duration-[150ms] hover:text-text-primary"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : title ? (
          <h1 className="text-sm font-semibold text-text-primary truncate">{title}</h1>
        ) : null}
      </div>

      {/* Right: language toggle + notifications + user menu */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleLanguage}
          className="text-xs text-text-secondary hover:text-text-primary border border-border-default rounded-md px-2 py-1 transition-colors duration-150"
          title={t('common.switchLanguage')}
          aria-label={t('common.switchLanguage')}
        >
          {isSpanish ? 'ES' : 'EN'}
        </button>

        <NotificationBell />

        {/* User avatar dropdown */}
        <Dropdown
          trigger={
            <button
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
              aria-label={t('a11y.userMenu')}
            >
              <Avatar src={user?.avatarUrl ?? null} name={user?.name ?? null} size="sm" />
            </button>
          }
          items={userMenuItems}
          align="right"
        />
      </div>
    </header>
  );
}
