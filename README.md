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
| @anthropic-ai/sdk | latest | Núcleo de IA (Agente B): Claude para planner/flashcards/chat. Proveedor detrás de `AI_API_KEY` (§11). Única librería fuera del stack original — ver `error.md`. |

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

### 3.3 Modelos de producto — Estudio con IA (Subject · Topic · Plan · Flashcard · Chat)

> **Estado:** features APROBADAS (planificador, flashcards, chat) según `context.md` y
> `PLAN_AGENTES.md`. Esta sección resuelve el gate del §0.10/§16: la spec existe, por lo tanto
> se implementan. Definidas por el **Agente A** (modelo de datos compartido).
>
> **Principio rector:** `materias → temas → progreso` son **una sola fuente de verdad**. Las
> flashcards cuelgan de `Topic`; los items del plan referencian `Topic`; el chat lee el mismo árbol.
> Completar un tema (`Topic.status`) impacta plan + SRS + contexto del chat (efectos cruzados a cargo
> del Agente F).

```prisma
// ==========================================
// ESTUDIO — Materias y Temas (contexto compartido)
// ==========================================

model Subject {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  examDate  DateTime?
  color     String?   // token de color (hex), validado por Zod contra paleta permitida
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  topics    Topic[]

  @@index([userId])
  @@index([userId, examDate])   // orden por urgencia (examen más cercano)
  @@map("subjects")
}

model Topic {
  id          String          @id @default(cuid())
  subjectId   String
  subject     Subject         @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  // DECISIÓN: userId denormalizado (inmutable) → queries "todos los temas del usuario"
  // (chat-context, planner) y ownership directo sin join. Ver error.md.
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?         // contexto opcional → mejores flashcards/explicaciones de la IA
  status      TopicStatus     @default(PENDING)
  difficulty  TopicDifficulty @default(MEDIUM)   // sesga el ease inicial de sus flashcards
  completedAt DateTime?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  flashcards  Flashcard[]
  planItems   StudyPlanItem[]

  @@index([subjectId])
  @@index([userId, status])
  @@map("topics")
}

enum TopicStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
}

enum TopicDifficulty {
  EASY
  MEDIUM
  HARD
}

// ==========================================
// ESTUDIO — Disponibilidad y Plan
// ==========================================

model StudyAvailability {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  weekday   Int      // 0=Domingo ... 6=Sábado
  minutes   Int      // minutos disponibles ese día (UI muestra horas; se guarda en minutos)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, weekday])   // una config por día
  @@index([userId])
  @@map("study_availability")
}

model StudyPlan {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  status      StudyPlanStatus @default(ACTIVE)   // regenerar archiva el anterior
  generatedAt DateTime        @default(now())
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  items       StudyPlanItem[]

  @@index([userId])
  @@index([userId, status])
  @@map("study_plans")
}

enum StudyPlanStatus {
  ACTIVE
  ARCHIVED
}

model StudyPlanItem {
  id               String              @id @default(cuid())
  planId           String
  plan             StudyPlan           @relation(fields: [planId], references: [id], onDelete: Cascade)
  topicId          String
  topic            Topic               @relation(fields: [topicId], references: [id], onDelete: Cascade)
  date             DateTime            // día asignado
  order            Int?                // orden del bloque dentro del mismo día
  estimatedMinutes Int
  status           StudyPlanItemStatus @default(PENDING)  // bloque del día (≠ Topic.status global)
  completedAt      DateTime?
  createdAt        DateTime            @default(now())

  @@index([planId])
  @@index([topicId])
  @@index([planId, date])   // render día por día
  @@map("study_plan_items")
}

enum StudyPlanItemStatus {
  PENDING
  COMPLETED
  SKIPPED
}

// ==========================================
// FLASHCARDS + SRS (SM-2 simplificado)
// ==========================================

model Flashcard {
  id             String          @id @default(cuid())
  topicId        String
  topic          Topic           @relation(fields: [topicId], references: [id], onDelete: Cascade)
  userId         String          // denormalizado (inmutable) → índice [userId, dueDate] para "due"
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  question       String
  answer         String
  source         FlashcardSource @default(MANUAL)
  // Estado SRS
  ease           Float           @default(2.5)
  intervalDays   Int             @default(0)
  reps           Int             @default(0)   // repasos exitosos consecutivos (1º→1d, 2º→6d, ...)
  dueDate        DateTime        @default(now())
  lastReviewedAt DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([topicId])
  @@index([userId, dueDate])   // hot-path: cartas due del usuario
  @@map("flashcards")
}

enum FlashcardSource {
  AI
  MANUAL
}

// ==========================================
// CHAT DE ESTUDIO
// ==========================================

model ChatSession {
  id        String        @id @default(cuid())
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String?       // derivado del 1er mensaje (editable)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  messages  ChatMessage[]

  @@index([userId])
  @@index([userId, updatedAt])   // lista de sesiones recientes
  @@map("chat_sessions")
}

model ChatMessage {
  id        String      @id @default(cuid())
  sessionId String
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      ChatRole
  content   String
  createdAt DateTime    @default(now())

  @@index([sessionId, createdAt])   // hilo ordenado por sesión
  @@map("chat_messages")
}

enum ChatRole {
  USER
  ASSISTANT
  SYSTEM    // el system-prompt en vivo lo arma el Agente B; SYSTEM permite persistirlo si hace falta
}
```

**Back-relations en `User`** (solo relaciones, sin columnas nuevas):
```prisma
  subjects          Subject[]
  topics            Topic[]
  flashcards        Flashcard[]
  studyAvailability StudyAvailability[]
  studyPlans        StudyPlan[]
  chatSessions      ChatSession[]
```

### 3.4 Reglas del modelo de producto

- **Ownership en árbol, raíz `User`, todo `onDelete: Cascade`:** Subject→User; Topic→Subject + Topic→User;
  Flashcard→Topic + Flashcard→User; StudyAvailability→User; StudyPlan→User; StudyPlanItem→Plan +
  StudyPlanItem→Topic; ChatSession→User; ChatMessage→Session. (Postgres soporta múltiples paths de cascade.)
- **DECISIÓN — `userId` denormalizado en `Topic` y `Flashcard`:** el owner de un tema/carta es inmutable.
  Habilita `@@index([userId, status])` (temas del usuario) y `@@index([userId, dueDate])` (hot-path SRS:
  cartas due del usuario) sin joins. Documentado en `error.md`.
- **Índices obligatorios (además de los del §3.2):** todo modelo por-usuario indexa `userId`; SRS indexa
  `[userId, dueDate]`; plan indexa `[planId, date]`; chat indexa `[sessionId, createdAt]` y `[userId, updatedAt]`.
- **`userId` denormalizado en las 6 raíces consultadas por usuario** (Subject, Topic, StudyAvailability,
  StudyPlan, Flashcard, ChatSession). `StudyPlanItem` y `ChatMessage` son tablas-hijo puras: se acceden
  siempre vía su padre (`planId` / `sessionId`), por lo que se scopean por ese FK y **no** llevan `userId`
  propio (evita redundancia, back-relations extra en `User` y paths de cascade adicionales sin query que
  lo justifique). El `userId` se setea al crear y **nunca** se transfiere pertenencia.
- **Verificación de pertenencia de tablas-hijo:** los Agentes **C** (`StudyPlanItem` vía `planId`→`StudyPlan.userId`)
  y **E** (`ChatMessage` vía `sessionId`→`ChatSession.userId`) validan ownership en sus repos/services a
  través del padre — nunca confían en un `userId` propio (no existe en esas tablas).
- **Unidad de tiempo:** todo en **minutos** (`StudyAvailability.minutes`, `StudyPlanItem.estimatedMinutes`).
  La UI muestra horas; la conversión es de presentación.
- **`Topic.status` (global) ≠ `StudyPlanItem.status` (bloque del día):** el primero es el dominio del temario;
  el segundo, el cumplimiento del cronograma. Los efectos cruzados (completar tema → recalcular plan,
  ajustar SRS, refrescar contexto del chat) son responsabilidad del **Agente F**.
- **`@@map` snake_case** en todas las tablas, consistente con el resto del schema.
- **Contratos de IA** (salida JSON de generar plan / generar flashcards): los define y valida con Zod el
  **Agente B** (Apéndice C de `PLAN_AGENTES.md`), no esta sección.

### 3.5 Evaluación (quiz) — Agente I

> **Estado:** feature de `IDEAS_POST_MVP.md` ("Agente I — Modo Práctica / Evaluación"), encargada
> spec-first. **Primer pase = núcleo del quiz.** Genera un quiz de opción múltiple para un **tema** o una
> **materia** con la IA (reusa `lib/ai`); cada pregunta trae su respuesta correcta y la **explicación por
> opción** en la MISMA llamada de generación (sin 2da llamada a la IA al corregir).
>
> **Corrección POR PREGUNTA, en el servidor, con anti-trampa real.** Generar **crea el intento en progreso**
> y persiste las preguntas con su `correctIndex` + explicaciones (autoritativos, en el server); al cliente
> solo viajan las preguntas **públicas** (sin la respuesta correcta ni la explicación). El estudiante
> responde de a una pregunta (`POST .../answers`): el server corrige contra el `correctIndex` guardado,
> **bloquea re-responder** (lock anti-trampa) y recién ahí revela la correcta + explicaciones de esa
> pregunta. Así no se puede espiar la respuesta antes de elegir ni inflar el puntaje desde el cliente.
>
> **FUERA DE ALCANCE (follow-up I-2):** dashboard de progreso agregado y detección de puntos débiles.
> Este pase solo deja los datos persistidos (`QuizAttemptItem.topicId` + `isCorrect` + índices por
> usuario/tema) para habilitarlo. La capa de subconceptos por `Topic` (cobertura "sin huecos" formal) es
> follow-up: acá la cobertura la guía el prompt.

