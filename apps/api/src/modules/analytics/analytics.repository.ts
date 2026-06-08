import { prisma } from '../../prisma/client.js';
import type { AnalyticsOverview, UserGrowthPoint, ActivityPoint } from '@bract/shared';

export const analyticsRepository = {
  async getOverview(): Promise<AnalyticsOverview> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      deletedUsers,
      newUsersToday,
      newUsersThisWeek,
      usersByRole,
    ] = await prisma.$transaction([
      prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { status: 'DELETED' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
      // DECISIÓN: orderBy es obligatorio a nivel de tipos en Prisma.groupBy aunque no usemos take/skip — sin él, tsc falla (TS2345)
      prisma.user.groupBy({ by: ['role'], _count: { id: true }, orderBy: { role: 'asc' } }),
    ]);

    const roleMap = Object.fromEntries(usersByRole.map((r) => [r.role, r._count.id]));

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      suspendedUsers,
      byRole: {
        USER: roleMap['USER'] ?? 0,
        ADMIN: roleMap['ADMIN'] ?? 0,
        SUPER_ADMIN: roleMap['SUPER_ADMIN'] ?? 0,
      },
      byStatus: {
        ACTIVE: activeUsers,
        SUSPENDED: suspendedUsers,
        DELETED: deletedUsers,
      },
    };
  },

  async getUserGrowthSeries(days: number): Promise<UserGrowthPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // DECISIÓN: $queryRaw con DATE_TRUNC de Postgres porque Prisma groupBy no soporta
    // agrupación por parte de fecha directamente. El input `since` es una fecha calculada
    // en TypeScript, no viene del usuario — no hay riesgo de inyección SQL.
    const rows = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        COUNT(*)::bigint               AS count
      FROM users
      WHERE "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().split('T')[0]!,
      count: Number(r.count),
    }));
  },

  async getActivitySeries(days: number): Promise<ActivityPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // DECISIÓN: $queryRaw por la misma razón que getUserGrowthSeries (DATE_TRUNC).
    // Agrupamos en una sola query con FILTER para evitar dos round-trips a la DB.
    // El input `since` es una fecha calculada en TypeScript, sin input de usuario — sin riesgo de inyección.
    const rows = await prisma.$queryRaw<{
      date: Date;
      logins: bigint;
      registrations: bigint;
    }[]>`
      SELECT
        DATE_TRUNC('day', "createdAt")                               AS date,
        COUNT(*) FILTER (WHERE action = 'LOGIN')::bigint             AS logins,
        COUNT(*) FILTER (WHERE action = 'REGISTER')::bigint          AS registrations
      FROM audit_logs
      WHERE "createdAt" >= ${since}
        AND action IN ('LOGIN', 'REGISTER')
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: r.date.toISOString().split('T')[0]!,
      logins: Number(r.logins),
      registrations: Number(r.registrations),
    }));
  },
};
