import { ERROR_CODES, ErrorCode } from '../config/constants.js';

const STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  AI_UNAVAILABLE: 503, // IA no disponible (Agente B) — README §5.3
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown[];

  constructor(code: ErrorCode, message: string, details?: unknown[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, AppError);
  }
}

// Re-export so consumers can check codes without importing constants directly
export { ERROR_CODES };
