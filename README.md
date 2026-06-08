# BRACT — SYSTEM SPECIFICATION v3.0
> **Single Source of Truth.**
> Este documento define la arquitectura completa, reglas, infraestructura, UI, seguridad y flujo del sistema.
> **Todo código debe seguir estrictamente este archivo. Sin excepciones.**

---

## 0. CORE PRINCIPLES (NO NEGOCIABLES)

Estas reglas se aplican a CADA línea de código, CADA componente, CADA decisión de diseño:

| # | Principio | Regla concreta |
|---|-----------|---------------|
| 1 | **Dark-first UI** | El modo oscuro es el diseño base. Light mode es derivado posterior. |
| 2 | **Performance < 100ms** | Toda interacción percibida debe resolverse en < 100ms. |
| 3 | **Zero broken states** | Todo flujo tiene: `loading` · `empty` · `error` · `success`. Sin excepción. |
| 4 | **Security by default** | Auth y validación activos en toda ruta. No existe "ruta sin proteger". |
| 5 | **Type safety full-stack** | TypeScript en frontend, backend y paquetes compartidos. |
| 6 | **Zod en todo** | No existe validación sin schema Zod. |
| 7 | **No acceso DB desde frontend** | El frontend nunca toca DB directamente. Todo pasa por API. |
| 8 | **API versionada** | Toda ruta de API comienza con `/api/v1/`. |
| 9 | **Todo async es observable** | Toda operación asíncrona tiene estado, error y cancelación posible. |
| 10 | **Si no está aquí, no se implementa** | Cualquier feature nueva requiere spec previa en este documento. |

---

## 1. TECH STACK COMPLETO

### 1.1 Frontend

| Tecnología | Versión | Rol |
|-----------|---------|-----|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool |
| TailwindCSS | 3 | Utility styling |
| Zustand | latest | Estado global (UI + auth) |
| TanStack Query | 5 | Server state + cache |
| React Router | 6 | Client-side routing |
| React Hook Form | latest | Formularios |
| Zod | latest | Schema validation (compartido con backend) |
| Framer Motion | latest | Animaciones y transiciones |
| Recharts | latest | Gráficos y analytics |
| i18next | latest | Internacionalización |
| Axios | latest | HTTP client con interceptors |

### 1.2 Backend (Core API)

| Tecnología | Versión | Rol |
|-----------|---------|-----|
| Node.js | 20 LTS | Runtime |
| Express | 4 | HTTP framework |
| TypeScript | 5 | Type safety |
| Prisma ORM | latest | Query layer sobre Supabase Postgres |
| Zod | latest | Request/response validation |
| BullMQ | latest | Cola de trabajos async (sobre Upstash Redis) |
| Resend | latest | Envío de emails transaccionales |
| Winston | latest | Logging estructurado |
| OpenTelemetry | latest | Trazabilidad y observabilidad |
| bcrypt | latest | Hash de contraseñas |
| jsonwebtoken | latest | Firma y verificación de JWT |

### 1.3 Data Layer

| Componente | Proveedor | Propósito |
|-----------|----------|-----------|
| **Base de datos principal** | Supabase PostgreSQL | Datos de aplicación, RLS habilitado |
| **Cache / Rate limit / Sessions** | Upstash Redis | Serverless Redis — blacklist JWT, rate limit, cache |
| **Queue worker** | BullMQ (sobre Upstash Redis) | Jobs async: emails, notificaciones, reportes |
| **Email** | Resend | Envío transaccional (API, sin SMTP propio) |
| **Search** | Supabase FTS (Postgres) | Full-text search nativo (inicio); Elasticsearch opcional en v2 |
| **Object storage** | Cloudflare R2 | Archivos, imágenes, exports |

> ⚠️ **REGLA CRÍTICA SUPABASE + PRISMA:**
> Supabase provee el Postgres gestionado. Prisma actúa ÚNICAMENTE como query layer.
> Las migraciones se gestionan via `prisma migrate` en desarrollo y `supabase migrations` en producción.
> No se usa el cliente de Supabase directamente desde el backend (excepto para RLS o auth mode B).

### 1.4 Infraestructura

