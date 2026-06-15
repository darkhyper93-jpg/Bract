import { prisma } from '../../prisma/client.js';
import type { User } from '@prisma/client';
import type { UpdateProfileInput } from '@bract/shared';

type UserWithoutPassword = Omit<User, 'passwordHash'>;

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const profileRepository = {
  async findById(id: string): Promise<UserWithoutPassword | null> {
    return prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  },

  async findByIdWithPassword(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async updateProfile(id: string, dto: UpdateProfileInput): Promise<UserWithoutPassword> {
    // Build data object with only defined fields — required by exactOptionalPropertyTypes + Prisma's strict update types
    const data: { name?: string; avatarUrl?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;

    return prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  },

  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });
  },

  async removeAvatar(id: string): Promise<UserWithoutPassword> {
    return prisma.user.update({
      where: { id },
      data: { avatarUrl: null },
      select: USER_SELECT,
    });
  },

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
