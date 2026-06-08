import { z } from 'zod';
import { PaginationMetaSchema } from './pagination.schema';

// DECISIÓN: factories genéricas en lugar de schemas estáticos para soportar data tipada — Zod no soporta generics directamente
export const createSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: PaginationMetaSchema.optional(),
  });

export const ErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
