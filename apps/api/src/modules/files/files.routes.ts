import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { filesController } from './files.controller.js';

export const filesRouter: Router = Router();

filesRouter.use(authenticate);

/**
 * @openapi
 * /files/upload-url:
 *   post:
 *     tags: [Files]
 *     summary: Solicitar signed URL para upload directo a R2
 *     description: |
 *       Flujo completo:
 *       1. POST aquí → recibir uploadUrl + fileId
 *       2. PUT directo a R2 con el archivo (sin pasar por el API)
 *       3. POST /files/{id}/confirm para confirmar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [filename, mimeType, size]
 *             properties:
 *               filename:
 *                 type: string
 *               mimeType:
 *                 type: string
 *                 enum: [image/jpeg, image/png, image/webp, application/pdf]
 *               size:
 *                 type: integer
 *                 maximum: 10485760
 *                 description: 'Bytes, máximo 10MB'
 *     responses:
 *       200:
 *         description: Signed URL generada
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
 *                     uploadUrl:
 *                       type: string
 *                       format: uri
 *                     fileId:
 *                       type: string
 *                     key:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
filesRouter.post('/upload-url', filesController.requestUploadUrl);
/**
 * @openapi
 * /files/{id}/confirm:
 *   post:
 *     tags: [Files]
 *     summary: Confirmar upload completado
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Upload confirmado, publicUrl disponible
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
 *                     publicUrl:
 *                       type: string
 *                       format: uri
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
filesRouter.post('/:id/confirm', filesController.confirmUpload);
/**
 * @openapi
 * /files/{id}:
 *   delete:
 *     tags: [Files]
 *     summary: Eliminar archivo de R2 y DB
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Archivo eliminado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
filesRouter.delete('/:id', filesController.deleteFile);