```prisma
// ==========================================
// EVALUACIÓN — Quiz (Agente I)
// ==========================================

model QuizAttempt {
  id           String            @id @default(cuid())
  userId       String
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  scope        QuizScope // TOPIC | SUBJECT | MULTI_TOPIC — DERIVADO por el server desde el set de topicIds
  status       QuizAttemptStatus @default(IN_PROGRESS) // se completa al responder la última pregunta
  // DECISIÓN: FK a Subject/Topic con onDelete: SetNull (refs de agrupación viva, NO ownership —
  // eso es userId). Borrar un tema/materia NO borra tu historial de evaluación; scopeName lo
  // mantiene legible y el puntaje es un hecho histórico inmutable. Ver error.md.
  subjectId    String? // la materia contenedora (siempre presente: multi-tema es dentro de una materia)
  subject      Subject?          @relation(fields: [subjectId], references: [id], onDelete: SetNull)
  topicId      String? // SOLO en scope TOPIC; null en SUBJECT y MULTI_TOPIC (la granularidad fina vive en el item)
  topic        Topic?            @relation(fields: [topicId], references: [id], onDelete: SetNull)
  scopeName    String // snapshot del NOMBRE PROPIO (topic.name en TOPIC; subject.name en SUBJECT/MULTI_TOPIC). El front compone "N temas de X" bilingüe con scope+topicCount
  topicCount   Int               @default(1) // nº de temas elegidos (1=TOPIC, N=MULTI_TOPIC, todos=SUBJECT). Permite renderizar el historial sin traer items
  totalCount   Int // nº de preguntas
  correctCount Int // puntaje (se recalcula en el server con cada respuesta)
  completedAt  DateTime?
  createdAt    DateTime          @default(now())

  items QuizAttemptItem[]

  @@index([userId])
  @@index([userId, createdAt]) // historial reciente del usuario
  @@map("quiz_attempts")
}

model QuizAttemptItem {
  id            String      @id @default(cuid())
  attemptId     String
  attempt       QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  // DECISIÓN: userId denormalizado (§3.4) → índice [userId, topicId] para "puntos débiles" (I-2)
  // sin join. Mismo patrón que Topic/Flashcard. Ver error.md.
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  topicId       String? // subconcepto evaluado (granularidad I-2)
  topic         Topic?      @relation(fields: [topicId], references: [id], onDelete: SetNull)
  order         Int // posición de la pregunta
  question      String // snapshot
  options       Json // snapshot [{ text, explanation }] AUTORITATIVO (la explicación nunca viaja al cliente antes de responder)
  correctIndex  Int // AUTORITATIVO en el server; nunca se envía antes de responder
  selectedIndex Int? // null = sin responder (lock anti-trampa: no se re-responde)
  isCorrect     Boolean     @default(false) // lo decide el server al comparar contra correctIndex
  createdAt     DateTime    @default(now())

  @@index([attemptId])
  @@index([attemptId, order]) // buscar la pregunta a responder
  @@index([userId, topicId]) // I-2: % de acierto por tema, sin join
  @@index([userId, topicId, isCorrect])
  @@map("quiz_attempt_items")
}

enum QuizScope {
  TOPIC // un solo tema
  SUBJECT // todos los temas de la materia
  MULTI_TOPIC // un subconjunto (>1, <todos)
}

enum QuizAttemptStatus {
  IN_PROGRESS
  COMPLETED
}
```

**Back-relations** (solo relaciones, sin columnas nuevas):
- `User`: `quizAttempts QuizAttempt[]` · `quizAttemptItems QuizAttemptItem[]`
- `Subject`: `quizAttempts QuizAttempt[]`
- `Topic`: `quizAttempts QuizAttempt[]` · `quizAttemptItems QuizAttemptItem[]`

**Reglas (además de §3.4):**
- **Ownership por `userId`** en `QuizAttempt` y `QuizAttemptItem` (denormalizado en el item). Las FK a
  `Subject`/`Topic` son de agrupación/labels, no de ownership → `onDelete: SetNull` preserva el historial.
- **Cada item lleva `topicId`** aunque el quiz sea por materia (cada pregunta cae en un subconcepto/tema)
  → granularidad correcta para I-2 en los tres scopes.
- **Contrato unificado + scope DERIVADO por el server** (`POST /quiz/attempts`): el cliente manda un
  **set de temas** `{ subjectId, topicIds[], count? }` (`topicIds` 1..20) dentro de **una sola materia**;
  el server valida ownership/pertenencia de cada tema y **deriva** el `scope`: `topicIds.length === 1`
  → `TOPIC` (`topicId`=ese tema, `scopeName`=topic.name); `topicIds` cubre **todos** los temas de la
  materia → `SUBJECT` (`topicId=null`, `scopeName`=subject.name); subconjunto → `MULTI_TOPIC`
  (`topicId=null`, `scopeName`=subject.name). Borde: materia de 1 tema → `TOPIC`. Persiste `topicCount`.
  La IA recibe el subset en **una sola llamada**. El **front compone** la etiqueta bilingüe
  (`"N temas de X"` / `"N topics from X"`) con `scope`+`topicCount`+`scopeName` (i18n, plurales).
- **Generar crea el intento IN_PROGRESS** (`POST /quiz/attempts`): se llama a la IA primero; si falla,
  `AI_UNAVAILABLE` 503 y **no se persiste nada**. Si ok, se crean el `QuizAttempt` + sus `QuizAttemptItem`
  con `correctIndex`/`options` (explicaciones) **autoritativos** en el server, `selectedIndex=null`,
  `isCorrect=false`.
- **Anti-trampa (server-side):** las preguntas que viajan al cliente son **públicas** (sin `correctIndex`
  ni `explanation`). Responder (`POST /quiz/attempts/:id/answers`) corrige contra el `correctIndex`
  guardado, **rechaza re-responder** un item que ya tiene `selectedIndex` (lock), recalcula `correctCount`
  y, al responder la última, marca `status=COMPLETED` + `completedAt`. La reveal (correcta + explicaciones)
  se devuelve **solo de esa pregunta**. Un `selectedIndex` tramposo no infla el puntaje (se compara contra
  el valor guardado, no contra lo que diga el cliente).
- **Crédito parcial (Calidad de aprendizaje):** una abierta `PARTIAL` vale **0.5** (entre acierto y fallo),
  no un fallo total. El puntaje del resultado/historial es **fraccionario** (`correctCount + 0.5×partialCount`,
  p. ej. `8.5/N`), **derivado de los `grade` ya guardados**. `partialCount` es un campo **derivado en lectura**
  del contrato `QuizAttempt` (no es columna → sin `db push`): se calcula con un `groupBy` por intento en el
  listado y contando en memoria en el detalle. El `isCorrect` booleano queda intacto para el lock/anti-trampa.
- **Anti-trampa al REANUDAR (`GET /quiz/attempts/:id`):** el detalle es la fuente de verdad para retomar
  un intento, así que devuelve cada item **según esté contestado**: contestado (`selectedIndex !== null`)
  → completo (`options` con `explanation`, `correctIndex`, `selectedIndex`, `isCorrect`); SIN contestar
  → **público** (`options` solo `{ text }`, `correctIndex=null`, `isCorrect=false`, sin `explanation`).
  Un intento `COMPLETED` tiene todos los items contestados → todos completos (sin cambio visible). El tipo
  compartido del item de detalle refleja esto: `correctIndex: number | null` y `option.explanation`
  opcional. El runner del front se hidrata desde este detalle (reanuda en la primera sin responder).
- **Contrato de IA** (salida JSON del quiz con explicación por opción): lo define y valida con Zod la capa
  `lib/ai` (Agente B/Gemini), igual que plan/flashcards/extracción de temas.

---

### 3.6 Progreso, puntos débiles y personalización — I-2

> **Estado:** follow-up de §3.5 (`IDEAS_POST_MVP.md` "Agente I-2"), encargada **spec-first**, post-MVP.
> Convierte los datos ya persistidos (quiz + SRS) en una señal de **debilidad por tema** y la usa para
> (1) un **dashboard de Progreso**, (2) **priorizar** el plan del día y (3) **enriquecer** el contexto del
> chat. Más una capa transversal de **personalización**.
>
> **Se construye en 3 capas; la 2 y la 3 dependen de la 1 y son ADITIVAS sobre features deployadas:**
> - **Capa 1 — Motor + Dashboard (base).** Service de progreso/debilidad (reusable) + sección `/progress`.
>   Solo lectura, `[self]`, capas estrictas, **sin N+1** (agrega en Prisma con `groupBy`, no trae todo a
>   memoria — reusa los índices `@@index([userId, topicId])` / `[userId, topicId, isCorrect]` de §3.5 y
>   `@@index([userId, dueDate])` de las flashcards).
> - **Capa 2 — Feedback al Planner (aditivo).** El plan del día adelanta temas débiles. **Sin datos de
>   progreso, el planner se comporta EXACTAMENTE como hoy** (degrada sin romper).
> - **Capa 3 — Feedback al Chat (aditivo).** El contexto del tutor incluye los puntos débiles. **Sin datos,
>   el contexto es idéntico a hoy.** No toca el streaming ni el contrato del chat.
>
> **Almacenamiento (DECISIÓN):** el **progreso se calcula on-the-fly** vía `groupBy` indexado — **sin tabla
> de caché** (los índices de §3.5 existen justo para esto; evita invalidación). Lo único que requiere
> `db push` es el modelo de **preferencias**. Una tabla materializada `TopicProgress` queda como follow-up
> si el `groupBy` escalara mal.

```prisma
// ==========================================
// PROGRESO & PERSONALIZACIÓN (I-2)
// Único modelo nuevo: preferencias. El progreso/debilidad es DERIVADO (on-the-fly), no se persiste.
// ==========================================

model UserStudyPreferences {
  id                   String               @id @default(cuid())
  userId               String               @unique
  user                 User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Intensidad de remediación: escala cuánto pesa la debilidad en el plan (ver "Blend del planner").
  remediationIntensity RemediationIntensity @default(LOW)
  // Materias a priorizar: el planner las adelanta un poco (término PROPIO, separado de la debilidad —
  // NO multiplica el weakness). [] = sin preferencia de prioridad.
  prioritySubjectIds   String[]             @default([])
  // Override opcional de los pesos de la fórmula (null = defaults wQuiz=0.6 / wSrs=0.4).
  weightQuiz           Float?
  weightSrs            Float?
  // Meta informativa (objetivo de estudio); el dashboard la usa para contexto. Extensible.
  dailyGoalMinutes     Int?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@map("user_study_preferences")
}

enum RemediationIntensity {
  OFF    // α=0: la debilidad NO influye el plan (idéntico a hoy aunque haya datos)
  LOW    // α≈0.33: desempate suave (DEFAULT — conservador sobre una feature deployada)
  MEDIUM // α≈0.66
  HIGH   // α=1.0: blend máximo urgencia+debilidad (el examen nunca se ignora del todo)
}
```

**Back-relation** (solo relación, sin columnas nuevas):
- `User`: `studyPreferences UserStudyPreferences?`

**Fórmula de debilidad (por tema, derivada y OBJETIVA — `weakness ∈ [0,1]`, 1 = más débil). SOLO quiz + SRS;
la preferencia de prioridad NO la altera (se documenta aparte, en el blend del planner):**

