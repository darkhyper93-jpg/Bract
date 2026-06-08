import React from 'react';
import type { AnalyticsOverview } from '@bract/shared';
import { StatCard } from '../../dashboard/components/StatCard';

interface AnalyticsStatCardsProps {
  overview: AnalyticsOverview | undefined;
  isLoading: boolean;
  days: number;
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
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function IconUserPlus() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function IconUserX() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" y1="8" x2="23" y2="13" />
      <line x1="23" y1="8" x2="18" y2="13" />
    </svg>
  );
}

function getNewUsersLabel(days: number): string {
  return days <= 7 ? `Nuevos (últimos ${days} días)` : 'Esta semana';
}

function getNewUsersValue(overview: AnalyticsOverview | undefined, days: number): number {
  if (!overview) return 0;
  return overview.newUsersThisWeek;
}

export function AnalyticsStatCards({ overview, isLoading, days }: AnalyticsStatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total usuarios"
        value={overview?.totalUsers ?? 0}
        isLoading={isLoading}
        icon={<IconUsers />}
      />
      <StatCard
        title="Usuarios activos"
        value={overview?.activeUsers ?? 0}
        isLoading={isLoading}
        icon={<IconUserCheck />}
      />
      <StatCard
        title={getNewUsersLabel(days)}
        value={getNewUsersValue(overview, days)}
        isLoading={isLoading}
        icon={<IconUserPlus />}
      />
      <StatCard
        title="Suspendidos"
        value={overview?.suspendedUsers ?? 0}
        isLoading={isLoading}
        icon={<IconUserX />}
      />
    </div>
  );
}
