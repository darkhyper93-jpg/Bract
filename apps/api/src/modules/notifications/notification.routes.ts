import { Router } from 'express';
import { notificationController } from './notification.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router: Router = Router();

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Listar notificaciones del usuario autenticado
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
 *           maximum: 50
 *       - in: query
 *         name: unread
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: Lista paginada de notificaciones
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
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *                     unreadCount:
 *                       type: integer
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
// PATCH /read-all must be registered before PATCH /:id/read to prevent Express
// matching the literal "read-all" string as :id
router.get('/', authenticate, notificationController.list);
/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar todas las notificaciones como leídas
 *     responses:
 *       200:
 *         description: Notificaciones marcadas como leídas
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
 *                     count:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch('/read-all', authenticate, notificationController.markAllRead);
/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar una notificación como leída
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notificación marcada como leída
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:id/read', authenticate, notificationController.markRead);
/**
 * @openapi
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Eliminar una notificación
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Notificación eliminada
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', authenticate, notificationController.delete);

export { router as notificationRouter };