```
// Señal QUIZ — solo ítems contestados (selectedIndex != null); saltar ≠ fallar.
answered      = count(QuizAttemptItem WHERE userId, topicId, contestado)   // MCQ con selectedIndex U OPEN con studentAnswer
correct       = count(... AND isCorrect = true) + 0.5 × count(... AND grade = PARTIAL)   // crédito parcial: una abierta PARTIAL vale medio acierto (no fallo total)
quizWeak      = answered > 0 ? 1 - correct/answered : AUSENTE
lowConfidence = answered < MIN_ANSWERS            // p.ej. 3 → el dashboard lo marca tenue

// Señal SRS — estado real de las flashcards del tema (§3.3).
avgEase       = _avg(Flashcard.ease)              // ease bajo ⇒ débil
easeGap       = clamp01((2.5 - avgEase) / (2.5 - 1.3))   // 1.3 = piso de ease del SM-2
overdueRatio  = totalCards > 0 ? dueCards / totalCards : 0   // dueDate <= now
srsWeak       = totalCards > 0 ? clamp01(0.6*easeGap + 0.4*overdueRatio) : AUSENTE

// Combinación — ignora la señal AUSENTE; ambas ausentes ⇒ el tema se OMITE (sin datos ≠ débil → EmptyState).
weakness      = weightedAvg({ quizWeak: wQuiz, srsWeak: wSrs })   // defaults 0.6 / 0.4, override por prefs
// weakness es 100% OBJETIVO: SOLO quiz + SRS. La preferencia (prioritySubjectIds) NO lo toca — el dashboard
// muestra siempre el weakness REAL (nunca inflado). La prioridad es un término aparte y solo del planner (abajo).
// Caso límite: si AMBOS pesos son 0 (override explícito), se cae a los defaults (0.6/0.4) — nunca 0/0.
```

**Blend del planner (capa 2 — modelo de "nudge en días", DEGRADA EXACTO). DOS términos SEPARADOS y ADITIVOS:
DEBILIDAD (objetiva, modulada por α) y PRIORIDAD (preferencia, nudge FIJO independiente de α). Ninguno
multiplica al otro; ambos topeados:**

```
α  = map(remediationIntensity)  → OFF:0 · LOW:0.33 · MEDIUM:0.66 · HIGH:1.0   (modula SOLO la debilidad)
D  = NUDGE_MAX_DAYS             // tope del adelanto por DEBILIDAD para temas CON examen (p.ej. 7 días)
Wd = NUDGE_DIFFICULTY_WEIGHT   // cuánto mueve la DEBILIDAD dentro del grupo SIN examen (p.ej. 1.5)
P  = PRIORITY_NUDGE_DAYS       // adelanto FIJO por PRIORIDAD para temas CON examen (p.ej. 3 días, < D) — sin α
Wp = PRIORITY_NOEXAM_WEIGHT    // cuánto mueve la PRIORIDAD dentro del grupo SIN examen (p.ej. 1.0) — sin α

// `examDays(t)` = días hasta el examen de la materia del tema (igual que hoy; sin examen ⇒ +∞).
// `prio(t)`     = 1 si la materia del tema ∈ prioritySubjectIds, si no 0  (factor SEPARADO de weakness).
// — Temas CON examen: dos nudges en días ACUMULATIVOS y topeados (menor ⇒ antes). La debilidad se modula por α;
//   la prioridad es un nudge FIJO (vale aunque α=0, p.ej. en OFF), porque es una elección explícita del usuario:
effectiveDays(t) = examDays(t) - α · D · weakness(t) - P · prio(t)
// — Temas SIN examen (examDays=+∞): el nudge en días no aplica; se ordenan dentro de su grupo por un score que
//   mezcla la dificultad de HOY con la debilidad (modulada por α) y la prioridad (peso FIJO, sin α):
noExamScore(t)   = difficultyRank(t) + α · Wd · weakness(t) + Wp · prio(t)

// Orden del baseline (ai.service.buildBaselinePlan):
//   1) effectiveDays ASC  → los temas CON examen van siempre antes que los SIN examen (+∞)
//   2) dentro de SIN examen: noExamScore DESC   (hoy = difficultyRank DESC)
//   3) desempate final: dificultad DESC (igual que hoy)
```

Invariantes del blend (los que vas a revisar con lupa):
- **Sin datos de debilidad Y sin materias prioritarias** ⇒ `weakness(t)=0` y `prio(t)=0 ∀t` ⇒
  `effectiveDays = examDays` y `noExamScore = difficultyRank` ⇒ **orden idéntico a hoy, con cualquier α**
  (este es el caso del golden test: weaknessMap vacío + `prioritySubjectIds=[]`).
- **`OFF` (α=0)** ⇒ **se anula SOLO el nudge de debilidad**; la **prioridad explícita SIGUE aplicando** (nudge
  FIJO `P`/`Wp`, independiente de α). α (`remediationIntensity`) controla **solo** la debilidad — la prioridad es
  una elección explícita del usuario y vale aunque esté en `OFF`. (DECISIÓN — ver nota debajo.)
- **Sin materias prioritarias** (`prioritySubjectIds=[]`) ⇒ `prio(t)=0 ∀t` ⇒ el término de prioridad no aporta
  (solo puede mover el de debilidad, si hay datos y α>0).
- **Debilidad y prioridad son SEPARADAS y ADITIVAS:** un tema flojo NO prioritario y un tema prioritario NO flojo
  reciben cada uno su propio nudge; nunca se multiplican. El `weakness` que muestra el dashboard jamás se infla.
- **El examen nunca se ignora del todo:** el adelanto total está topado en `α·D + P ≤ D + P` días → un examen
  mucho más cercano siempre gana, incluso en `HIGH`. La prioridad SOLA adelanta a lo sumo `P` (p.ej. 3) días.
- **Intensidad baja** ⇒ nudge de debilidad chico ⇒ la debilidad solo reordena casi-empates (≈ desempate).
- **Intensidad alta** ⇒ blend ponderado: un tema flojo con examen algo más lejano puede adelantarse.
- **Temas SIN examen (`examDays=+∞`):** el nudge en días no los mueve. Dentro de ese grupo se ordena por
  `noExamScore DESC` (debilidad modulada por α + prioridad con peso fijo, como criterios secundarios sobre la
  dificultad de hoy): sin datos de debilidad **y** sin prioridad `noExamScore = difficultyRank` ⇒ **idéntico a
  hoy**; una materia prioritaria sube por `Wp` aunque α=0. Igual van siempre **después** de los temas con
  examen (paso 1).

> **DECISIÓN (prioridad INDEPENDIENTE de α):** el término de prioridad NO se multiplica por α — una materia
> elegida recibe un nudge fijo y acotado (`P` con examen, `Wp` sin examen) **siempre**, también en `OFF`. Motivo:
> `remediationIntensity` controla SOLO el nudge de debilidad; la prioridad es una elección explícita del usuario
> y debe valer aunque la remediación esté apagada. Por eso el invariante "idéntico a hoy" requiere **dos**
> condiciones (sin datos de debilidad **y** sin materias prioritarias), no solo `OFF`. Alternativa descartada:
> gatear la prioridad con α (entonces `OFF` apagaría también la prioridad) — se prefirió respetar la elección
> explícita del usuario por sobre un único interruptor maestro.

> El mismo `weakness` se inyecta como **hint** al prompt de la IA del plan (`buildPlanUserPrompt`), aditivo:
> mapa vacío ⇒ prompt sin cambios. La IA sigue validándose/clampeándose con Zod + `validateAndClampPlan`.

**Enriquecimiento del chat (capa 3 — aditivo):**
- `StudentContext` (de `lib/ai/ai.context.ts`) suma un campo **opcional** `weakTopics?: { name, weakness }[]`
  (top N). `renderContextForPrompt` agrega un bloque "Temas flojos: …" **solo si hay datos**.
- Sin datos ⇒ **ningún bloque nuevo** ⇒ system prompt byte-idéntico a hoy. `buildChatSystemPrompt`, el
  historial, el SSE y el manejo de disconnect **no cambian**.

**Degradación (qué falla y cómo cae):**

| Falla | Comportamiento |
| --- | --- |
| Sin quizzes ni SRS de un tema | el tema se omite (no es "débil", es "sin datos") → `/progress` muestra `EmptyState` |
| Sin preferencias del usuario | se usan defaults (`LOW`, pesos 0.6/0.4, sin materias priorizadas) — nunca bloquea |
| El motor de progreso lanza error (capa 2/3) | `try/catch` ⇒ debilidad vacía ⇒ planner y chat **se comportan como hoy** (nunca tumban una feature deployada) |
| IA falla | igual que hoy (plan → baseline determinista; chat → `AI_UNAVAILABLE` 503) — I-2 no lo toca |

**Reglas (además de §3.4):**
- **`UserStudyPreferences` es 1:1 con `User`** (`@@unique(userId)`), upsert con defaults; ownership por `userId`.
- **El motor de progreso es read-only y reusable:** un único service expone `getOverview`, `getWeakTopics`
  y `getWeaknessMap(userId)`; planner y chat consumen `getWeaknessMap` (no reimplementan la fórmula).
- **La prioridad (`prioritySubjectIds`) es un factor del PLANNER, no del motor de debilidad:** el planner la
  lee de las preferencias y la aplica como término aparte, con **nudge fijo independiente de α** (vale en `OFF`);
  `getWeaknessMap`/`getWeakTopics`/el dashboard devuelven `weakness` OBJETIVO (solo quiz + SRS, sin prioridad).
- **Sin N+1:** el repo agrega con `groupBy` (quiz por `topicId`/`isCorrect`; flashcards por `topicId` con
  `_avg.ease` + counts) — nunca itera trayendo todo a memoria.
- **La fórmula de debilidad es un objeto de config OBJETIVO** (`wQuiz`, `wSrs`, `MIN_ANSWERS`) — NO incluye
  prioridad. Los parámetros del blend del planner (`α`, `D`, `Wd`, `P`, `Wp`) viven en `ai.service` → sumar
  más ajustes de personalización no cambia las firmas.

---

### 3.7 Gamificación — XP, niveles, misiones, racha y jefe del día (Agente J)

