import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { analyticsController } from './analytics.controller.js';
import { Role } from '@bract/shared';

const router = Router();

// Todos los endpoints de analytics requieren ADMIN o SUPER_ADMIN — README §5.5
router.use(authenticate);
router.use(authorize(Role.ADMIN, Role.SUPER_ADMIN));

/**
 * @openapi
 * /analytics/overview:
 *   get:
 *     tags: [Analytics]
 *     summary: Estadísticas generales del sistema
 *     description: Caché Redis TTL 5 minutos. Solo ADMIN/SUPER_ADMIN.
 *     responses:
 *       200:
 *         description: Overview de métricas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     newUsersToday:
 *                       type: integer
 *                     newUsersThisWeek:
 *                       type: integer
 *                     suspendedUsers:
 *                       type: integer
 *                     byRole:
 *                       type: object
 *                       properties:
 *                         USER:
 *                           type: integer
 *                         ADMIN:
 *                           type: integer
 *                         SUPER_ADMIN:
 *                           type: integer
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         ACTIVE:
 *                           type: integer
 *                         SUSPENDED:
 *                           type: integer
 *                         DELETED:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/overview', analyticsController.getOverview);
/**
 * @openapi
 * /analytics/users:
 *   get:
 *     tags: [Analytics]
 *     summary: Serie temporal de crecimiento de usuarios
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 7
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Array de puntos de crecimiento por día
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users', analyticsController.getUserGrowth);
/**
 * @openapi
 * /analytics/activity:
 *   get:
 *     tags: [Analytics]
 *     summary: Serie temporal de actividad diaria (logins + registros)
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 7
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Array de puntos de actividad por día
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       logins:
 *                         type: integer
 *                       registrations:
 *                         type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/activity', analyticsController.getActivity);

export { router as analyticsRouter };