| Capa | Proveedor | Función |
|------|----------|---------|
| CDN + WAF + DDoS | Cloudflare | Distribución global, protección, rate limit edge |
| DNS | Cloudflare | Gestión de dominios |
| Edge caching | Cloudflare Workers (opcional) | Validación auth en edge, API caching |
| Backend hosting | Docker + Kubernetes | Contenedores del API server |
| Reverse proxy | Nginx | Upstream routing al cluster K8s |
| Base de datos | Supabase Postgres | Gestionado, sin mantenimiento de servidor |
| Cache / Queues | Upstash Redis | Serverless Redis, sin servidor propio |
| File storage | Cloudflare R2 | Cero costo de egress, CDN integrado |
| Email | Resend | API transaccional, sin servidor SMTP |
| CI/CD | GitHub Actions | Build, test, deploy automatizado |
| Secrets | Cloudflare Secrets + .env | Gestión segura de variables sensibles |

---

## 2. ESTRUCTURA DE REPOSITORIO

```
bract/
├── .cursor/
│   └── rules/                  # Cursor AI rules (ver sección AI Agent)
├── .github/
│   └── workflows/
│       ├── ci.yml              # Tests + lint en PR
│       └── deploy.yml          # Deploy automático en merge a main
├── apps/
│   ├── web/                    # Frontend React
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/     # Componentes compartidos (design system)
│   │   │   │   ├── ui/         # Primitivos: Button, Input, Modal, Table...
│   │   │   │   └── layout/     # Shell, Sidebar, Header, PageWrapper
│   │   │   ├── features/       # Módulos de feature
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── users/
│   │   │   │   ├── analytics/
│   │   │   │   ├── notifications/
│   │   │   │   └── admin/
│   │   │   ├── hooks/          # Hooks reutilizables
│   │   │   ├── lib/            # Configuración (axios, query client, i18n)
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── types/          # Tipos locales frontend
│   │   │   ├── utils/          # Helpers puros
│   │   │   ├── router/         # Routes + guards
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── api/                    # Backend Express
│       ├── src/
│       │   ├── config/         # Env, DB, Redis config
│       │   ├── middleware/      # Auth, rate limit, error handler, logger
│       │   ├── modules/        # Módulos por dominio
│       │   │   ├── auth/
│       │   │   │   ├── auth.routes.ts
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   └── auth.repository.ts
│       │   │   ├── users/
│       │   │   ├── notifications/
│       │   │   ├── analytics/
│       │   │   ├── files/
│       │   │   └── admin/
│       │   ├── jobs/           # BullMQ workers
│       │   │   ├── email.worker.ts
│       │   │   ├── notification.worker.ts
│       │   │   ├── report.worker.ts
│       │   │   └── cleanup.worker.ts   # archivos PENDING sin confirmar, tokens expirados
│       │   ├── prisma/         # Prisma client singleton
│       │   ├── lib/            # Redis client, R2 client, helpers
│       │   ├── types/          # Tipos internos API
│       │   └── server.ts       # Entry point
│       ├── prisma/
│       │   └── schema.prisma
│       └── tsconfig.json
│
├── packages/
│   └── shared/                 # Código compartido frontend + backend
│       ├── src/
│       │   ├── schemas/        # Zod schemas (FUENTE ÚNICA de validación)
│       │   │   ├── auth.schema.ts
│       │   │   ├── user.schema.ts
│       │   │   ├── pagination.schema.ts
│       │   │   └── response.schema.ts
│       │   └── types/          # Tipos TypeScript derivados de schemas
│       └── package.json
│
├── docker/
│   ├── api.Dockerfile          # Image del backend Express (solo para producción)
│   └── nginx.conf              # Config reverse proxy producción
├── docker-compose.prod.yml     # Prod: api + workers + nginx (NO hay docker-compose.yml de dev)
├── error.md                    # Log manual de errores y decisiones
└── README.md                   # Este archivo
```

---

## 3. DATA ARCHITECTURE

### 3.1 Modelos Prisma (schema.prisma)

