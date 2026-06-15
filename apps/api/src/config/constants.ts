// Rate limit config — values match README §5.4
export const RATE_LIMIT = {
  AUTH_LOGIN: { max: 10, windowMs: 15 * 60 * 1000 },
  AUTH_REGISTER: { max: 5, windowMs: 60 * 60 * 1000 },
  AUTH_FORGOT_PASSWORD: { max: 3, windowMs: 60 * 60 * 1000 },
  API_AUTHENTICATED: { max: 500, windowMs: 60 * 1000 },
  API_ANONYMOUS: { max: 60, windowMs: 60 * 1000 },
} as const;

// Token TTLs — values from README §4.2
export const TOKEN_TTL = {
  ACCESS_JWT_SECONDS: 15 * 60,
  REFRESH_TOKEN_DAYS: 7,
  REDIS_SESSION_SECONDS: 7 * 24 * 60 * 60,
  RESET_PASSWORD_SECONDS: 60 * 60,
} as const;

// File upload constraints — README §6.1
export const FILE_LIMITS = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
  SIGNED_URL_EXPIRY_SECONDS: 5 * 60,
  PENDING_EXPIRY_MINUTES: 10,
} as const;

// BullMQ — README §7.2
export const JOB = {
  MAX_DURATION_MS: 30 * 60 * 1000,
  RETRY_ATTEMPTS: 3,
  BACKOFF_DELAY_MS: 1000,
} as const;

// Redis cache TTLs — README §13
export const CACHE_TTL = {
  ANALYTICS_SECONDS: 5 * 60,
} as const;

// Error codes — README §5.3
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Agregado por Agente B (núcleo de IA): IA no disponible (falta AI_API_KEY o falla el proveedor).
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// Mensajes de generación con IA — contrato uniforme (README §5.6). Constante reusable para que
// cualquier ruta que genere contenido a nivel materia devuelva el MISMO VALIDATION_ERROR.
export const GENERATION_ERRORS = {
  SUBJECT_NO_TOPICS: 'La materia no tiene temas para generar contenido',
} as const;
