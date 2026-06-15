import { usersRepository } from './users.repository.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { enqueueCreateNotification } from '../../jobs/notification.producer.js';
import type { UserListItem, UserPublic, GetUsersQuery, UpdateProfileInput } from '@bract/shared';
import { Role, UserStatus, NotificationType } from '@bract/shared';
import type { Role as PrismaRole, UserStatus as PrismaUserStatus } from '@prisma/client';
import type { UserListRow, UserDetailRow } from './users.repository.js';

interface MutationContext {
  ipAddress?: string;
  userAgent?: string;
}

function toUserListItem(row: UserListRow): UserListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status as UserStatus,
    createdAt: row.createdAt,
  };
}

function toUserPublic(row: UserDetailRow): UserPublic {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    role: row.role as Role,
    status: row.status as UserStatus,
    createdAt: row.createdAt,
  };
}

export const usersService = {
  async listUsers(query: GetUsersQuery): Promise<{ items: UserListItem[]; meta: { total: number; page: number; perPage: number; totalPages: number } }> {
    const { page, perPage, search, role, status } = query;

    const { items, total } = await usersRepository.findMany({
      page,
      perPage,
      ...(search !== undefined ? { search } : {}),
      ...(role !== undefined ? { role: role as PrismaRole } : {}),
      ...(status !== undefined ? { status: status as PrismaUserStatus } : {}),
    });

    return {
      items: items.map(toUserListItem),
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  },

  async getUserById(id: string): Promise<UserPublic> {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }
    return toUserPublic(user);
  },

  async changeUserRole(
    actorId: string,
    targetId: string,
    role: Role,
    context?: MutationContext,
  ): Promise<UserPublic> {
    if (actorId === targetId) {
      throw new AppError('FORBIDDEN', 'SUPER_ADMIN cannot change their own role');
    }

    const target = await usersRepository.findById(targetId);
    if (!target) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    const updated = await usersRepository.updateRole(targetId, role as PrismaRole);

    await usersRepository.createAuditLog({
      userId: actorId,
      action: 'USER_ROLE_CHANGED',
      resource: 'user',
      resourceId: targetId,
      metadata: { previousRole: target.role, newRole: role },
      ...(context?.ipAddress !== undefined ? { ipAddress: context.ipAddress } : {}),
      ...(context?.userAgent !== undefined ? { userAgent: context.userAgent } : {}),
    });

    try {
      await enqueueCreateNotification({
        userId: targetId,
        type: NotificationType.SYSTEM,
        title: 'Tu rol ha sido actualizado',
        body: `Tu rol ahora es ${role}.`,
        data: { newRole: role },
      });
    } catch (err) {
      logger.error('Failed to enqueue role-change notification', { userId: targetId, error: (err as Error).message });
    }

    return toUserPublic(updated);
  },

  async changeUserStatus(
    actorId: string,
    targetId: string,
    status: UserStatus,
    context?: MutationContext,
  ): Promise<UserPublic> {
    if (actorId === targetId) {
      throw new AppError('FORBIDDEN', 'Admin cannot change their own status');
    }

    const target = await usersRepository.findById(targetId);
    if (!target) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    const updated = await usersRepository.updateStatus(targetId, status as PrismaUserStatus);

    await usersRepository.createAuditLog({
      userId: actorId,
      action: 'USER_STATUS_CHANGED',
      resource: 'user',
      resourceId: targetId,
      metadata: { previousStatus: target.status, newStatus: status },
      ...(context?.ipAddress !== undefined ? { ipAddress: context.ipAddress } : {}),
      ...(context?.userAgent !== undefined ? { userAgent: context.userAgent } : {}),
    });

    try {
      await enqueueCreateNotification({
        userId: targetId,
        type: status === UserStatus.SUSPENDED ? NotificationType.WARNING : NotificationType.SUCCESS,
        title: status === UserStatus.SUSPENDED ? 'Cuenta suspendida' : 'Cuenta reactivada',
        body:
          status === UserStatus.SUSPENDED
            ? 'Tu cuenta ha sido suspendida. Contacta al soporte.'
            : 'Tu cuenta ha sido reactivada.',
      });
    } catch (err) {
      logger.error('Failed to enqueue status-change notification', { userId: targetId, error: (err as Error).message });
    }

    return toUserPublic(updated);
  },

  async updateUser(actorId: string, targetId: string, dto: UpdateProfileInput): Promise<UserPublic> {
    if (actorId !== targetId) {
      throw new AppError('FORBIDDEN', 'You can only update your own profile');
    }
    const user = await usersRepository.findById(targetId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found');
    }
    const updated = await usersRepository.updateUser(targetId, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
    });
    return toUserPublic(updated);
  },

  async deleteUser(
    actorId: string,
    targetId: string,
    context?: MutationContext,
  ): Promise<void> {
    if (actorId === targetId) {
      throw new AppError('FORBIDDEN', 'Cannot delete your own account');
    }

    const target = await usersRepository.findById(targetId);
    if (!target) {
      throw new AppError('NOT_FOUND', 'User not found');
    }

    if (target.status === 'DELETED') {
      throw new AppError('CONFLICT', 'User is already deleted');
    }

    await usersRepository.updateStatus(targetId, 'DELETED' as PrismaUserStatus);

    await usersRepository.createAuditLog({
      userId: actorId,
      action: 'USER_DELETED',
      resource: 'user',
      resourceId: targetId,
      metadata: { email: target.email, name: target.name },
      ...(context?.ipAddress !== undefined ? { ipAddress: context.ipAddress } : {}),
      ...(context?.userAgent !== undefined ? { userAgent: context.userAgent } : {}),
    });
  },
};
