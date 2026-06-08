import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { createRateLimiter } from '../../middleware/rateLimiter.middleware.js';
import { RATE_LIMIT } from '../../config/constants.js';

const router = Router();

// Per-route rate limiters — README §5.4
const loginLimiter = createRateLimiter(RATE_LIMIT.AUTH_LOGIN.max, RATE_LIMIT.AUTH_LOGIN.windowMs);
const registerLimiter = createRateLimiter(RATE_LIMIT.AUTH_REGISTER.max, RATE_LIMIT.AUTH_REGISTER.windowMs);
const forgotPasswordLimiter = createRateLimiter(RATE_LIMIT.AUTH_FORGOT_PASSWORD.max, RATE_LIMIT.AUTH_FORGOT_PASSWORD.windowMs);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       201:
 *         description: Usuario creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Email ya registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', registerLimiter, authController.register);
/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso. Retorna access token en body y refresh token en cookie HttpOnly.
 *         headers:
 *           Set-Cookie:
 *             description: refresh_token HttpOnly cookie
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Demasiados intentos (10 por 15 min)
 */
router.post('/login', loginLimiter, authController.login);
/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión
 *     responses:
 *       200:
 *         description: Sesión cerrada. Revoca refresh token y borra cookie.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/logout', authenticate, authController.logout);
/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token
 *     security: []
 *     description: Usa el refresh token de la cookie HttpOnly. Rota el token en cada uso.
 *     responses:
 *       200:
 *         description: Nuevo access token emitido
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
 *                     accessToken:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/refresh', authController.refresh);
/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Solicitar reset de contraseña
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Email enviado si el usuario existe (siempre 200 para no revelar emails)
 *       429:
 *         description: Demasiados intentos (3 por hora)
 */
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Cambiar contraseña con token de reset
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token del email de reset
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Token inválido o expirado
 */
router.post('/reset-password', authController.resetPassword);
/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Obtener usuario autenticado
 *     responses:
 *       200:
 *         description: Datos del usuario autenticado
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
 */
router.get('/me', authenticate, authController.me);
/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Verificar email con token del link
 *     security: []
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de verificación enviado por email
 *     responses:
 *       200:
 *         description: Email verificado correctamente
 *       400:
 *         description: Token inválido o expirado
 */
router.get('/verify-email', authController.verifyEmail);

export { router as authRouter };