> **Estado:** feature de `IDEAS_POST_MVP.md` ("Agente J — Progresión gamificada"), encargada
> **spec-first**, post-MVP. Convierte el estudio en una experiencia tipo juego que **se siente y se ve**
> como un juego (estética vibrante sobre los tokens oscuros de `§9.2` + identidad codex.io), **premiando
> aprender de verdad (dominio/retención), NUNCA actividad vacía ni métricas de vanidad**.
>
> **Principio rector:** la gamificación es una **capa de lectura + efectos de dominio cruzado** sobre los
> eventos que YA existen (quiz, flashcards/SRS, planner, progreso I-2). No reinventa nada: se engancha
> detrás del service dueño de cada dato (patrón Agente F: `plannerService` delega en
> `flashcardService.onTopicStatusChanged`), **siempre detrás de `try/catch`** → si la gamificación falla,
> la feature deployada se comporta **idéntico a hoy** (nunca tumba quiz/flashcards/planner).
>
> **v1 ACOTADO:** XP + niveles + misiones diarias + racha perdonadora + jefe del día + **home gamificada**
> (se rediseña la Home de `§8.10`, no una sección nueva). **100% determinista (sin IA)** → barato y
> free-tier-safe. **Fuera del v1:** logros/insignias, ligas, avatar evolutivo, misiones adaptadas a
> metas/horarios, sección `/arena` dedicada, ledger/historial de XP.
>
> **Anti-trampa:** el cliente NUNCA puede "darse" XP. El único endpoint de gamificación es de **lectura**
> (`GET /gamification/summary`); el XP/quests/jefe/racha se mutan **server-side por efecto** de acciones
> reales (responder quiz, repasar carta due, completar item del plan), no por un POST del cliente.

```prisma
// ==========================================
// GAMIFICACIÓN (Agente J)
// El `level` NO es columna: es función pura de totalXp (levelForXp, patrón srs.ts/progress.formula.ts).
// Sin tabla-ledger de XP en v1: el tope diario se enforce con xpEarnedToday/xpTodayDate en el perfil.
// ==========================================

model GamificationProfile {            // 1:1 con User — el "jugador"
  id            String    @id @default(cuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  totalXp       Int       @default(0)   // autoritativo (agregado); level = levelForXp(totalXp)
  currentStreak Int       @default(0)
  longestStreak Int       @default(0)
  lastStudyDate DateTime?               // día (UTC) de la última acción que cuenta para la racha
  freezeTokens  Int       @default(0)   // escudos de gracia (racha perdonadora)
  xpEarnedToday Int       @default(0)   // tope diario anti-farmeo de XP "por acción"
  xpTodayDate   DateTime?               // día al que corresponde xpEarnedToday (se resetea al cambiar)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("gamification_profiles")
}

model DailyQuest {                      // misiones diarias generadas desde acciones reales
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime    @db.Date      // día de la misión (sin hora)
  type        QuestType
  target      Int
  progress    Int         @default(0)
  status      QuestStatus @default(ACTIVE)
  xpReward    Int
  completedAt DateTime?
  createdAt   DateTime    @default(now())

  @@unique([userId, date, type])        // un set por día, idempotente (regenerar no duplica)
  @@index([userId, date])
  @@map("daily_quests")
}

model DailyBoss {                       // jefe del día = tema más flojo (I-2)
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime   @db.Date
  // FK de agrupación, NO ownership (patrón QuizAttempt §3.5) → SetNull preserva el historial del jefe.
  topicId     String?
  topic       Topic?     @relation(fields: [topicId], references: [id], onDelete: SetNull)
  topicName   String                    // snapshot legible (sobrevive al borrado del tema)
  subjectName String                    // snapshot legible
  maxHp       Int                       // "vida" = nº de interacciones de dominio sobre el tema-jefe
  hp          Int                       // restante (llega a 0 = vencido)
  status      BossStatus @default(ACTIVE)
  xpReward    Int
  defeatedAt  DateTime?
  createdAt   DateTime   @default(now())

  @@unique([userId, date])
  @@index([userId, date])
  @@map("daily_bosses")
}

enum QuestType {
  COMPLETE_QUIZ
  REVIEW_DUE_CARDS
  COMPLETE_PLAN_ITEMS
  DEFEAT_BOSS
}

enum QuestStatus {
  ACTIVE
  COMPLETED
}

enum BossStatus {
  ACTIVE
  DEFEATED
}
```

**Back-relations** (solo relaciones, sin columnas nuevas):
- `User`: `gamificationProfile GamificationProfile?` · `dailyQuests DailyQuest[]` · `dailyBosses DailyBoss[]`
- `Topic`: `dailyBosses DailyBoss[]`

**Economía de XP (solo aprendizaje; valores iniciales, tuneables — viven en `gamification.rules.ts` puro):**

```
Repasar flashcard VENCIDA (due):        +2 XP   · bonus recuerdo OK (q≥4): +3
Responder pregunta de quiz:             +2 XP   · bonus si CORRECTA:       +5
Abierta corregida CORRECT:              +12 XP  · PARTIAL: +6  · INCORRECT: +0 bonus
Completar un quiz (attempt COMPLETED):  +15 XP
Completar item del plan del día:        +10 XP
Completar/dominar un tema:              +30 XP
Vencer al jefe del día:                 +50 XP
Abrir la app / actividad sin acierto:    0 XP   (regla dura — nada de XP por vanidad)
```

**Reglas (además de §3.4):**
- **Ownership por `userId`** en los 3 modelos (denormalizado, §3.4). El `DailyBoss.topicId` es FK de
  agrupación/label (no ownership) → `onDelete: SetNull` con snapshots `topicName`/`subjectName`.
- **`level` derivado, no persistido:** `levelForXp(totalXp)` es una función **pura compartida** en
  `@bract/shared` (`lib/gamification.xp.ts`) → front y back calculan el mismo nivel/curva sin drift.
  Curva por defecto: XP acumulado para nivel `n` = `round(50 · n^1.6)`.
- **Anti-farmeo:** las flashcards solo dan XP si estaban **due** (el SRS empuja la carta al futuro → no se
  repite); tope diario `DAILY_ACTION_XP_CAP` sobre el XP "por acción" (`xpEarnedToday`/`xpTodayDate`); el
  lock anti-trampa del quiz impide re-responder → no se recompensa dos veces el mismo intento.
- **Misiones diarias (3/día), generadas LAZY al leer el summary** (sin cron), idempotentes por
  `(userId, date)` (`@@unique`). v1 = targets fijos sensatos (`COMPLETE_QUIZ`=1, `REVIEW_DUE_CARDS`=10,
  `COMPLETE_PLAN_ITEMS`=2; si hay jefe, una puede ser `DEFEAT_BOSS`). Completar misión = XP inmediato.
- **Racha PERDONADORA (`applyStreakOnActivity`, pura):** cuenta días con ≥1 acción que cuenta;
  `lastStudyDate==hoy` no cambia, `==ayer` suma. Día perdido con `freezeTokens>0` → consume 1 escudo y la
  racha **continúa**. Sin escudos → la racha arranca de nuevo en 1 **sin penalizar XP/nivel**, framing
  amable, `longestStreak` preservado. Escudos: +1 cada `FREEZE_EARN_EVERY`=5 días activos, cap
  `FREEZE_CAP`=2.
- **Jefe del día (`DailyBoss`):** al leer el summary se crea (si falta) desde `getWeakTopics(userId, 1)`
  (el tema más flojo de I-2). `maxHp = BOSS_HP` (5). Cada interacción de **dominio** sobre el tema-jefe
  (respuesta de quiz correcta **o** repaso SRS `q≥4` de una carta de ese tema) hace 1 de daño; `hp→0` ⇒
  `DEFEATED` + `xpReward`. **Sin datos de debilidad ⇒ no hay jefe** (la Home muestra `EmptyState`).
- **Sin tabla-ledger de XP en v1** (feed/historial diferido): el tope diario vive en el perfil. Si en v2
  se quiere historial de "+X XP", se agrega un `XpEvent` (documentar en `error.md`).

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
| `AI_UNAVAILABLE` | 503 | IA no disponible: falta `AI_API_KEY` o el proveedor falló (Agente B) |

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

PLANIFICADOR — Materias (Agente C)
GET    /api/v1/subjects                         [self]
POST   /api/v1/subjects                         [self]
GET    /api/v1/subjects/:id                     [self]
PATCH  /api/v1/subjects/:id                     [self]
DELETE /api/v1/subjects/:id                     [self]

PLANIFICADOR — Temas (Agente C)
GET    /api/v1/subjects/:subjectId/topics       [self]
POST   /api/v1/subjects/:subjectId/topics       [self]
PATCH  /api/v1/topics/:id                        [self]
DELETE /api/v1/topics/:id                        [self]
PATCH  /api/v1/topics/:id/status                 [self]   // completar/cambiar estado → dispara recálculo

PLANIFICADOR — Disponibilidad y Plan (Agente C)
GET    /api/v1/study/availability                [self]
PUT    /api/v1/study/availability                [self]   // set bulk (7 días, en minutos)
GET    /api/v1/study/plan                         [self]   // plan ACTIVE, día por día
POST   /api/v1/study/plan/generate                [self]   // genera/regenera (usa IA vía Agente B)
PATCH  /api/v1/study/plan/items/:id               [self]   // marcar bloque del día (COMPLETED/SKIPPED)

FLASHCARDS + SRS (Agente D)
GET    /api/v1/flashcards?topicId=...             [self]   // cartas de un tema
GET    /api/v1/flashcards/due                      [self]   // cartas due del usuario (SRS)
POST   /api/v1/flashcards                           [self]   // crear manual
POST   /api/v1/topics/:topicId/flashcards/generate  [self]   // generar con IA por tema (vía Agente B)
POST   /api/v1/flashcards/generate                  [self]   // generar MULTI-tema: { topicIds[] (1..5), count? } → N llamadas SECUENCIALES (cap bajo). Éxito parcial: conserva lo generado de los temas OK y reporta los fallidos en meta.topics; 503 solo si TODOS fallan. Cada carta queda con su topicId
PATCH  /api/v1/flashcards/:id                       [self]
DELETE /api/v1/flashcards/:id                       [self]
POST   /api/v1/flashcards/:id/review                [self]   // calificar SM-2: { quality: 0|3|4|5 }

CHAT DE ESTUDIO (Agente E)
GET    /api/v1/chat/sessions                        [self]
POST   /api/v1/chat/sessions                        [self]
GET    /api/v1/chat/sessions/:id                    [self]   // sesión + mensajes
DELETE /api/v1/chat/sessions/:id                    [self]
POST   /api/v1/chat/sessions/:id/messages           [self]   // enviar mensaje — responde STREAMING (SSE), no envelope JSON; ver error.md (Agente E)

