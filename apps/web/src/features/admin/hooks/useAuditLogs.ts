import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin.api';
import { queryKeys } from '../../../lib/queryKeys';
import type { AuditLogQuery } from '@bract/shared';

export function useAuditLogs(params: Partial<AuditLogQuery>) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(params),
    queryFn:  () => adminApi.getAuditLogs(params),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
}
