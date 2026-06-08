import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../lib/swagger.js';

const router = Router();

// DECISIÓN: la UI de docs está disponible en todos los entornos por simplicidad.
// En producción real, protegerla con authenticate + authorize(['ADMIN', 'SUPER_ADMIN'])
// o bloquearla a IPs internas via Nginx.
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Bract API Docs',
  customCss: `
    .swagger-ui .topbar { display: none }
    body { background: #0a0a0a }
    .swagger-ui { color: #f0f0f0 }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    filter: true,
  },
}));

// JSON puro — útil para importar en Postman / Insomnia
router.get('/json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export { router as docsRouter };
