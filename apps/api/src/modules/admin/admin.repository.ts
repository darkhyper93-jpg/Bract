import { prisma } from '../../prisma/client.js';
import type { AuditLogItem, AuditLogListResponse, AdminStats } from '@bract/shared';
import type { AuditLogQuery } from '@bract/shared';

export const adminRepository = {
  async findAuditLogs(query: AuditLogQuery): Promise<AuditLogListResponse> {
    const { page, perPage, userId, action, resource, dateFrom, dateTo } = query;

    const where = {
      ...(userId   ? { userId }   : {}),
      ...(action   ? { action }   : {}),
      ...(resource ? { resource } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((log) => ({
        id:         log.id,
        userId:     log.userId,
        userName:   log.user?.name  ?? null,
        userEmail:  log.user?.email ?? null,
        action:     log.action,
        resource:   log.resource,
        resourceId: log.resourceId,
        metadata:   log.metadata as Record<string, unknown> | null,
        ipAddress:  log.ipAddress,
        userAgent:  log.userAgent,
        createdAt:  log.createdAt.toISOString(),
      })) satisfies AuditLogItem[],
      meta: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    };
  },

  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      deletedUsers,
      newUsersToday,
      newUsersThisWeek,
      auditTotalToday,
      auditLoginsToday,
      auditRegistrationsToday,
      auditActionsThisWeek,
    ] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { status: 'DELETED' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.auditLog.count({ where: { action: 'LOGIN',    createdAt: { gte: startOfToday } } }),
      prisma.auditLog.count({ where: { action: 'REGISTER', createdAt: { gte: startOfToday } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: startOfWeek } } }),
    ]);

    return {
      users: {
        total:       totalUsers,
        active:      activeUsers,
        suspended:   suspendedUsers,
        deleted:     deletedUsers,
        newToday:    newUsersToday,
        newThisWeek: newUsersThisWeek,
      },
      auditLogs: {
        totalToday:         auditTotalToday,
        loginsToday:        auditLoginsToday,
        registrationsToday: auditRegistrationsToday,
        actionsThisWeek:    auditActionsThisWeek,
      },
    };
  },
};
