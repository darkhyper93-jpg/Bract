import { z } from 'zod';

export const fileUploadRequestSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  size: z.number().int().positive().max(10_000_000),
});

export type FileUploadRequestInput = z.infer<typeof fileUploadRequestSchema>;