```prisma
// ==========================================
// USUARIO
// ==========================================
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String
  avatarUrl     String?
  role          Role      @default(USER)
  status        UserStatus @default(ACTIVE)
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  refreshTokens RefreshToken[]
  notifications Notification[]
  auditLogs     AuditLog[]
  sessions      Session[]

  @@map("users")
}

enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  DELETED
}

// ==========================================
// AUTH
// ==========================================
model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  revokedAt DateTime?
  ipAddress String?
  userAgent String?

  @@map("refresh_tokens")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  ipAddress String?
  userAgent String?

  @@map("sessions")
}

// ==========================================
// NOTIFICACIONES
// ==========================================
model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  title     String
  body      String
  data      Json?
  read      Boolean          @default(false)
  readAt    DateTime?
  createdAt DateTime         @default(now())

  @@map("notifications")
}

enum NotificationType {
  SYSTEM
  ALERT
  INFO
  SUCCESS
  WARNING
}

// ==========================================
// AUDIT LOG
// ==========================================
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  action     String
  resource   String
  resourceId String?
  metadata   Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@map("audit_logs")
}

// ==========================================
// FILE METADATA (archivos en R2)
// ==========================================
model FileRecord {
  id          String      @id @default(cuid())
  key         String      @unique   // R2 object key
  bucket      String
  filename    String
  mimeType    String
  size        Int
  uploadedBy  String
  publicUrl   String?
  status      FileStatus  @default(PENDING)
  createdAt   DateTime    @default(now())
  confirmedAt DateTime?

  @@map("file_records")
}

enum FileStatus {
  PENDING    // signed URL emitida, upload no confirmado
  UPLOADED   // confirmado por el cliente
  DELETED    // marcado como eliminado (soft delete)
}
```

### 3.2 Reglas de base de datos

- **RLS (Row Level Security)** habilitado en Supabase para todas las tablas de usuario
- **Índices obligatorios**: `email` en users, `token` en refresh_tokens, `userId` en todas las tablas relacionadas, `createdAt` en audit_logs
- **Soft delete** en users (status = DELETED, no borrar físicamente)
- **Cascade deletes** en relaciones de sesión y tokens
- **No queries N+1**: toda relación debe cargarse con `include` o `select` explícito

---

## 4. AUTH SYSTEM

### 4.1 Modo de auth (MODO A — Custom JWT, RECOMENDADO)

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

### 4.2 Especificación de tokens

| Token | Duración | Almacenamiento | Rotación |
|-------|---------|---------------|----------|
| Access JWT | 15 minutos | Memory (frontend) | Expira naturalmente, se renueva via refresh |
| Refresh Token | 7 días | HttpOnly Cookie + DB | Rotación obligatoria en cada uso |

**Reglas:**
- Access token: firmado con RS256 (clave privada en servidor, pública verificable)
- Refresh token: almacenado hasheado en DB; el token plano solo viaja en cookie HttpOnly
- Blacklist de tokens revocados: Redis con TTL igual al tiempo restante del token
- Un refresh token usado → se revoca y se emite uno nuevo (rotation)
- Si refresh token ya fue usado (reutilización detectada) → revocar TODOS los tokens del usuario

### 4.3 Flujo de login

```
1. Cliente → POST /api/v1/auth/login { email, password }
2. API verifica email existe en DB
3. bcrypt.compare(password, user.passwordHash)
4. Si válido:
   a. Generar access JWT (RS256, 15min, payload: { sub: userId, role, email })
   b. Generar refresh token (crypto.randomBytes(64).toString('hex'))
   c. Guardar refresh token hasheado en DB (RefreshToken record)
   d. Cachear session en Redis (key: session:{userId}, TTL: 7d)
5. Respuesta:
   a. access_token en body JSON
   b. refresh_token en HttpOnly Cookie (Secure, SameSite=Strict)
```

### 4.4 Flujo de refresh

```
1. Cliente → POST /api/v1/auth/refresh (cookie automática)
2. API extrae refresh token de cookie
3. Buscar token en DB (no revocado, no expirado)
4. Verificar hash coincide
5. Revocar token anterior (revokedAt = now())
6. Generar nuevo par de tokens
7. Responder con nuevo access token + nueva cookie
```

