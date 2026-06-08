export interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  suspendedUsers: number;
  // Fase 6 — evitan un 4to endpoint al consolidar desgloses en overview
  byRole: {
    USER: number;
    ADMIN: number;
    SUPER_ADMIN: number;
  };
  byStatus: {
    ACTIVE: number;
    SUSPENDED: number;
    DELETED: number;
  };
}

export interface UserGrowthPoint {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface ActivityPoint {
  date: string; // 'YYYY-MM-DD'
  logins: number;
  registrations: number;
}