IMPORTACIÓN MASIVA DE TEMAS — por texto (Agente K)
POST   /api/v1/import/topics/extract                 [self]   // { text, subjectName? } → la IA extrae temas + dificultad → PREVIEW (no escribe en DB)
POST   /api/v1/import/topics/commit                  [self]   // { topics[], mode: 'ADD'|'REPLACE', subjectId | subjectName } → persiste (add deduplica; replace borra y reemplaza)

EVALUACIÓN — Quiz (Agente I)
POST   /api/v1/quiz/attempts                          [self]   // GENERAR: { subjectId, topicIds[] (1..20), count? } → el server DERIVA el scope (1=TOPIC, todos=SUBJECT, subset=MULTI_TOPIC), llama a la IA (1 llamada), crea el intento IN_PROGRESS + items autoritativos, y devuelve preguntas PÚBLICAS (sin correctIndex/explicación). 503 si falla la IA (no persiste).
POST   /api/v1/quiz/attempts/:id/answers              [self]   // RESPONDER 1 pregunta: { order, selectedIndex } → corrige en el server contra el correctIndex guardado, bloquea re-responder (CONFLICT), recalcula score; devuelve la reveal (correctIndex + explicaciones) SOLO de esa pregunta.
GET    /api/v1/quiz/attempts                          [self]   // historial paginado (COMPLETED) del usuario (sin items)
GET    /api/v1/quiz/attempts/:id                      [self]   // intento + items POR ESTADO (anti-trampa al reanudar): contestado → completo (options con explicación, correctIndex, selectedIndex, isCorrect); SIN contestar → público (options solo {text}, correctIndex=null, isCorrect=false, sin explicación). COMPLETED → todos contestados → todos completos.

PROGRESO & PERSONALIZACIÓN (I-2)
GET    /api/v1/progress/overview                      [self]   // % de acierto + debilidad por materia/tema (groupBy quiz + SRS, on-the-fly). 4 estados; EmptyState si no hay datos.
GET    /api/v1/progress/weak-topics?limit=            [self]   // temas más flojos del usuario, ordenados por debilidad desc (omite temas sin datos).
GET    /api/v1/preferences                            [self]   // preferencias de estudio del usuario (defaults si no existen).
PUT    /api/v1/preferences                            [self]   // upsert de preferencias (Zod): remediationIntensity, prioritySubjectIds, weightQuiz/Srs?, dailyGoalMinutes?.

GAMIFICACIÓN (Agente J)
GET    /api/v1/gamification/summary                   [self]   // perfil (totalXp, level DERIVADO, racha, escudos) + misiones de hoy + jefe de hoy. Genera lazy (idempotente) las misiones/jefe que falten. SOLO lectura: el XP/quests/jefe/racha se mutan server-side POR EFECTO de acciones reales (§3.7), nunca por un POST del cliente (anti-trampa).
```

> **Evaluación / Quiz (Agente I) — IDEAS_POST_MVP §"Agente I".** Quiz de opción múltiple por tema o materia,
> con **corrección por pregunta en el servidor y anti-trampa real**. Generar (`POST /quiz/attempts`) llama a
> la IA (vía `lib/ai`, Gemini) y persiste el intento IN_PROGRESS con `correctIndex`/explicaciones
> autoritativos; al cliente solo van preguntas públicas. Responder (`POST .../answers`) corrige contra el
> valor guardado, bloquea re-responder y revela esa pregunta. Datos persistidos (`topicId` + `isCorrect`)
> habilitan después el dashboard/puntos débiles (follow-up **I-2**, fuera de alcance). Frontend en
> `features/quiz/`. Modelos `QuizAttempt`/`QuizAttemptItem` (§3.5) → requiere `db push`.

> **Importación de temas (Agente K) — IDEAS_POST_MVP §"Agente K".** Cargar temas de a uno es tedioso:
> esta feature permite pegar TEXTO grande y que la IA (vía `lib/ai`, Gemini) extraiga los temas y los
> clasifique por dificultad (EASY/MEDIUM/HARD), con salida JSON validada con Zod, tope de 50 temas y dedup.
> Flujo en **2 pasos con PREVIEW obligatorio**: (1) `extract` devuelve el preview sin tocar la DB; (2) tras
> que el usuario revisa/edita los temas y elige materia destino + modo, `commit` persiste. **El borrado lo
> decide el MODE (toggle de UI: agregar vs reemplazar), NUNCA la IA interpretando intención** (riesgo de
> perder temas por una frase ambigua). Reusa `Subject`/`Topic` (§3.3) — sin modelos nuevos ni `db push`.
> Frontend en `features/import/`. Importar archivos (PDF/.pptx/.txt/.md) es follow-up, fuera de alcance.

> Todas las rutas de producto son `[self]`: protegidas con `authenticate` y scopeadas a `req.user.id`.
> El contrato (rutas + DTOs Zod) lo define el Agente A; la implementación por capas es de C/D/E.

### 5.6 Errores de generación con IA — recurso sin contenido

Las rutas que generan contenido con IA a **nivel materia** validan que haya temas ANTES de llamar al
proveedor, con un contrato uniforme:

| Endpoint | Condición | Código | Mensaje |
|---|---|---|---|
| `POST /api/v1/quiz/attempts` | la materia tiene 0 temas | `VALIDATION_ERROR` (400) | "La materia no tiene temas para generar contenido" |
| `POST /api/v1/quiz/attempts` | un `topicId` no es del usuario o no pertenece a la materia | `NOT_FOUND` (404) | tema no encontrado |
| `POST /api/v1/flashcards/generate` | un `topicId` ajeno | `NOT_FOUND` (404) | tema no encontrado (validación de ownership ANTES de generar) |
| `POST /api/v1/flashcards/generate` | **todos** los temas fallan en la IA | `AI_UNAVAILABLE` (503) | sin cartas generadas (con éxito parcial NO falla: ver meta) |

- **Mensaje canónico = constante compartida** (`apps/api/src/config/constants.ts` → `GENERATION_ERRORS.SUBJECT_NO_TOPICS`), reusable si aparece otra generación a nivel materia.
- **Flashcards multi** (`POST /flashcards/generate`) valida el **ownership de todos los temas primero**; recién después genera **secuencial** con **éxito parcial** (solo `AI_UNAVAILABLE` si fallan todos). El per-tema (`POST /topics/:topicId/flashcards/generate`) sigue sin validar "vacío" (un tema es generable por su nombre). El caso "materia con 0 temas" se previene en el **frontend** (no hay tema que elegir → hint "agregá temas primero").
- **Planner** (`POST /study/plan/generate`, global) e **Import** (`POST /import`, ya valida texto/tipo) no entran en este contrato.
- **Frontend:** los setups de quiz y flashcards **deshabilitan** la generación cuando la materia elegida tiene 0 temas y muestran un hint con link al Planificador; el caso "sin materias" muestra un `EmptyState`.

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
// <PublicRoute />  → redirige a /home si ya autenticado (default landing — §8.10)
// <AuthRoute />    → redirige a /login si no autenticado
// <RoleRoute role="ADMIN" /> → redirige a /403 si sin permiso (envuelve /dashboard, /analytics, /users, /admin)
```

### 8.6 Features de producto — Estudio con IA

Tres features nuevas en `src/features/`, cada una con la estructura del §8.1, los 4 estados del §0.3
(`loading · empty · error · success`), entrada en el sidebar del `DashboardShell` (con i18n es/en) y
consumo de contratos desde `@bract/shared`:

| Feature | Carpeta | Agente | Contenido |
|---------|---------|--------|-----------|
| Planificador | `features/planner/` | C | materias/temas/disponibilidad, vista día por día, marcar tema completado → recálculo reactivo |
| Flashcards | `features/flashcards/` | D | estudio SRS (mostrar → revelar → calificar), CRUD manual, generación con IA (1 tema = panel de gestión per-tema; ≥2 temas vía `MultiSelect` = generación multi con éxito parcial, muestra el `meta` de temas OK/fallidos) |
| Chat de estudio | `features/chat/` | E | hilo por sesión, streaming, contexto del estudiante |

**Contexto compartido (Agente F):** invalidaciones/refetch cruzados de React Query — completar un tema en
el planner refresca el contexto del chat y la frecuencia SRS de sus flashcards; las flashcards se generan
solo sobre temas del planner. Fuente de verdad única: materias/temas/progreso (§3.3).

### 8.7 Temario + estudio on-demand (mayormente frontend, reusa C/D/E)

> Da **agencia** al estudiante: además de seguir el plan del día (planner), poder elegir "hoy quiero
> estudiar ESTE tema ahora" con sus herramientas a mano. Un flujo centrado en el **tema**. Reusa los
> endpoints/hooks existentes — **sin backend nuevo**. Origen: `IDEAS_POST_MVP.md` §"Temario + estudio
> on-demand". Frontend en `features/syllabus/`.

| Feature | Carpeta | Contenido |
|---------|---------|-----------|
| Temario | `features/syllabus/` | overview navegable materia→tema (estado + dificultad); detalle de tema con estudio on-demand |

- **Ruta `/syllabus`**, label i18n es **Temario** / en **Syllabus**, entrada en el sidebar. Layout
  master/detail (igual patrón que el chat): lista materias→temas a la izquierda, panel de detalle del
  tema a la derecha (en mobile, una u otra).
- **Fuente de verdad reusada:** `useSubjects()` (árbol `SubjectWithTopics`, `queryKeys.planner.subjects`).
  El temario es **read-only** respecto al CRUD de temas — eso vive en el planner, no se duplica. Reusa los
  badges `StatusBadge`/`DifficultyBadge` del planner.
- **Detalle de tema — acciones on-demand:**
  - *Estudiar flashcards de este tema:* estudio inline (revelar → calificar) sobre **todas** las cartas
    del tema (`useFlashcards(topicId)`, no la cola `due`) → funciona aunque el tema esté `PENDING`/pausado
    en SRS. Calificar sigue usando `review` (SM-2 persiste). Sin cartas → `EmptyState` con "Generar con IA".
  - *Preguntar al chat sobre este tema:* deep-link a `/chat` con el tema como foco (ver abajo).
- **Reuso del estudio (refactor mínimo):** se extrae de `flashcards/StudySession` un presentacional
  `StudyDeck` (recibe `cards` + `onReview` + copys i18n). La pestaña "Estudiar" global lo envuelve con
  `useDueFlashcards` (comportamiento **idéntico**, sin regresión); el temario lo envuelve con
  `useFlashcards(topicId)`. Una sola fuente del UI revelar→calificar.
