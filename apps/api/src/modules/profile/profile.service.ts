import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { profileRepository } from './profile.repository.js';
import { AppError } from '../../lib/errors.js';
import { redis } from '../../lib/redis.js';
import type { User, UpdateProfileInput, ChangePasswordDto, JWTPayload } from '@bract/shared';
import { Role, UserStatus } from '@bract/shared';
import type { User as PrismaUser } from '@prisma/client';

const BCRYPT_SALT_ROUNDS = 12;
const BLACKLIST_PREFIX = 'blacklist:';

type UserWithoutPassword = Omit<PrismaUser, 'passwordHash'>;

function toPublicUser(user: UserWithoutPassword): User {
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

export const profileService = {
  async getProfile(userId: string): Promise<User> {
    const user = await profileRepository.findById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }
    return toPublicUser(user);
  },

  async updateProfile(userId: string, dto: UpdateProfileInput): Promise<User> {
    const updates: UpdateProfileInput = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.avatarUrl !== undefined) updates.avatarUrl = dto.avatarUrl;

    const updated = await profileRepository.updateProfile(userId, updates);
    return toPublicUser(updated);
  },

  async changePassword(userId: string, dto: ChangePasswordDto, rawAccessToken: string): Promise<void> {
    const user = await profileRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError('UNAUTHORIZED', 'Contraseña actual incorrecta');
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await profileRepository.updatePassword(userId, newHash);

    // Revoke all refresh tokens — invalidate all sessions
    await profileRepository.revokeAllRefreshTokens(userId);

    // Add current access token to Redis blacklist so it stops working immediately
    const decoded = jwt.decode(rawAccessToken) as JWTPayload | null;
    if (decoded?.exp !== undefined) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        const tokenHash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
        await redis.set(`${BLACKLIST_PREFIX}${tokenHash}`, '1', { ex: ttl });
      }
    }
  },

  async removeAvatar(userId: string): Promise<User> {
    const updated = await profileRepository.removeAvatar(userId);
    return toPublicUser(updated);
  },
};
