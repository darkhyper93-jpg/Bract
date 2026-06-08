import { z } from 'zod';

export const AUDIT_ACTIONS = [
  'LOGIN',
  'REGISTER',
  'USER_ROLE_CHANGED',
  'USER_STATUS_CHANGED',
  'USER_DELETED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  perPage:  z.coerce.number().int().min(1).max(100).default(20),
  userId:   z.string().cuid().optional(),
  action:   z.enum(AUDIT_ACTIONS).optional(),
  resource: z.string().max(50).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo:   z.string().datetime({ offset: true }).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
