import crypto from 'crypto';
import { prisma } from '../../prisma/client.js';
import type { User, RefreshToken, Session, Prisma } from '@prisma/client';
import { SessionType } from '@prisma/client';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

export interface CreateRefreshTokenData {
  userId: string;
  rawToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateAuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonObject;
  ipAddress?: string;
  userAgent?: string;
}

export const authRepository = {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async createUser(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
      },
    });
  },

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: {
        token: hashToken(data.rawToken),
        userId: data.userId,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  },

  // Returns token regardless of revocation status — needed to detect reuse attacks
  async findRefreshTokenAny(rawToken: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: { token: hashToken(rawToken) },
    });
  },

  async findRefreshToken(rawToken: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: {
        token: hashToken(rawToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async revokeRefreshToken(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async createVerificationToken(userId: string, rawToken: string, expiresAt: Date): Promise<void> {
    // Remove any existing verification tokens before creating a new one
    await prisma.session.deleteMany({
      where: { userId, type: SessionType.EMAIL_VERIFICATION },
    });
    await prisma.session.create({
      data: {
        userId,
        token: hashToken(rawToken),
        type: SessionType.EMAIL_VERIFICATION,
        expiresAt,
      },
    });
  },

  async findVerificationToken(rawToken: string): Promise<Session | null> {
    return prisma.session.findFirst({
      where: {
        token: hashToken(rawToken),
        type: SessionType.EMAIL_VERIFICATION,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async markEmailVerified(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    await prisma.session.deleteMany({
      where: { userId, type: SessionType.EMAIL_VERIFICATION },
    });
  },

  async createPasswordResetToken(userId: string, rawToken: string, expiresAt: Date): Promise<void> {
    // Invalidate existing reset tokens for this user
    await prisma.session.deleteMany({
      where: { userId, type: SessionType.PASSWORD_RESET },
    });
    await prisma.session.create({
      data: {
        userId,
        token: hashToken(rawToken),
        type: SessionType.PASSWORD_RESET,
        expiresAt,
      },
    });
  },

  async findPasswordResetToken(rawToken: string): Promise<Session | null> {
    return prisma.session.findFirst({
      where: {
        token: hashToken(rawToken),
        type: SessionType.PASSWORD_RESET,
        expiresAt: { gt: new Date() },
      },
    });
  },

  async markPasswordResetUsed(id: string): Promise<void> {
    await prisma.session.delete({ where: { id } });
  },

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  async createAuditLog(data: CreateAuditLogData): Promise<void> {
    await prisma.auditLog.create({
      data: {
        ...(data.userId !== undefined ? { userId: data.userId } : {}),
        action: data.action,
        resource: data.resource,
        ...(data.resourceId !== undefined ? { resourceId: data.resourceId } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
        ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
      },
    });
  },
};