### 4.5 Middleware de auth

```typescript
// Todo middleware de auth debe:
// 1. Extraer Bearer token del header Authorization
// 2. Verificar firma JWT con clave pública
// 3. Verificar token no está en Redis blacklist
// 4. Adjuntar user context al request
// 5. En caso de error: 401 Unauthorized (nunca 403 por token inválido)

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: Role;
  };
}
```

---

## 5. API ARCHITECTURE

### 5.1 Estructura de capas (obligatoria)

```
Request
  → Route (Express Router)
  → Middleware (auth, rate limit, validate)
  → Controller (HTTP only: extrae params, llama service, responde)
  → Service (lógica de negocio, orquesta repositorios)
  → Repository (queries Prisma, sin lógica de negocio)
  → Supabase Postgres / Redis / R2
  → Response
```

**Reglas de capas:**
- Controllers: SOLO lógica HTTP. Extraen `req.body`, `req.params`, `req.query`. Llaman al service. Responden.
- Services: TODA la lógica de negocio. No saben de HTTP. Pueden llamar a múltiples repositorios.
- Repositories: SOLO queries Prisma. No saben de negocio ni de HTTP.
- Ninguna capa salta la anterior.

### 5.2 Envelope de respuesta (OBLIGATORIO en toda respuesta)

```typescript
// Éxito
{
  "success": true,
  "data": { ... },
  "meta": {                    // solo en listas paginadas
    "total": 100,
    "page": 1,
    "perPage": 20,
    "totalPages": 5
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email inválido",
    "details": [ ... ]         // solo en errores de validación
  }
}
```

### 5.3 Error codes (estandarizados)

| Code | HTTP Status | Descripción |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Body/params inválidos |
| `UNAUTHORIZED` | 401 | Token ausente o inválido |
| `FORBIDDEN` | 403 | Sin permisos para el recurso |
| `NOT_FOUND` | 404 | Recurso no existe |
| `CONFLICT` | 409 | Conflicto (email duplicado, etc.) |
| `RATE_LIMITED` | 429 | Demasiadas requests |
| `INTERNAL_ERROR` | 500 | Error interno |

### 5.4 Rate limiting

| Endpoint | Límite | Ventana |
|---------|--------|--------|
| `POST /auth/login` | 10 req | 15 min por IP |
| `POST /auth/register` | 5 req | 1 hora por IP |
| `POST /auth/forgot-password` | 3 req | 1 hora por IP |
| Resto de API (autenticado) | 500 req | 1 min por user |
| Resto de API (anónimo) | 60 req | 1 min por IP |

Rate limiting se aplica en DOS capas:
1. **Cloudflare Edge**: primera línea de defensa (WAF rules)
2. **Express middleware**: Redis-backed, granular por endpoint

### 5.5 Rutas completas

```
AUTH
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/auth/me

USERS
GET    /api/v1/users              [ADMIN]
GET    /api/v1/users/:id          [ADMIN | self]
PATCH  /api/v1/users/:id          [self]
DELETE /api/v1/users/:id          [ADMIN]
PATCH  /api/v1/users/:id/role     [SUPER_ADMIN]
PATCH  /api/v1/users/:id/status   [ADMIN]

PROFILE
GET    /api/v1/profile
PATCH  /api/v1/profile
PATCH  /api/v1/profile/password
DELETE /api/v1/profile/avatar

NOTIFICATIONS
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
PATCH  /api/v1/notifications/read-all
DELETE /api/v1/notifications/:id

FILES
POST   /api/v1/files/upload-url      → genera signed URL de R2
POST   /api/v1/files/:id/confirm     → confirma upload completado
DELETE /api/v1/files/:id             → elimina archivo (R2 + DB)

ANALYTICS
GET    /api/v1/analytics/overview
GET    /api/v1/analytics/users
GET    /api/v1/analytics/activity

ADMIN
GET    /api/v1/admin/users        [ADMIN]
GET    /api/v1/admin/audit-logs   [ADMIN]
GET    /api/v1/admin/stats        [ADMIN]
```

---

## 6. STORAGE — CLOUDFLARE R2

