import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware.js';
import { Role } from '@bract/shared';
import { adminController } from './admin.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN, Role.SUPER_ADMIN));

/**
 * @openapi
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Listar audit logs del sistema
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [LOGIN, REGISTER, USER_ROLE_CHANGED, USER_STATUS_CHANGED, USER_DELETED]
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Lista paginada de audit logs
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
 *                     $ref: '#/components/schemas/AuditLog'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/audit-logs', adminController.getAuditLogs);
/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Estadísticas del sistema para el panel admin
 *     description: Sin cache — datos siempre frescos.
 *     responses:
 *       200:
 *         description: Stats del sistema
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/stats',      adminController.getStats);

export { router as adminRouter };
