import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { User as PrismaUser } from '@prisma/client';
import { authRepository } from './auth.repository.js';
import { AppError } from '../../lib/errors.js';
import { redis } from '../../lib/redis.js';
import { env } from '../../config/env.js';
import { TOKEN_TTL } from '../../config/constants.js';
import { emailService } from '../../lib/email.js';
import { enqueueCreateNotification } from '../../jobs/notification.producer.js';
import { logger } from '../../lib/logger.js';
import type { User, JWTPayload } from '@bract/shared';
import { Role, UserStatus, NotificationType } from '@bract/shared';

const BCRYPT_SALT_ROUNDS = 12;
const BLACKLIST_PREFIX = 'blacklist:';
const SESSION_PREFIX = 'session:';

export interface AuthResponse {
  accessToken: string;
  rawRefreshToken: string;
  user: User;
}

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LogoutDto {
  userId: string;
  rawRefreshToken: string;
  rawAccessToken: string;
}

export interface RefreshDto {
  rawRefreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  password: string;
}

export interface VerifyEmailDto {
  token: string;
}

function toPublicUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role as Role,
    status: user.status as UserStatus,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function signAccessToken(payload: { sub: string; email: string; role: Role }): string {
  const privateKey = env.JWT_PRIVATE_KEY.replace(/\\n/g, '\n');
  return jwt.sign(
    { sub: payload.sub, email: payload.email, role: payload.role },
    privateKey,
    { algorithm: 'RS256' as const, expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  );
}

function generateRawToken(bytes = 64): string {
  return crypto.randomBytes(bytes).toString('hex');
}

async function buildTokenPair(
  user: PrismaUser,
  ipAddress?: string,
  userAgent?: string,
): Promise<AuthResponse> {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role as Role,
  });

  const rawRefreshToken = generateRawToken(64);
  const expiresAt = new Date(Date.now() + TOKEN_TTL.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await authRepository.createRefreshToken({
    userId: user.id,
    rawToken: rawRefreshToken,
    expiresAt,
    // Spread only defined values to satisfy exactOptionalPropertyTypes
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(userAgent !== undefined ? { userAgent } : {}),
  });

  await redis.set(`${SESSION_PREFIX}${user.id}`, '1', { ex: TOKEN_TTL.REDIS_SESSION_SECONDS });

  return {
    accessToken,
    rawRefreshToken,
    user: toPublicUser(user),
  };
}

export const authService = {
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await authRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('CONFLICT', 'Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await authRepository.createUser({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    const rawVerificationToken = generateRawToken(32);
    const verificationExpiry = new Date(Date.now() + TOKEN_TTL.RESET_PASSWORD_SECONDS * 1000);
    await authRepository.createVerificationToken(user.id, rawVerificationToken, verificationExpiry);

    // Fire-and-forget — email queued via BullMQ inside emailService
    void emailService.sendVerification(user.email, rawVerificationToken);

    try {
      await enqueueCreateNotification({
        userId: user.id,
        type: NotificationType.INFO,
        title: '¡Bienvenido a Bract!',
        body: 'Tu cuenta ha sido creada correctamente.',
      });
    } catch (err) {
      logger.error('Failed to enqueue welcome notification', { userId: user.id, error: (err as Error).message });
    }

    // DECISIÓN: audit REGISTER después del token pair para no bloquear si falla
    try {
      await authRepository.createAuditLog({
        userId: user.id,
        action: 'REGISTER',
        resource: 'auth',
      });
    } catch (err) {
      logger.warn({ message: 'Audit log failed for REGISTER', error: (err as Error).message });
    }

    return buildTokenPair(user);
  },

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await authRepository.findByEmail(dto.email);

    // Run bcrypt even when user not found to prevent timing-based email enumeration
    const dummyHash = '$2b$12$invalidhashforuserthatdoesnotexist.invalidhashval';
    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? dummyHash);

    if (!user || !valid) {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password');
    }

    if (user.status === 'SUSPENDED') {
      throw new AppError('FORBIDDEN', 'Account suspended');
    }
    if (user.status === 'DELETED') {
      throw new AppError('UNAUTHORIZED', 'Invalid email or password');
    }

    const result = await buildTokenPair(user, dto.ipAddress, dto.userAgent);

    // DECISIÓN: audit LOGIN dentro de try/catch — el login ya fue exitoso, no propagar fallo de audit
    try {
      await authRepository.createAuditLog({
        userId: user.id,
        action: 'LOGIN',
        resource: 'auth',
        ...(dto.ipAddress !== undefined ? { ipAddress: dto.ipAddress } : {}),
        ...(dto.userAgent !== undefined ? { userAgent: dto.userAgent } : {}),
      });
    } catch (err) {
      logger.warn({ message: 'Audit log failed for LOGIN', error: (err as Error).message });
    }

    return result;
  },

  async logout(dto: LogoutDto): Promise<void> {
    await authRepository.revokeAllUserRefreshTokens(dto.userId);

    const decoded = jwt.decode(dto.rawAccessToken) as JWTPayload | null;
    if (decoded?.exp !== undefined) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        const tokenHash = crypto.createHash('sha256').update(dto.rawAccessToken).digest('hex');
        await redis.set(`${BLACKLIST_PREFIX}${tokenHash}`, '1', { ex: ttl });
      }
    }

    await redis.del(`${SESSION_PREFIX}${dto.userId}`);
  },

  async refresh(dto: RefreshDto): Promise<AuthResponse> {
    const anyToken = await authRepository.findRefreshTokenAny(dto.rawRefreshToken);

    if (!anyToken) {
      throw new AppError('UNAUTHORIZED', 'Invalid refresh token');
    }

    if (anyToken.revokedAt !== null || anyToken.expiresAt < new Date()) {
      // Reuse attack detected — revoke all sessions for this user
      await authRepository.revokeAllUserRefreshTokens(anyToken.userId);
      throw new AppError('UNAUTHORIZED', 'Refresh token reuse detected — all sessions revoked');
    }

    await authRepository.revokeRefreshToken(anyToken.id);

    const user = await authRepository.findById(anyToken.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('UNAUTHORIZED', 'User not found or inactive');
    }

    return buildTokenPair(
      user,
      dto.ipAddress,
      dto.userAgent,
    );
  },

  async me(userId: string): Promise<User> {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }
    return toPublicUser(user);
  },

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    // Always return success — never reveal whether email exists (README §10.3)
    const user = await authRepository.findByEmail(dto.email);
    if (!user || user.status !== 'ACTIVE') return;

    const rawToken = generateRawToken(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL.RESET_PASSWORD_SECONDS * 1000);
    await authRepository.createPasswordResetToken(user.id, rawToken, expiresAt);

    // Fire-and-forget — email queued via BullMQ inside emailService
    void emailService.sendPasswordReset(user.email, rawToken);
  },

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await authRepository.findPasswordResetToken(dto.token);
    if (!record) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    await authRepository.updatePassword(record.userId, passwordHash);
    await authRepository.markPasswordResetUsed(record.id);
    await authRepository.revokeAllUserRefreshTokens(record.userId);
  },

  async verifyEmail(dto: VerifyEmailDto): Promise<void> {
    const record = await authRepository.findVerificationToken(dto.token);
    if (!record) {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired verification token');
    }
    await authRepository.markEmailVerified(record.userId);
  },
};
