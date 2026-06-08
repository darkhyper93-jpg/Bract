import { PaginationMeta } from '../schemas/pagination.schema';

export enum NotificationType {
  SYSTEM = 'SYSTEM',
  ALERT = 'ALERT',
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
}

export enum FileStatus {
  PENDING = 'PENDING',
  UPLOADED = 'UPLOADED',
  DELETED = 'DELETED',
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface AppErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}
