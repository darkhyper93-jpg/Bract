import { Router } from 'express';
import { usersController } from './users.controller.js';
import { authenticate, authorize, authorizeSelfOrAdmin } from '../../middleware/auth.middleware.js';
import { Role } from '@bract/shared';

const router = Router();

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Listar usuarios (paginado + filtros)
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nombre o email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN, SUPER_ADMIN]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, DELETED]
 *     responses:
 *       200:
 *         description: Lista paginada de usuarios
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
 *                     $ref: '#/components/schemas/User'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// README §5.5: GET /api/v1/users — ADMIN+
router.get('/', authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), usersController.listUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Obtener usuario por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Datos del usuario
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Users]
 *     summary: Actualizar usuario (self)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   delete:
 *     tags: [Users]
 *     summary: Eliminar usuario (soft delete)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Usuario eliminado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// README §5.5: GET /api/v1/users/:id — ADMIN | self
router.get('/:id', authenticate, authorizeSelfOrAdmin, usersController.getUserById);

// README §5.5: PATCH /api/v1/users/:id — self only (service enforces actorId === targetId)
router.patch('/:id', authenticate, usersController.updateUser);

/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: Cambiar rol de usuario (solo SUPER_ADMIN)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN, SUPER_ADMIN]
 *     responses:
 *       200:
 *         description: Rol actualizado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// README §5.5: PATCH /api/v1/users/:id/role — SUPER_ADMIN only
router.patch('/:id/role', authenticate, authorize(Role.SUPER_ADMIN), usersController.changeUserRole);

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: Cambiar status de usuario (ADMIN+)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED]
 *     responses:
 *       200:
 *         description: Status actualizado
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
// README §5.5: PATCH /api/v1/users/:id/status — ADMIN+
router.patch('/:id/status', authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), usersController.changeUserStatus);

// README §5.5: DELETE /api/v1/users/:id — ADMIN+ (soft delete)
router.delete('/:id', authenticate, authorize(Role.ADMIN, Role.SUPER_ADMIN), usersController.deleteUser);

export { router as usersRouter };
