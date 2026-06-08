import { Role } from '@bract/shared';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