- **Foco del chat por tema — SOLO frontend (no toca el contrato ni el streaming del chat):** el botón
  navega a `/chat` con `state.focusTopic`; `ChatPage` crea una sesión (título = nombre del tema) y pasa un
  `initialMessage?` opcional a `ChatThread`, que lo auto-envía **una sola vez** (guard `useRef`) vía el
  `send` existente. El backend ya ensambla el árbol completo en cada mensaje, así que nombrar el tema en el
  primer mensaje lo enfoca. Props nuevas son opcionales y aditivas. El foco "real" en el contexto
  (`focusTopic` en `assembleStudentContext`) queda como **follow-up**, fuera de alcance.
- **Interacción cruzada conocida (documentada en `error.md`):** calificar on-demand una carta de un tema
  pausado en SRS le mueve el `dueDate` a `now+interval`, reincorporándola a la cola global. Es coherente
  con la agencia del estudiante (interactuar con un tema lo activa); no se intenta re-pausar.
- 4 estados (`loading · empty · error · success`), i18n es/en sin hardcodear (`nav.syllabus` + bloque
  `syllabus.*`), ruta lazy con `ErrorBoundary`. **Sin modelos ni endpoints nuevos.**

### 8.8 Evaluación / Quiz (Agente I)

> Feature nueva en `features/quiz/`. Evaluar lo estudiado con un quiz de opción múltiple por **tema** o
> **materia**, con corrección inmediata y explicación por opción. Reusa `useSubjects` (fuente única del
> árbol materias→temas) y `lib/ai` (Agente B). Origen: `IDEAS_POST_MVP.md` §"Agente I". Spec en §3.5 y §5.5.

| Feature | Carpeta | Contenido |
|---------|---------|-----------|
| Evaluación | `features/quiz/` | setup (elegir materia + **set de temas** vía `MultiSelect` + cantidad) → runner pregunta-por-pregunta con reveal local → resultados con puntaje; historial de intentos |

- **Ruta `/quiz`**, label i18n es **Evaluación** / en **Quiz**, entrada en el sidebar. Ruta lazy con
  `ErrorBoundary` (patrón de las demás features de producto).
- **Flujo (3 pasos + historial):** (1) **Setup** — elegir materia y un **set de temas** con el primitivo
  `MultiSelect` (checkboxes + atajo "seleccionar toda la materia"; 1 tema = modo individual, sin perderse),
  y cantidad (5–10) → "Generar quiz" (`useSubjects`, fuente única) → manda `{ subjectId, topicIds[], count }`
  (el server deriva el scope), crea el intento (`POST /quiz/attempts`) y recibe las preguntas **públicas**.
  El historial/detalle/resultados componen la etiqueta `"N temas de X"` con `scopeLabel` (i18n, plurales). (2) **Runner** — una pregunta a la vez; al elegir, `POST .../answers`
  → el server corrige y devuelve la **reveal** (correcto/incorrecto + explicación por opción: verde la
  correcta, rojo tu elección si fallaste); botón "Siguiente"; barra de progreso. La respuesta correcta y la
  explicación NO están en el cliente hasta contestar. (3) **Resultados** — puntaje X/N + repaso (el intento
  ya quedó COMPLETED en el server al responder la última). (4) **Historial** — intentos pasados (puntaje +
  fecha) → detalle revisable con explicaciones.
- **Generación inherente a IA:** sin `AI_API_KEY` → `AI_UNAVAILABLE` (503) al generar, detectado por
  `error.code` del envelope (patrón de `TopicFlashcards`/import). Responder un intento ya creado no depende
  de la IA. Re-responder una pregunta → `CONFLICT` (lock anti-trampa).
- 4 estados (`loading · empty · error · success`), i18n es/en sin hardcodear (`nav.quiz` + bloque `quiz.*`,
  plurales `_one/_other`). **Modelos nuevos (§3.5) → requiere `db push`.** Sin env vars ni deps nuevas.

### 8.9 Voz — dictado y lectura (Agente L)

> Feature **100% frontend** sobre la **Web Speech API nativa del navegador** (gratis, sin backend, sin
> infra, sin tokens). Dos capacidades en el chat tutor: **dictado** (voz→texto en el input) y **lectura**
> (texto→voz de las respuestas del tutor). Origen: `IDEAS_POST_MVP.md` §"Agente L". Decisión clave:
> **NO** Whisper/Gemini-audio/ElevenLabs — cuestan plata/cómputo y romperían la restricción de free tier.
> Trade-off asumido: soporte desigual entre navegadores (Chrome/Edge bien; Firefox/Safari parcial) y
> requiere internet → **degradación elegante** (si no hay soporte, el botón se oculta y el chat sigue por texto).

| Capacidad | API | Punto de integración |
|-----------|-----|----------------------|
| Dictado (voz→texto) | `SpeechRecognition` / `webkitSpeechRecognition` | `MessageComposer` (botón micrófono junto al Send) |
| Lectura (texto→voz) | `speechSynthesis` + `SpeechSynthesisUtterance` | `ChatThread` (botón "escuchar" en cada bubble del tutor) |

- **Hooks reusables, fuera de `features/chat/`** (`src/hooks/useSpeechRecognition.ts` y
  `src/hooks/useSpeechSynthesis.ts`): son wrappers genéricos de browser-API cross-feature (chat ahora,
  quiz a futuro), **no** lógica de chat. La UI de los botones sí vive en `features/chat/`.
- **Tipos:** `lib.dom` NO tipa `SpeechRecognition`/`webkitSpeechRecognition` → se declara una interfaz
  ambient mínima en `src/types/speech.d.ts` (evita `any` injustificado; DECISIÓN documentada inline).
  `speechSynthesis` sí está tipado en `lib.dom` → la lectura no necesita declaración extra.
- **Idioma de voz atado al toggle i18n** (`i18n.language`): `es`→`es-ES`, `en`→`en-US`, en dictado y lectura.
- **Dictado (capa 1 — el dolor directo):** `continuous=true` con interim results (no corta en las pausas al
  pensar la pregunta) + botón **stop** + **auto-stop** en unmount y cuando el composer está `disabled`
  (stream activo) + **timeout de silencio (~3–4s sin voz → para)** para evitar el "micrófono fantasma".
  La transcripción final **se anexa** al texto ya tipeado (no reemplaza); el usuario edita antes de enviar.
  Solo muta el `value` local del composer → **no toca `useChatStream`, el SSE ni el envelope**. (Si en la
  práctica `continuous` se porta mal cross-browser, se cae a `false` — llamada técnica del implementador;
  la UX objetivo es "no cortar en la pausa".)
- **Lectura (capa 2):** botón "escuchar" on-demand **solo en mensajes del tutor (assistant) y solo los
  persistidos** — nunca sobre el bubble de `streamingText` (no leer frases a medias). Sin autoplay.
- **Estados del dictado (los 4 + permisos):** `idle` (icono mic) · `escuchando` (pulso activo + acción stop) ·
  `transcribiendo` (interim tenue en el textarea) · **`error`** — y dentro de error se distingue
  **permiso de micrófono denegado** (mensaje claro y accionable) de **`no-soportado`** (navegador sin API →
  el botón **se oculta**, no es un error). Lectura: `idle` (altavoz) · `hablando` (stop) · `no-soportado` (oculto).
- **Accesibilidad:** botones icon-only con **`aria-label` descriptivo en es/en**; la animación de pulso de
  "escuchando" respeta **`prefers-reduced-motion`**; colores solo de tokens (§9).
- i18n es/en sin hardcodear (`chat.thread.voice.*` para dictado, `chat.thread.listen.*` para lectura).
  **Sin backend, sin env vars, sin `db push`, sin cambios en `@bract/shared`, sin deps nuevas.**
- **Lectura larga (Chrome/Edge) — keepalive (implementado):** `speechSynthesis` corta las lecturas largas
  (~15s) si no se la "patea" periódicamente. `useSpeechSynthesis` arma un `setInterval` (~10s, por debajo
  del corte) que llama `resume()` mientras habla; se limpia SIEMPRE en `onend`/`onerror`/`cancel()`/unmount
  (sin intervalos colgados). Si en algún navegador `resume()` solo no alcanzara, el fallback es alternar
  `pause()+resume()` (anotado inline en el hook).

### 8.10 Home del estudiante + gating del dashboard admin (100% frontend, reusa I-2/C)

> Hoy el landing de **todos** (`/`, post-login, post-register) es `/dashboard`: un panel de **métricas de
> sistema** que consume `/analytics/*`. Un estudiante normal cae ahí y ve **error / cards vacías** porque
> esos endpoints están gateados a ADMIN en el backend (`authorize(ADMIN, SUPER_ADMIN)` → **403**). **No es
> fuga de datos** (el backend ya está bien gateado); es (a) una pantalla de bienvenida rota para el
> estudiante y (b) el panel de métricas admin queda accesible **en frontend** a cualquier autenticado
> (`/dashboard` no está envuelto en `RoleRoute`). Esta feature: **(1)** gatea el dashboard de métricas a
> ADMIN y **(2)** crea un **Home** del estudiante útil reusando endpoints existentes. Origen: pedido del
> usuario. **Sin backend, sin endpoints nuevos, sin `db push`, sin deps.**

| Feature | Carpeta | Contenido |
|---------|---------|-----------|
| Home | `features/home/` | bienvenida ("hola de nuevo") + su progreso (I-2) + overview de materias + resumen del plan del día / próximo examen |

- **Gating del dashboard de métricas (parte 1 — la corrección):** la ruta `/dashboard` pasa a estar
  envuelta en `<RoleRoute role={ADMIN}>`. El item `dashboard` del sidebar pasa a `adminOnly: true` (hoy es
  visible para todos en `Sidebar.tsx`). **Decisión de path:** se **mantiene en `/dashboard`** (no se mueve a
  `/admin/dashboard`) — el componente, las claves i18n (`nav.dashboard`, bloque `dashboard.*`), los
  `handle.titleKey`/breadcrumbs y los hooks ya cuelgan de ahí; moverlo no aporta nada funcional y multiplica
  el churn. Solo cambia su **protección**, no su URL.
- **Redirect suave para `/dashboard` (no 403):** como `/dashboard` fue el landing de **todos** hasta ahora,
  un no-admin que caiga ahí (link viejo, bookmark) debe redirigir a **`/home`**, no a `/403` — que se sienta
  suave, no un error. Para esto `RoleRoute` recibe una prop **opcional `redirectTo` (default `/403`)**: el
  `/dashboard` la pasa como `/home`; **`/analytics`, `/users`, `/admin` conservan el `/403`** (default, son
  rutas que nunca fueron del estudiante).
