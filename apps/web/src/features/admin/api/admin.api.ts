import apiClient from '../../../lib/axios';
import type { AuditLogItem, AdminStats } from '@bract/shared';
import type { AuditLogQuery } from '@bract/shared';

interface AuditLogListResponse {
  success: true;
  data: AuditLogItem[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

interface AdminStatsResponse {
  success: true;
  data: AdminStats;
}

export const adminApi = {
  getAuditLogs(params: Partial<AuditLogQuery>): Promise<AuditLogListResponse> {
    return apiClient.get('/admin/audit-logs', { params }).then((r) => r.data);
  },
  getStats(): Promise<AdminStatsResponse> {
    return apiClient.get('/admin/stats').then((r) => r.data);
  },
};
