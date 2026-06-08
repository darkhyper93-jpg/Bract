import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Bract API',
      version: '1.0.0',
      description: 'API REST del sistema Bract. Autenticación via Bearer JWT (RS256).',
      contact: {
        name: 'Bract',
        url: 'https://bract.app',
      },
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token JWT (RS256, 15 min). Obtener via POST /auth/login.',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Datos inválidos' },
              },
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page:       { type: 'integer', example: 1 },
            perPage:    { type: 'integer', example: 20 },
            total:      { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:            { type: 'string', example: 'cuid123' },
            email:         { type: 'string', format: 'email' },
            name:          { type: 'string', example: 'Juan Pérez' },
            avatarUrl:     { type: 'string', nullable: true },
            role:          { type: 'string', enum: ['USER', 'ADMIN', 'SUPER_ADMIN'] },
            status:        { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] },
            emailVerified: { type: 'boolean' },
            createdAt:     { type: 'string', format: 'date-time' },
            updatedAt:     { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id:        { type: 'string' },
            type:      { type: 'string', enum: ['SYSTEM', 'ALERT', 'INFO', 'SUCCESS', 'WARNING'] },
            title:     { type: 'string' },
            body:      { type: 'string' },
            read:      { type: 'boolean' },
            readAt:    { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            userId:      { type: 'string', nullable: true },
            userName:    { type: 'string', nullable: true },
            userEmail:   { type: 'string', nullable: true },
            action:      { type: 'string', example: 'LOGIN' },
            resource:    { type: 'string', example: 'auth' },
            resourceId:  { type: 'string', nullable: true },
            ipAddress:   { type: 'string', nullable: true },
            createdAt:   { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Token ausente o inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, error: { code: 'UNAUTHORIZED', message: 'Token inválido' } },
            },
          },
        },
        Forbidden: {
          description: 'Sin permisos para este recurso',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        NotFound: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        ValidationError: {
          description: 'Datos de entrada inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Auth',          description: 'Autenticación y gestión de sesión' },
      { name: 'Profile',       description: 'Perfil del usuario autenticado' },
      { name: 'Users',         description: 'Gestión de usuarios (solo ADMIN)' },
      { name: 'Notifications', description: 'Notificaciones in-app' },
      { name: 'Files',         description: 'Upload de archivos a R2' },
      { name: 'Analytics',     description: 'Métricas del sistema (solo ADMIN)' },
      { name: 'Admin',         description: 'Panel de administración (solo ADMIN)' },
    ],
  },
  // DECISIÓN: apuntamos a los .js compilados porque swagger-jsdoc usa regex sobre el texto
  // del archivo fuente; en runtime los .ts ya transpilaron a .js en dist/, pero ts-node-dev
  // ejecuta desde src/ — usamos __dirname relativo al archivo compilado para que funcione en ambos.
  apis: [
    './src/modules/auth/auth.routes.ts',
    './src/modules/users/users.routes.ts',
    './src/modules/profile/profile.routes.ts',
    './src/modules/notifications/notification.routes.ts',
    './src/modules/analytics/analytics.routes.ts',
    './src/modules/admin/admin.routes.ts',
    './src/modules/files/files.routes.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