### 6.1 Flujo de upload (obligatorio)

```
1. Cliente → POST /api/v1/files/upload-url { filename, mimeType, size }
2. API valida: mimeType permitido, size < límite
3. API genera signed URL (PUT) en R2 con expiración de 5 minutos
4. API guarda metadata en DB (FileRecord) con status PENDING
5. API responde: { uploadUrl, fileId, key }
6. Cliente → PUT directo a R2 usando signed URL (sin pasar por API)
7. Cliente → POST /api/v1/files/:fileId/confirm
8. API actualiza FileRecord status a UPLOADED
9. API responde: { publicUrl }
```

**Reglas:**
- La API NUNCA recibe bytes de archivos en el body
- Tipos permitidos: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Tamaño máximo: 10MB por archivo
- Keys de R2: `{userId}/{timestamp}-{randomId}.{ext}`
- Los archivos son inmutables tras upload (no se sobreescriben, se crean nuevos)
- Si el archivo no se confirma en 10 minutos, el registro se elimina (job cleanup)

---

## 7. ASYNC JOBS (BULLMQ)

### 7.1 Queues definidas

| Queue | Worker | Propósito |
|-------|--------|-----------|
| `email` | email.worker | Envío de emails (bienvenida, reset password, notificaciones) |
| `notification` | notification.worker | Crear notificaciones in-app |
| `report` | report.worker | Generar reportes exportables |
| `cleanup` | cleanup.worker | Limpiar archivos pendientes, tokens expirados |

### 7.2 Reglas de jobs

- Todo job tiene: `retries: 3`, `backoff: exponential`
- Jobs fallidos se archivan en Upstash por 7 días (no se eliminan)
- Logs de job escritos con Winston (level: info en success, error en fallo)
- No se procesan jobs de más de 30 minutos (timeout)
- Jobs críticos (email reset password) tienen `priority: 1` (máxima)
- Email enviado exclusivamente vía Resend SDK (no SMTP directo)

---

## 8. FRONTEND ARCHITECTURE

### 8.1 Estructura de feature

Cada feature en `src/features/` sigue esta estructura interna:

```
features/auth/
├── components/       # Componentes específicos de la feature
├── hooks/            # useAuth, useLogin, etc.
├── api/              # Funciones de llamada a API (usadas por React Query)
├── schemas/          # Zod schemas locales si no están en shared
├── stores/           # Zustand slices si la feature tiene estado propio
├── types/            # Tipos locales de la feature
└── index.ts          # Export público de la feature
```

### 8.2 Estado global (Zustand)

```typescript
// stores/authStore.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

// stores/uiStore.ts
interface UIState {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  notifications: NotificationToast[];
  // Actions
  toggleSidebar: () => void;
  addNotification: (n: NotificationToast) => void;
  removeNotification: (id: string) => void;
}
```

### 8.3 Server state (TanStack Query)

```typescript
// Reglas de React Query:
// - staleTime mínimo: 30 segundos para datos de usuario
// - staleTime: 5 minutos para datos de analytics
// - Toda mutación invalida sus queries relacionadas
// - Error boundaries en cada feature
// - Placeholders de skeleton mientras isLoading

// Ejemplo de query key convention:
queryKeys.users.all()          // ['users']
queryKeys.users.detail(id)     // ['users', id]
queryKeys.users.list(filters)  // ['users', 'list', filters]
```

### 8.4 Axios interceptors (obligatorio)

```typescript
// interceptors configurados en lib/axios.ts:
// Request interceptor:
//   → Adjunta Authorization: Bearer {accessToken}
// Response interceptor:
//   → Si 401: intenta refresh token automáticamente
//   → Si refresh falla: logout y redirect a /login
//   → Si otro error: propaga al React Query error handler
```

### 8.5 Route protection

```typescript
// Tipos de rutas:
// <PublicRoute />  → redirige a /dashboard si ya autenticado
// <AuthRoute />    → redirige a /login si no autenticado
// <RoleRoute role="ADMIN" /> → redirige a /403 si sin permiso
```

---

## 9. UI DESIGN SYSTEM

### 9.1 Principios visuales

