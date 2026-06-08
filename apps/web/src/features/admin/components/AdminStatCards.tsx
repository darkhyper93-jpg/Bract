import React from 'react';
import { StatCard } from '../../dashboard/components/StatCard';
import type { AdminStats } from '@bract/shared';

interface AdminStatCardsProps {
  stats:     AdminStats | undefined;
  isLoading: boolean;
}

function IconUsers() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconUserCheck() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconLogIn() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function AdminStatCards({ stats, isLoading }: AdminStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total usuarios"
        value={stats?.users.total ?? 0}
        icon={<IconUsers />}
        isLoading={isLoading}
      />
      <StatCard
        title="Usuarios activos"
        value={stats?.users.active ?? 0}
        icon={<IconUserCheck />}
        isLoading={isLoading}
      />
      <StatCard
        title="Logins hoy"
        value={stats?.auditLogs.loginsToday ?? 0}
        icon={<IconLogIn />}
        isLoading={isLoading}
      />
      <StatCard
        title="Acciones esta semana"
        value={stats?.auditLogs.actionsThisWeek ?? 0}
        icon={<IconActivity />}
        isLoading={isLoading}
      />
    </div>
  );
}