- **Home del estudiante (parte 2):** nueva feature `features/home/` con la estructura del §8.1, ruta
  **`/home`** (lazy + `ErrorBoundary`, patrón de las demás features de producto) y **entrada en el sidebar
  para todos** (no `adminOnly`). Label i18n es **Inicio** / en **Home**. Secciones:
  - **Bienvenida:** saludo "hola de nuevo, {nombre}" (reusa el patrón `greetingKey()` por hora del día que
    ya existe en el `DashboardPage` admin — se extrae a un helper compartido o se replica, sin colores
    hardcodeados).
  - **Tu progreso (reusa I-2):** resumen de `useProgressOverview()` (`/progress/overview`) — barras/medias
    por materia + total `avgAccuracy`. Read-only; el detalle completo sigue viviendo en `/progress`.
  - **En qué enfocarte (reusa I-2):** sección compacta con el **top 3** de `useWeakTopics()` (lo más
    accionable del Home: qué estudiar hoy) + link **"ver más" → `/progress`**. Compacto, sin duplicar el
    dashboard de progreso completo. Sin datos → `EmptyState` ("estudiá un poco y acá verás dónde reforzar").
  - **Tus materias:** overview compacto desde `useSubjects()` (`SubjectWithTopics[]`, fuente única ya usada
    por planner/temario) — conteo de temas por estado. Link a `/syllabus`.
  - **Plan de hoy / próximo examen:** desde `usePlan()` (`/study/plan`) los bloques del día (items con
    `date` == hoy + su `topic`); el **próximo examen** se deriva **en cliente** del menor `Subject.examDate`
    futuro (de `useSubjects()`) — **sin endpoint nuevo**. Link a `/planner`.
- **Routing por rol (parte 3 — un solo landing):** `/`, `PublicRoute` (redirect de autenticado), y los
  `navigate` post-login (`useLogin`) y post-register (`useRegister`) pasan de `/dashboard` a **`/home`**
  para **todos los roles, admin incluido** (el Home también le sirve al admin como estudiante; el admin
  llega a sus métricas por el item de sidebar admin-only). Routing simple, una sola rama. Se actualiza el
  comentario de `§8.5` (default landing = `/home`, no `/dashboard`).
