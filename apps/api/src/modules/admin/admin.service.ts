import { adminRepository } from './admin.repository.js';
import type { AuditLogListResponse, AdminStats, AuditLogQuery } from '@bract/shared';

export const adminService = {
  async getAuditLogs(query: AuditLogQuery): Promise<AuditLogListResponse> {
    return adminRepository.findAuditLogs(query);
  },

  async getStats(): Promise<AdminStats> {
    return adminRepository.getStats();
  },
};