- **Dark-first**: background base `#0a0a0a`, superficies `#111111`, `#1a1a1a`
- **Tipografía**: sans-serif geométrico (definir en Tailwind config, ej: Geist o equivalente)
- **Bordes**: `border-white/8` (muy sutiles), `rounded-lg` por defecto
- **Sombras**: `shadow-black/40` — profundidad sin agresividad

### 9.2 Color tokens (CSS variables obligatorias)

```css
:root {
  /* Backgrounds */
  --bg-base:     #0a0a0a;
  --bg-surface:  #111111;
  --bg-elevated: #1a1a1a;
  --bg-overlay:  #222222;

  /* Texto */
  --text-primary:   rgba(255,255,255,0.95);
  --text-secondary: rgba(255,255,255,0.60);
  --text-tertiary:  rgba(255,255,255,0.35);
  --text-disabled:  rgba(255,255,255,0.20);

  /* Brand */
  --brand-primary: #6366f1;   /* indigo */
  --brand-hover:   #818cf8;
  --brand-muted:   rgba(99,102,241,0.15);

  /* Estados */
  --success: #22c55e;
  --warning: #f59e0b;
  --error:   #ef4444;
  --info:    #3b82f6;

  /* Bordes */
  --border-subtle:  rgba(255,255,255,0.06);
  --border-default: rgba(255,255,255,0.10);
  --border-strong:  rgba(255,255,255,0.20);
}
```

### 9.3 Componentes obligatorios del design system

Todos los componentes en `components/ui/`:

| Componente | Estados requeridos |
|-----------|-------------------|
| `Button` | default · hover · active · disabled · loading |
| `Input` | default · focus · error · disabled |
| `Select` | default · open · selected · disabled |
| `Modal` | open · close · con overlay |
| `Table` | loading (skeleton) · empty · populated · error |
| `Badge` | success · warning · error · info · neutral |
| `Toast` | success · error · warning · info · loading |
| `Skeleton` | pulse animation, tamaños variables |
| `EmptyState` | con ícono, título, descripción, CTA opcional |
| `ErrorState` | con mensaje, botón retry |
| `Avatar` | con imagen · sin imagen (initials) · loading |
| `Dropdown` | posicionamiento auto, keyboard navigation |
| `Tooltip` | delay 300ms, posiciones top/bottom/left/right |
| `Pagination` | primera/última, elipsis, current highlight |

### 9.4 Reglas de UI (NO NEGOCIABLES)

- **Nunca** usar colores fuera de los tokens CSS definidos
- **Nunca** mostrar una pantalla sin estado de carga (skeleton siempre)
- **Nunca** mostrar una lista vacía sin `EmptyState`
- **Nunca** un error sin feedback visual al usuario
- **Siempre** feedback en botones que disparan async (loading state)
- **Siempre** animación de entrada en modales y dropdowns (100–200ms)
- **Siempre** transiciones en hover/focus (150ms ease)
- Spacing: escala Tailwind (`4px` base), nunca valores arbitrarios sin razón
- Tamaños de texto: `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-xl+` solo en headings
- Z-index: modal `1000`, dropdown `500`, tooltip `400`, sidebar `300`

### 9.5 Layout del dashboard

```
┌──────────────────────────────────────────────┐
│ Sidebar (240px)  │   Header (64px)            │
│                  │──────────────────────────  │
│  Logo            │   PageTitle  |  Actions     │
│  ─────           │                            │
│  Nav items       │   Content Area              │
│  (con icons +    │   (flex col, padding 24px)  │
│   labels)        │                            │
│  ─────           │                            │
│  User section    │                            │
│  (bottom)        │                            │
└──────────────────┴────────────────────────────┘
```

- Sidebar colapsable (240px ↔ 64px) con animación
- Header sticky, `backdrop-blur` con `bg-base/80`
- Content con max-width `1280px` centrado
- Breadcrumb en páginas de detalle
- Responsive: mobile → sidebar como drawer overlay

---

## 10. SECURITY MODEL

### 10.1 Capas de seguridad

