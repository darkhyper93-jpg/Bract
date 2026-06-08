import { prisma } from '../../prisma/client.js';
import type { Prisma, Role, UserStatus } from '@prisma/client';

const USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

const USER_DETAIL_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
} as const;

export type UserListRow = Prisma.UserGetPayload<{ select: typeof USER_LIST_SELECT }>;
export type UserDetailRow = Prisma.UserGetPayload<{ select: typeof USER_DETAIL_SELECT }>;

export interface FindManyFilters {
  page: number;
  perPage: number;
  search?: string;
  role?: Role;
  status?: UserStatus;
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

export const usersRepository = {
  async findMany(filters: FindManyFilters): Promise<{ items: UserListRow[]; total: number }> {
    const { page, perPage, search, role, status } = filters;
    const skip = (page - 1) * perPage;

    const where: Prisma.UserWhereInput = {};
    if (role !== undefined) where.role = role;
    if (status !== undefined) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  },

  async findById(id: string): Promise<UserDetailRow | null> {
    return prisma.user.findUnique({ where: { id }, select: USER_DETAIL_SELECT });
  },

  async updateRole(id: string, role: Role): Promise<UserDetailRow> {
    return prisma.user.update({ where: { id }, data: { role }, select: USER_DETAIL_SELECT });
  },

  async updateStatus(id: string, status: UserStatus): Promise<UserDetailRow> {
    return prisma.user.update({ where: { id }, data: { status }, select: USER_DETAIL_SELECT });
  },

  async updateUser(id: string, data: { name?: string; avatarUrl?: string }): Promise<UserDetailRow> {
    return prisma.user.update({ where: { id }, data, select: USER_DETAIL_SELECT });
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
