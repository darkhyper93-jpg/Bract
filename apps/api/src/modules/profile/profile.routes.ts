import { Router } from 'express';
import { profileController } from './profile.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router: Router = Router();

// All profile routes require authentication — README §5.5
router.use(authenticate);

/**
 * @openapi
 * /profile:
 *   get:
 *     tags: [Profile]
 *     summary: Obtener perfil del usuario autenticado
 *     responses:
 *       200:
 *         description: Perfil del usuario
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
 *   patch:
 *     tags: [Profile]
 *     summary: Actualizar nombre o avatarUrl
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', profileController.getProfile);
router.patch('/', profileController.updateProfile);
/**
 * @openapi
 * /profile/password:
 *   patch:
 *     tags: [Profile]
 *     summary: Cambiar contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       401:
 *         description: Contraseña actual incorrecta
 */
router.patch('/password', profileController.changePassword);
/**
 * @openapi
 * /profile/avatar:
 *   delete:
 *     tags: [Profile]
 *     summary: Eliminar avatar del usuario
 *     responses:
 *       200:
 *         description: Avatar eliminado, avatarUrl = null
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.delete('/avatar', profileController.removeAvatar);

export { router as profileRouter };