```
Internet
  → Cloudflare WAF (bloquea IPs maliciosas, SQL injection patterns, DDoS)
  → Cloudflare Rate Limit (edge layer)
  → Nginx (HTTPS only, headers de seguridad, upstream routing)
  → Express Rate Limit (Upstash Redis, por endpoint)
  → Auth Middleware (JWT verification)
  → Zod Validation (sanitización de input)
  → Prisma (queries parametrizadas, no raw SQL con input de usuario)
  → Supabase RLS (row-level, por userId)
```

### 10.2 Headers de seguridad (Nginx / Cloudflare)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 10.3 Reglas adicionales

- Contraseñas: mínimo 8 chars, bcrypt con salt rounds 12
- Emails: normalizar a lowercase antes de guardar
- Tokens de reset de contraseña: 1 hora de expiración, un solo uso
- Logs de audit en TODA acción de admin
- Secrets: NUNCA en código. Siempre en `.env` (local) o Cloudflare Secrets (prod)
- CORS: whitelist explícita de orígenes (no `*`)
- SQL injection: imposible vía Prisma (queries parametrizadas). Prohibido `$queryRaw` con input de usuario.

---

## 11. ENVIRONMENT VARIABLES

### Backend (apps/api/.env)

```env
# Servidor
NODE_ENV=development
PORT=4000
APP_URL=http://localhost:4000

# Supabase
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Upstash Redis (mismo valor dev y prod — serverless)
UPSTASH_REDIS_REST_URL=https://[region].upstash.io
UPSTASH_REDIS_REST_TOKEN=

# JWT (RS256)
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=bract-files
CLOUDFLARE_R2_PUBLIC_URL=https://files.bract.app

# Resend (email transaccional)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@bract.app

# Logging
LOG_LEVEL=debug
```

### Frontend (apps/web/.env)

```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_APP_NAME=Bract
VITE_APP_URL=http://localhost:5173
```

---

## 12. DEPLOYMENT ARCHITECTURE

### 12.1 Diagrama de producción

```
Cliente (Browser)
      ↓
Cloudflare CDN + WAF
  ├─ Static assets (Cloudflare Pages / CDN cache)
  └─ API requests
        ↓
Nginx (reverse proxy, TLS termination)
        ↓
K8s Cluster
  ├─ API Pod(s) [Express, réplicas según load]
  └─ Worker Pod(s) [BullMQ workers]
        ↓
Supabase Postgres   — base de datos principal
Upstash Redis       — cache, blacklist JWT, queues
Cloudflare R2       — object storage
Resend              — email transaccional
```

### 12.2 Desarrollo local (sin Docker)

No hay Docker Compose en desarrollo. Todo es serverless o cloud:

| Servicio | Dev | Prod |
|---------|-----|------|
| Base de datos | Supabase cloud (proyecto dev separado) | Supabase cloud (proyecto prod) |
| Cache / Queues | Upstash Redis (mismo — plan free suficiente) | Upstash Redis |
| Storage | Cloudflare R2 (bucket dev separado) | Cloudflare R2 (bucket prod) |
| Email | Resend (dominio de prueba, no envía real) | Resend (dominio verificado) |

Setup de desarrollo:
```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # rellenar con credenciales dev
cp apps/web/.env.example apps/web/.env
pnpm dev                                  # arranca api + web en paralelo
```

### 12.3 CI/CD (GitHub Actions)

**On PR:**
- Lint (ESLint + Prettier)
- Type check (tsc --noEmit)
- Unit tests
- Build check

**On merge to main:**
- Build Docker images
- Push a registry
- Deploy a K8s (rolling update)
- Health check post-deploy
- Notificación a Slack/Discord

---

## 13. PERFORMANCE RULES

| Métrica | Target |
|---------|--------|
| Initial bundle (JS) | < 150KB gzipped |
| API p50 (percentil 50) | < 100ms |
| API p99 (percentil 99) | < 500ms |
| Time to First Byte (TTFB) | < 200ms |
| Core Web Vitals (LCP) | < 2.5s |