- 4 estados por sección (`loading` con skeleton · `empty` con `EmptyState` p.ej. "todavía no cargaste
  materias" → CTA a planner/temario · `error` con `ErrorState` + retry · `success`), i18n es/en sin
  hardcodear (`nav.home` + bloque `home.*`), **solo color tokens del §9.2**. Cada sección degrada
  independiente (que falle el progreso no rompe el plan del día).
- **Decisión documentada (`error.md` si aplica):** el `DashboardPage` admin conserva su propio saludo; si
  el `greetingKey()` se extrae a helper compartido, es refactor mínimo sin cambio de comportamiento.

### 8.11 Home gamificada (Agente J, §3.7) — rediseño de la Home sobre eventos existentes

> Gamifica la **Home del estudiante (§8.10)**: la misma `/home` pasa a ser el **tablero de juego**
> (nivel + barra de XP, racha perdonadora, misiones diarias, jefe del día) **arriba**, y las secciones
> informativas actuales (progreso/materias/plan de hoy) **debajo**. NO es una sección nueva: una sección
> dedicada `/arena` queda para fases posteriores. Origen: `IDEAS_POST_MVP.md` §"Agente J". Frontend nuevo
> en `features/gamification/`, consumido por `features/home/`. **Backend = solo `GET /gamification/summary`**
> (§5.5); el resto se mueve por efecto (§3.7).

| Feature | Carpeta | Contenido |
|---------|---------|-----------|
| Gamificación | `features/gamification/` | api + `useGamificationSummary` + widgets `LevelXpBar` · `StreakBadge` · `DailyMissions` · `BossOfDay` + momentos animados |

- **Tablero (arriba en `/home`):**
  - `LevelXpBar` — nivel + barra de XP animada (`transform/opacity`, framer-motion). El nivel y el corte
    de la barra los calcula `levelForXp` de `@bract/shared` (misma fuente que el server → sin desfase).
  - `StreakBadge` — racha actual + escudos de gracia, con framing amable (nunca culposo) + tooltip.
  - `DailyMissions` — las 3 misiones de hoy con barra de progreso; check animado + toast "+X XP" al completar.
  - `BossOfDay` — card con HP bar que se vacía; nombre del tema-jefe + materia; CTA **"Enfrentar"** que
    deep-linkea a `/quiz` con el set de temas = `[tema-jefe]` (reusa el setup del quiz, sin endpoint nuevo).
    Sin datos de debilidad (I-2) ⇒ `EmptyState` ("seguí estudiando para que aparezca un jefe").
- **Debajo:** las secciones actuales de la Home (progreso I-2, materias, plan de hoy / próximo examen) sin cambios.
- **Momentos animados (de primera clase, máx 1–2 elementos por vista):** subir de nivel (overlay con glow
  + pop), completar misión (check + toast XP), vencer al jefe (HP a 0 + flash). **Sin libs nuevas**
  (framer-motion ya está). El front **diffea** el summary previo vs el nuevo para saber qué celebrar.
- **Cómo se refresca:** los endpoints de acción (quiz/flashcards/planner) **NO cambian su contrato**; tras
  una acción que cuenta, los hooks de mutación invalidan `gamification.summary` (helper central
  `invalidateAfterStudyAction(qc)` en `apps/web/src/lib/`, patrón `invalidateStudyContext.ts`).
- **Reglas de animación (NO negociables):** `prefers-reduced-motion` ⇒ fallback estático (sin movimiento);
  ease-out al entrar / ease-in al salir; 150–300ms en micro; sin loops decorativos infinitos.
- **Iconos = SVG** (flama/escudo/espada/nivel), **nunca emojis**. Solo color tokens del §9.2 (incluidos los
  acentos de juego). 4 estados por sección (`loading · empty · error · success`), i18n es/en sin hardcodear
  (`gamification.*` + extensiones de `home.*`). **Modelos nuevos (§3.7) → requiere `db push`.** Sin env
  vars ni deps nuevas.

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

  /* Acentos de juego (Gamificación — Agente J §3.7/§8.11). Vibrantes pero dark-first; contraste 4.5:1. */
  --xp-gold:      #fbbf24;   /* barra de XP / "+X XP" */
  --streak-flame: #fb923c;   /* racha (flama) */
  --boss-crimson: #f43f5e;   /* jefe del día (HP bar) */
  --level-glow:   #a78bfa;   /* subir de nivel (glow/celebración) */
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

# Núcleo de IA (Agente B) — proveedor: Anthropic Claude
# AI_API_KEY es OPCIONAL: si falta, la app bootea igual y degrada (plan → baseline
# determinista; flashcards/chat → error AI_UNAVAILABLE 503). Nunca rompe el build/boot.
AI_API_KEY=sk-ant-...
# Modelos escalonados por tarea (NO Opus para todo). Defaults si se omiten:
AI_MODEL_GENERATION=claude-haiku-4-5   # plan + flashcards (generación, barato)
AI_MODEL_CHAT=claude-sonnet-4-6        # chat (medio; claude-opus-4-8 para calidad máxima)

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

## 15-BIS. FASES DE PRODUCTO — Estudio con IA

> Features APROBADAS (`context.md` / `PLAN_AGENTES.md`). Dependencias: **A** (modelo de datos) antes de
> todo; **B** (núcleo de IA) antes de las features; **F** integra; **H** valida end-to-end. Spec en §3.3,
> §5.5 y §8.6.

### Fase 9 — Modelo de datos compartido + núcleo de IA (Agentes A, B)
- [ ] **A:** modelos Prisma (§3.3), tipos + Zod en `@bract/shared`, `db push` aplicado
- [ ] **B:** `ai.service.ts` (proveedor tras `AI_API_KEY`), ensamblador de contexto, degradación sin key
- [ ] **B:** documentar proveedor de IA en §1 (stack) y `AI_API_KEY` en §11 (env vars)

### Fase 10 — Planificador (Agente C)
- [ ] CRUD materias/temas/disponibilidad (capas Repo→Service→Controller, envelope)
- [ ] Generación del cronograma (urgencia por examen + pendientes + minutos/día, vía B) y recálculo
- [ ] Frontend `features/planner/` con los 4 estados + entrada en sidebar (i18n)

### Fase 11 — Flashcards + SRS (Agente D)
- [ ] CRUD + generación por tema (vía B) + motor SM-2 (review actualiza `ease`/`intervalDays`/`dueDate`)
- [ ] Endpoint `due`; frontend `features/flashcards/` (estudiar → calificar) con 4 estados (i18n)

### Fase 12 — Chat + Integración + QA (Agentes E, F, H)
- [ ] **E:** ChatSession/ChatMessage, mensaje con contexto (vía B), streaming, frontend `features/chat/`
- [ ] **F:** contexto compartido en vivo (invalidaciones cruzadas; un cambio se refleja en las 3 secciones)
- [ ] **H:** QA end-to-end conectado, CI verde (typecheck/lint/build), deploy verificado en Render

### Fase 13 — Temario + estudio on-demand (§8.7, mayormente frontend, reusa C/D/E)
- [ ] Refactor `StudyDeck` extraído de `flashcards/StudySession` — pestaña "Estudiar" global **idéntica** (sin regresión, tests de flashcards verdes)
- [ ] `features/syllabus/` overview materia→tema (badges reusados) + 4 estados + ruta `/syllabus` + sidebar (i18n)
- [ ] Detalle de tema: estudio inline por tema (`useFlashcards`) + generar IA + botón "Preguntar al chat"
- [ ] Deep-link al chat con foco por tema (`focusTopic` state + `initialMessage` auto-enviado una vez) — sin tocar el contrato/streaming del chat

### Fase 14 — Evaluación / Quiz (Agente I, §3.5 · §5.5 · §8.8)
- [ ] **Shared:** tipos + Zod de quiz en `@bract/shared` (entidades + DTOs `generate`/`attempts`)
- [ ] **Prisma:** modelos `QuizAttempt`/`QuizAttemptItem` + enum `QuizScope` + back-relations → `db push` aplicado
- [ ] **lib/ai:** `generateQuiz` aditivo (salida JSON con explicación por opción, Zod + invariantes; `AI_UNAVAILABLE` sin key)
- [ ] **Backend `modules/quiz/`:** repo→service→controller→routes (envelope, Zod, `[self]`), grading server-side, ownership de tema/materia
- [ ] **Frontend `features/quiz/`:** setup + runner (reveal local) + resultados + historial, 4 estados, i18n es/en, sidebar, ruta lazy
- [ ] **FUERA DE ALCANCE (I-2):** dashboard de progreso agregado + detección de puntos débiles (solo se dejan los datos persistidos)

### Fase 15 — Progreso, puntos débiles y personalización (Agente I-2, §3.6 · §5.5)
> Capas 2 y 3 son ADITIVAS sobre features deployadas: cada una con un test golden "sin datos = idéntico a hoy". Orden estricto F1→F7.
- [ ] **F1 — Shared:** tipos + Zod (`TopicWeakness`, `SubjectProgress`, `ProgressOverview`, `WeakTopic`, `UserStudyPreferences` + `UpdatePreferencesInput`, enum `RemediationIntensity`)
- [ ] **F2 — Backend motor (capa 1):** `modules/progress/` repo (`groupBy`, sin N+1) → service (fórmula de debilidad, `getWeaknessMap` reusable) → controller → routes `[self]`; tests del cálculo. NO toca planner ni chat
- [ ] **F3 — Dashboard (capa 1):** `features/progress/` (api + hooks + componentes), ruta `/progress` + sidebar, barras por materia/tema + lista de débiles, 4 estados + `EmptyState`, i18n es/en, color tokens
- [ ] **F4 — Personalización:** modelo `UserStudyPreferences` + `db push`, `modules/preferences/` + UI; la fórmula de F2 lee prefs (degrada a defaults)
- [ ] **F5 — Integración Planner (capa 2, aditivo):** `buildPlanInput` enriquece topics con `weakness`; blend "nudge en días" en `buildBaselinePlan` + hint al prompt; test golden sin-datos = hoy
- [ ] **F6 — Integración Chat (capa 3, aditivo):** `StudentContext.weakTopics?` + render condicional en `renderContextForPrompt`; sin tocar streaming/contrato; test golden sin-datos = prompt idéntico
- [ ] **F7 — Verificación:** tests de degradación (try/catch ⇒ comportamiento de hoy), no-N+1 (revisar SQL emitido), typecheck/lint, checklist CLAUDE.md

### Fase 16 — Voz / dictado y lectura (Agente L, §8.9) — 100% frontend, degrada elegante
> Web Speech API nativa (gratis). Hooks genéricos reusables fuera de `features/chat/`. Sin backend, sin env vars, sin `db push`, sin deps. Empezar por el dictado (dolor directo), después la lectura.
- [ ] **F0 — Spec:** §8.9 + esta fase en el README (sin código de app)
- [ ] **F1 — Dictado:** `src/hooks/useSpeechRecognition.ts` (`continuous=true` + stop + auto-stop unmount/disabled + timeout de silencio; estados idle/escuchando/transcribiendo/error con permiso-denegado ≠ no-soportado) + `src/types/speech.d.ts` (ambient mínimo) + botón mic en `MessageComposer` (anexa al input; oculto si no-soportado; aria-label es/en; pulso respeta `prefers-reduced-motion`) + i18n `chat.thread.voice.*`. No toca el stream
- [ ] **F2 — Lectura:** `src/hooks/useSpeechSynthesis.ts` + botón "escuchar" en bubbles del tutor **persistidos** (no en `streamingText`), on-demand sin autoplay, aria-label es/en, oculto si no-soportado + i18n `chat.thread.listen.*`
- [ ] **F3 — Verificación:** `typecheck`/`lint`/`test` verdes, `git diff --stat`, actualizar `fid.md`. No mergear

### Fase 17 — Home del estudiante + gating del dashboard admin (§8.10) — 100% frontend, reusa I-2/C
> Corrige el landing: hoy todos caen en el dashboard de métricas admin (403 → cards vacías para el estudiante; panel admin accesible en frontend a cualquier autenticado). Gatea las métricas a ADMIN y crea un Home útil. Sin backend, sin `db push`, sin deps. Branch `agente-home`, no mergear.
- [ ] **F0 — Spec:** §8.10 + nota §8.5 + esta fase en el README (sin código de app)
- [ ] **F1 — Gating métricas:** `RoleRoute` gana prop opcional `redirectTo` (default `/403`); `/dashboard` envuelto en `<RoleRoute role={ADMIN} redirectTo="/home">` (no-admin → `/home` suave, no 403) + item `dashboard` del sidebar a `adminOnly: true`. URL sin cambios (decisión §8.10)
- [ ] **F2 — Routing por rol → `/home`:** `/` (Navigate), `PublicRoute`, `useLogin` y `useRegister` pasan de `/dashboard` a `/home` para todos los roles
- [ ] **F3 — Feature `features/home/`:** ruta `/home` lazy + `ErrorBoundary` + item de sidebar para todos (i18n `nav.home`); secciones bienvenida + progreso (`useProgressOverview`) + "en qué enfocarte" (top 3 `useWeakTopics` + ver más → `/progress`) + materias (`useSubjects`) + plan de hoy/próximo examen (`usePlan` + `Subject.examDate` derivado); helper `greetingKey` compartido (DRY con `DashboardPage`); 4 estados por sección, i18n `home.*` es/en, solo color tokens
- [ ] **F4 — Verificación:** `typecheck`/`lint`/`test` verdes, `git diff --stat`, checklist CLAUDE.md. No mergear

### Fase 18 — Selección de múltiples temas para generar (Quiz + Flashcards, §3.5 · §5.5 · §8.8)
> Unifica el alcance de generación como un **set de `topicIds`** dentro de una materia: 1=individual, todos=materia, subset=multi. El cliente manda el set; el **server deriva** el scope. Mantiene el historial e I-2 intactos (`QuizAttemptItem.topicId` por pregunta no cambia). Branch `feat/multi-topic-generation`, no mergear.
- [x] **F1 — Shared/contrato:** `generateQuizSchema` → `{ subjectId, topicIds[] (1..20), count? }`; `QuizScope` + `MULTI_TOPIC`; `GeneratedAttempt`/`QuizAttempt` + `topicCount`; `generateFlashcardsMultiSchema` `{ topicIds[] (1..5), count? }` + tipos de meta de éxito parcial
- [x] **F2 — Prisma:** `QuizScope.MULTI_TOPIC` + `QuizAttempt.topicCount Int @default(1)` → **`db push` aplicado** (Session pooler 5432). `QuizAttemptItem` sin cambios
- [x] **F3 — Backend quiz:** `generate()` deriva scope/`scopeName`/`topicCount` desde el set (valida ownership + pertenencia a la materia, 1 sola llamada de IA). Repo: elimina `findTopicContext`
- [x] **F4 — Backend flashcards:** nuevo `POST /flashcards/generate` (`generateMulti`): valida ownership de todos los temas, genera **secuencial con éxito parcial** (`meta.topics` con generated/failed; `AI_UNAVAILABLE` solo si todos fallan); per-tema intacto. Sin `db push`
- [x] **F5 — Frontend:** primitivo `MultiSelect` (atajo "toda la materia" sin perder el individual) en `QuizSetup` y `TopicFlashcards`; `scopeLabel`/`scopeBadgeLabel` componen `"N temas de X"` bilingüe; muestra el `meta` de éxito parcial de flashcards; 4 estados, i18n es/en, tokens
- [ ] **F6 — Verificación:** `pnpm -r typecheck`/`lint`/`test` verdes (99 tests), `git diff --stat`, README actualizado, checklist CLAUDE.md. No mergear

### Fase 19 — Gamificación: XP, niveles, misiones, racha y jefe del día (Agente J, §3.7 · §5.5 · §8.11 · §9.2)
> Capa de lectura + efectos de dominio cruzado sobre los eventos que YA existen (quiz, flashcards/SRS, planner, progreso I-2). 100% determinista (sin IA). Premia aprender (dominio/retención), nunca actividad vacía. Cada hook detrás de `try/catch` ⇒ sin datos/error = features deployadas idénticas a hoy. Branch `agente-j-gamificacion`, no mergear. **Bordes de revisión: `db push` (F2) y verificación final (F6).**
- [ ] **F0 — Spec:** §3.7 (3 modelos + 3 enums + back-relations + reglas), §5.5 (`GET /gamification/summary`), §8.11 (Home gamificada), §9.2 (tokens de acento de juego), esta fase. Marcar J en `IDEAS_POST_MVP.md`. Sin código de app
- [ ] **F1 — Shared:** `types/gamification.types.ts` + `schemas/gamification.schema.ts` (`GamificationSummary`, `DailyQuest`, `DailyBoss`, enums, DTO de respuesta) + `lib/gamification.xp.ts` puro (`levelForXp` + constantes de XP/curva) reexportado; `typecheck` verde + rebuild de `dist`
- [ ] **F2 — Prisma + `db push` (BORDE):** 3 modelos + 3 enums + back-relations en `User`/`Topic`; el usuario corre `db push` (Session pooler 5432); verificar tablas vía MCP Supabase
- [ ] **F3 — Backend motor + lectura:** `modules/gamification/` → `gamification.rules.ts` (puro) + repo (sin N+1) + service (`getSummary`: quests/jefe lazy idempotentes, jefe desde `getWeakTopics`) + controller + routes `[self]`; tests de las reglas
- [ ] **F4 — Backend hooks (escritura, delegación limpia):** `gamificationService.onQuizAnswered`/`onQuizCompleted`/`onFlashcardReviewed`/`onPlanItemCompleted`/`onTopicCompleted`; quiz/flashcard/planner delegan detrás de `try/catch` (loguea, nunca relanza); import unidireccional (sin ciclos); tests de efectos + golden de degradación
- [ ] **F5 — Frontend Home gamificada:** `features/gamification/` (api + `useGamificationSummary` + widgets `LevelXpBar`/`StreakBadge`/`DailyMissions`/`BossOfDay`) + rediseño `features/home/`; momentos animados (framer-motion, fallback `prefers-reduced-motion`); `invalidateAfterStudyAction` cableado; 4 estados, i18n es/en, solo tokens
- [ ] **F6 — Verificación (BORDE):** `pnpm -r typecheck`/`lint`/`test` verdes, `git diff --stat` total + log, actualizar `fid.md`. No mergear

---

## 16. REGLA FINAL

> **Si algo no está definido en este documento, NO se implementa sin aprobación explícita y actualización previa de este archivo.**
>
> Cualquier desviación de la arquitectura aquí definida debe ser documentada en `error.md` con justificación técnica.
