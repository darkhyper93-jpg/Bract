import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page:    z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
  unread:  z.enum(['true', 'false']).optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