**Reglas de implementación:**
- Lazy loading en todas las rutas (React.lazy + Suspense)
- Code splitting por feature
- Imágenes: WebP, lazy load, dimensiones explícitas
- Cache HTTP para GETs: `Cache-Control: private, max-age=30`
- Redis cache obligatorio para endpoints de analytics (TTL 5 min)
- Cloudflare cache para assets estáticos (TTL 30 días)
- No N+1 queries (revisar Prisma queries con logging habilitado en dev)

---

## 14. LOGGING Y OBSERVABILIDAD

### 14.1 Estructura de log (Winston)

```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "level": "info",
  "requestId": "req_abc123",
  "userId": "user_xyz",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "statusCode": 200,
  "duration": 45,
  "message": "Auth login success"
}
```

### 14.2 Niveles de log

| Level | Uso |
|-------|-----|
| `error` | Errores no manejados, fallos críticos |
| `warn` | Rate limit alcanzado, auth fallida repetida |
| `info` | Requests completados, jobs procesados |
| `debug` | Solo en development |

### 14.3 error.md

Este archivo en la raíz del repo es el log manual de decisiones y errores de arquitectura:

```markdown
# Error / Decision Log

## [YYYY-MM-DD] Título del problema
**Problema:** Descripción del problema encontrado
**Causa:** Por qué ocurrió
**Solución:** Qué se hizo
**Lección:** Qué aprendemos para no repetirlo
```

---

## 15. DEVELOPMENT PHASES (ORDEN ESTRICTO)

### Fase 1 — Infraestructura base
- [ ] Monorepo setup (pnpm workspaces)
- [ ] `packages/shared` con schemas Zod base
- [ ] Express server con middleware base (logger, error handler, cors, helmet)
- [ ] Prisma + conexión a Supabase Postgres verificada
- [ ] Upstash Redis client configurado y verificado
- [ ] Resend client configurado (email de prueba enviado)
- [ ] React + Vite + Tailwind + Router base
- [ ] Variables de entorno validadas con Zod al inicio
- [ ] `.env.example` completo para onboarding

### Fase 2 — Auth system
- [ ] Modelos Prisma: User, RefreshToken, Session
- [ ] Endpoints: register, login, logout, refresh, me
- [ ] JWT RS256 (generación de par de claves)
- [ ] Redis blacklist
- [ ] Frontend: login form, register form, auth store, axios interceptors
- [ ] Route guards (PublicRoute, AuthRoute)
- [ ] Verificación de email (job + token)

### Fase 3 — User system y profile
- [ ] CRUD de usuarios (admin)
- [ ] Perfil propio (ver + editar)
- [ ] Cambio de contraseña
- [ ] Upload de avatar (R2 signed URL flow)
- [ ] Gestión de roles

### Fase 4 — Core dashboard
- [ ] Shell de dashboard (sidebar + header)
- [ ] Página home con widgets de estadísticas
- [ ] Design system base completo (todos los componentes UI)
- [ ] Tabla de usuarios con filtros, búsqueda y paginación

### Fase 5 — Notificaciones
- [ ] Modelo Notification + endpoints
- [ ] BullMQ worker: notification.worker
- [ ] Centro de notificaciones en UI (dropdown + página)
- [ ] Marcar como leído / leer todas

### Fase 6 — Analytics
- [ ] Endpoints de analytics (overview, users, activity)
- [ ] Gráficos con Recharts
- [ ] Cache Redis para datos de analytics

### Fase 7 — Admin panel
- [ ] Panel de usuarios admin (ver, cambiar rol, suspender)
- [ ] Audit log viewer
- [ ] Stats generales del sistema

### Fase 8 — Polish y producción
- [ ] i18n setup (español + inglés base)
- [ ] Error boundaries en cada feature
- [ ] Audit de performance (bundle size, N+1, cache)
- [ ] Security audit (headers, CORS, rate limits)
- [ ] CI/CD configurado
- [ ] Documentación de API (OpenAPI / Swagger)
- [ ] README actualizado

---

## 16. REGLA FINAL

> **Si algo no está definido en este documento, NO se implementa sin aprobación explícita y actualización previa de este archivo.**
>
> Cualquier desviación de la arquitectura aquí definida debe ser documentada en `error.md` con justificación técnica.
