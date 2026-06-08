export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    deleted: number;
    newToday: number;
    newThisWeek: number;
  };
  auditLogs: {
    totalToday: number;
    loginsToday: number;
    registrationsToday: number;
    actionsThisWeek: number;
  };
}
