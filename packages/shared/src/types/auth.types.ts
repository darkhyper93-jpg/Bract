import { Role } from './user.types';

export interface JWTPayload {
  sub: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}
