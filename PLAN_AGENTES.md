# Bract — Plan de Construcción por Agentes

> Documento maestro para construir el **producto** de Bract (app de estudio con IA) sobre su
> **fundación ya deployada**. Pensado para presentarle el panorama a un chat orquestador y luego
> dividir el trabajo en **agentes de Claude Code** independientes.
>
> **Regla de oro:** cada agente lee primero el "PREÁMBULO COMÚN" (secciones 1–8) y después su
> sección de agente (sección 9). Nadie escribe código sin haber leído `README.md`, `CLAUDE.md`,
> `error.md` y `context.md`.

> **PRECEDENCIA (resolver conflictos entre docs):** para esta fase de construcción del producto,
> el orden de autoridad es: **`context.md` (qué construir) + este `PLAN_AGENTES.md` + `error.md`
> (estado real)** por encima de la letra del `README.md`/`CLAUDE.md`. En concreto:
> 1. Las features de `context.md` (planificador, flashcards, chat) **están APROBADAS** — NO las
>    rechaces por "no están en el README §16". El flujo correcto es **spec-first**: actualizar el
>    README con su spec y luego implementar (no frenarse ni pedir aprobación para empezar).
> 2. **Deploy/DB:** seguí `error.md` (entrada del 2026-06-09) y la sección 7 de este doc:
>    `db push` manual, **Session pooler 5432**, sin migrate en el build. Ignorá cualquier nota que
>    diga "migrate automático" o "puerto 6543".
> 3. `napkin.md` **no es fuente de verdad** y puede no estar en el repo; sus reglas vigentes ya
>    están acá. Si lo ves, ignorá sus notas de deploy (6543 / corepack / migrate-en-build) y su
>    regla de "rechazar features fuera del README".

---

# PREÁMBULO COMÚN (lo lee TODO agente)

## 1. Contexto: qué es Bract y dónde estamos

**Bract es una app de estudio personal con IA.** Tres secciones conectadas por un mismo modelo de
datos (materias, temas, progreso). El diferencial: el contexto compartido — la IA sabe qué estás
estudiando, cuánto avanzaste y qué te falta.

- **Sección 1 — Planificador:** el estudiante carga materias, temas por materia, fecha de examen y
  horas disponibles por día. La IA genera un cronograma semanal que distribuye los temas por
  urgencia (examen más cercano), temas pendientes y horas disponibles. Al marcar temas como
  completados, el plan se recalcula solo; si un día no estudió, se adapta.
- **Sección 2 — Flashcards:** generación automática con IA por tema (pregunta/respuesta), creación
  y edición manual, y repaso espaciado (SRS) — los temas dominados aparecen menos, los difíciles más.
- **Sección 3 — Chat de estudio:** tutor IA que conoce el contexto completo del estudiante
  (materias, temas, progreso, próximo examen). Explica temas simple, resume unidades, genera
  preguntas de práctica, responde dudas y referencia el progreso. Mantiene el hilo por sesión.

**Conexión obligatoria:** materias/temas/progreso son un único conjunto de datos. Las flashcards se
generan sobre los temas del planificador; el chat sabe qué está pendiente/completado y cuándo es el
examen; marcar un tema completado actualiza el contexto del chat y la frecuencia en flashcards.

**Usuario objetivo:** estudiantes de secundaria, universidad o autodidactas, especialmente con
varias materias simultáneas.

### La tensión clave entre documentos
- `README.md` / `CLAUDE.md` describen la **fundación SaaS** (auth, users, profile, notifications,
  analytics, admin, deploy). **Eso YA está construido, deployado y funcionando.**
- `context.md` describe el **producto real** (las 3 secciones de estudio con IA). **Nada de eso
  existe todavía.** Es lo que hay que construir.
- Por la regla del README §0.10 y §16 ("si no está aquí, no se implementa sin actualizar el doc"),
  el primer entregable de cada feature es **actualizar el README** con su spec (modelos, endpoints,
  UI) en el estilo existente, y recién después implementar.

## 2. Estado actual (NO romper)

- **Monorepo pnpm:** `apps/api` (Express + TS + Prisma + Supabase Postgres), `apps/web` (React 18 +
  Vite + Tailwind + Zustand + TanStack Query + React Router 6), `packages/shared` (tipos + Zod).
- **Deployado y funcional:** API en Render (`bract-api.onrender.com`), frontend Static Site en
  Render (`bract-web.onrender.com`), Postgres en Supabase, Upstash Redis (REST), claves JWT RS256.
- **Construido:** auth (registro/login/refresh/me), users (admin CRUD + rol/estado), profile,
  notifications, analytics, admin. Todo andando.
- **Decisiones de arquitectura ya tomadas (ver `error.md`, respetarlas):**
  - **BullMQ → ejecución SÍNCRONA.** Workers conservados pero sin usar; `BULLMQ_REDIS_URL`
    eliminada. Upstash Free no soporta workers BullMQ. Para jobs nuevos: ejecución directa o
    `setInterval` (como el cleanup en `server.ts`).
  - **Deploy en Render (PaaS), no K8s/Docker.** Push a `main` → GitHub Actions → Render auto-deploy.
  - **Esquema gestionado con `prisma db push` (NO hay archivos de migración).** Para modelos nuevos:
    agregarlos a `schema.prisma` → el usuario corre `db push` (ver sección 7).
  - **`packages/shared/package.json` usa exports condicionales:** `node` → `dist` (runtime API),
    `default` → `src` (bundler/web). NO volverlo a `src` para todo, NI a `dist` para todo (rompe uno
    de los dos consumidores).
  - **`apps/web/tsconfig.json` tiene `declaration:false`** (es SPA hoja).
  - **`apps/web/src/vite-env.d.ts` existe** con `/// <reference types="vite/client" />`. Mantenerlo.
- **Build/start de la API:** `build = prisma generate && tsc`, `start = node dist/server.js`,
  `typecheck = prisma generate && tsc --noEmit`. No tocar sin razón.

## 3. Lectura obligatoria antes de escribir una línea (todos)
1. `README.md` — arquitectura/convenciones de la fundación (source of truth técnico).
2. `CLAUDE.md` — reglas de comportamiento, capas, orden de implementación, checklist.
3. `error.md` — log de decisiones. Respetarlas. Documentar ahí toda desviación nueva.
4. `context.md` — visión de producto (qué construir).
5. `napkin.md` — runbook de reglas recurrentes de alto valor.

## 4. Reglas de arquitectura y calidad (todos — del README/CLAUDE/napkin)
- **Capas estrictas:** Controller (solo HTTP, extrae `req`, llama service, responde) → Service
  (lógica, recibe DTOs, **nunca** `req`) → Repository (solo Prisma). Nunca mezclar.
- **Orden de implementación por tarea (8 pasos):** tipos en `packages/shared/src/types/` → Zod en
  `packages/shared/src/schemas/` → Repository → Service → Controller+Routes → frontend `api/` →
  `hooks/` (React Query) → `components/` con los 4 estados.
- **Envelope obligatorio en toda respuesta:** `{ success, data, meta? }` o `{ success, error }`.
- **Toda ruta `/api/v1/`**, protegida con `authenticate` + `authorize`. Todo input externo validado
  con Zod (body, params, query, env).
- **Frontend:** cada componente con `loading (skeleton)` · `empty (EmptyState)` · `error` ·
  `success`. Formularios con React Hook Form + Zod resolver. Imports cross-package vía
  `@bract/shared` (nunca rutas relativas `../../../packages/...`).
- **UI dark-first**, tokens CSS del README §9 (sin colores hardcodeados), interacciones < 100ms,
  Framer Motion para transiciones, i18n (es/en) con i18next.
- **Sin `console.log`** (Winston en backend; silencio en frontend prod). **Sin `any`** sin comentario
  `// DECISIÓN: ...` que lo justifique. **Sin N+1** (usar `select`/`include` explícito).
- **TS estricto — gotchas activos:** `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noPropertyAccessFromIndexSignature`. Por lo tanto:
  - Usar `override` en métodos sobreescritos.
  - Spreadear props opcionales condicionalmente: `{ ...(val != null ? { prop: val } : {}) }`.
  - En componentes de UI, props opcionales que reciben valores possibly-undefined: declarar
    `prop?: T | undefined`.
  - Acceder a env de Vite con bracket notation: `import.meta.env['VITE_X']`.

## 5. Método de verificación — ANTES / DURANTE / DESPUÉS (todos)
Trabajar con cabeza fría: ante cualquier error o duda, **analizar la causa raíz, arreglar, y
verificar de forma aislada antes de seguir**. No adivinar; reproducir/compilar el patrón dudoso.
- **ANTES de cada fase:** releer docs relevantes; definir modelo de datos y endpoints; identificar
  dependencias (qué debe existir primero); **actualizar el README** con la spec de la feature;
  presentar el plan.
- **DURANTE:** seguir el orden de capas; mantener `pnpm -r typecheck`, lint y build en verde;
  verificar envelope y los 4 estados; sin N+1.
- **DESPUÉS de cada fase:** verificar la feature **end-to-end y conectada** con las demás (que el dato
  compartido fluya); typecheck/build/lint verdes; verificar el deploy; documentar decisiones y
  desviaciones en `error.md`.
- **Criterio de "hecho":** no es que cada sección funcione aislada, sino que **las 3 compartan el
  contexto** correctamente (completar un tema afecta plan + flashcards + chat).

## 6. Gobernanza spec-first
Las 3 features del producto NO están en el README. Antes de implementar cada una:
1. Actualizar `README.md` con su spec (modelos, relaciones, endpoints `/api/v1/...`, UI, fase),
   siguiendo el estilo de las secciones existentes (§3 data, §5 API, §8 frontend, §15 fases).
2. Agregar el proveedor de IA al stack del README (§1) y sus env vars (§11).
3. Documentar toda desviación en `error.md` con el formato definido.

## 7. División de trabajo: KEYS y SERVICIOS los maneja el USUARIO (en otro chat)
Los agentes **codean contra env vars** y **NO** intentan obtener keys ni bloquean el build si
faltan (degradar con mensaje claro). Cada agente mantiene visible la lista de env vars nuevas que
requiere (nombre exacto + para qué). El usuario completa por separado:
- **Proveedor de IA (nuevo):** `AI_API_KEY` (o el nombre que defina el Agente B) — planner/flashcards/chat.
- **Cloudflare R2** (avatares/archivos): hoy placeholders.
- **Resend** (emails): hoy placeholder.

### ⚠️ Aclaración crítica sobre la base de datos (corrige una nota de `napkin.md`)
`napkin.md` sugiere usar el **Transaction pooler (puerto 6543, `pgbouncer=true`)** para
`DATABASE_URL`. En la práctica de este proyecto **eso rompe** los cambios de esquema, porque el
schema de Prisma **no tiene `directUrl`** y el transaction pooler no soporta DDL (migraciones /
`db push`). Lo que está funcionando hoy y debe usarse:
- **`DATABASE_URL` = Session pooler, puerto 5432**, host de pooler:
  `postgresql://postgres.PROJECT:PASSWORD@aws-1-REGION.pooler.supabase.com:5432/postgres`
  (sin `?pgbouncer=true`). Sirve tanto para runtime (server persistente) como para `db push`.
- Cuando un agente agregue modelos nuevos a `schema.prisma`, debe indicarle al usuario que corra,
  con esa URL 5432: `cd apps/api && npx prisma db push`. (En Windows CMD: `set DATABASE_URL=...`
  sin comillas; en PowerShell: `$env:DATABASE_URL="..."`.)

## 8. Bugs de la fundación a arreglar (polish, Fase 8 del README)
- **i18n incompleto:** muchos textos hardcodeados (el dashboard entero, "Analytics" en el sidebar)
  no usan traducción → cambiar idioma no los afecta. Completar es/en con i18next.
- **Toggle de idioma (`Header.tsx`):** muestra el idioma DESTINO, no el actual (confuso) — mostrar
  el actual.
- **Perfil:** "Miembro desde Invalid Date" + nombre vacío (revisar `useProfile` y el mapeo de
  `/profile`).
- **Notificaciones:** la campanita muestra contador pero la lista aparece vacía (revisar el query de
  la lista vs `unreadCount`).

---

# 9. LOS AGENTES

## Grafo de dependencias
```
A (Spec + Modelo de datos)  ──►  B (Núcleo de IA)
        │                              │
        ├──────────────┬──────────────┤
        ▼              ▼               ▼
   C (Planner)   D (Flashcards)   E (Chat)
        └──────────────┴──────────────┘
                       ▼
              F (Integración / contexto compartido)
                       ▼
              H (QA end-to-end + deploy)

G (Polish/i18n/bugs)  ──►  puede correr en paralelo, independiente de A–F
```
**Regla de paralelización:** A debe terminar antes que todo. B antes que C/D/E. C, D y E pueden ir
en paralelo una vez listos A y B. F después de C/D/E. G en cualquier momento. H al final.

---

## Agente A — Spec & Modelo de Datos Compartido
**Objetivo:** sentar la base de datos y los tipos sobre los que se construye todo el producto.
**Depende de:** nada (va primero).
**Entregables:**
- Spec en `README.md` de las 3 features (modelos, relaciones, endpoints, UI, fases nuevas).
- Modelos Prisma nuevos en `schema.prisma`, todos **por-usuario** y conectados:
  - `Subject` (materia): `userId`, `name`, `examDate?`, `color?`.
  - `Topic` (tema): `subjectId`, `name`, `status` (pending/in_progress/completed), `difficulty`
    (para SRS), `completedAt?`.
  - `StudyAvailability`: horas disponibles por día (por usuario / por día de semana).
  - `StudyPlan` + `StudyPlanItem`: cronograma generado (día → temas asignados, estado).
  - `Flashcard`: `topicId`, `question`, `answer`, `source` (ai/manual) + estado SRS
    (`ease`, `intervalDays`, `dueDate`, `lastReviewedAt`).
  - `ChatSession` + `ChatMessage`: `userId`, mensajes con `role` (user/assistant) y `content`.
- Tipos en `packages/shared/src/types/` y schemas Zod en `packages/shared/src/schemas/` para todos
  los modelos y sus DTOs.
- Instrucción al usuario para correr `prisma db push` (sección 7).
**Reglas específicas:** definir relaciones con `onDelete` correctos; índices para queries por
`userId` y por `dueDate` (SRS). Respetar `@@map` (snake_case en tablas, como el resto).
**Criterio de hecho:** `prisma generate` + `pnpm -r typecheck` verdes; `db push` aplicado; el README
refleja la spec; los tipos/Zod exportados desde `@bract/shared`.

## Agente B — Núcleo de IA (servicio compartido)
**Objetivo:** una capa de IA reutilizable por planner, flashcards y chat.
**Depende de:** A (necesita los tipos del modelo para ensamblar contexto).
**Entregables:**
- `apps/api/src/lib/ai.service.ts` (o módulo equivalente): abstracción del proveedor detrás de una
  env var (`AI_API_KEY`); funciones tipadas para: generar plan, generar flashcards, responder chat
  (con streaming si el proveedor lo permite).
- Un **ensamblador de contexto** que arma, a partir de los datos del usuario (materias, temas,
  progreso, próximo examen), el prompt/contexto que reciben las 3 features.
- Manejo de errores y rate limiting de IA; degradación clara si falta `AI_API_KEY`.
- Documentar en README §1 (stack) y §11 (env vars) el proveedor elegido y `AI_API_KEY`.
**Reglas específicas:** la key SIEMPRE por env, nunca hardcodeada; el SDK del proveedor es la única
librería nueva permitida fuera del stack del README, y debe documentarse en `error.md`.
**Criterio de hecho:** funciones tipadas y testeadas con mock; typecheck verde; lista de env vars
nuevas comunicada al usuario.

## Agente C — Planificador
**Objetivo:** CRUD de materias/temas/disponibilidad + generación y recálculo del cronograma.
**Depende de:** A, B.
**Entregables (backend, por capas):** repositorios de Subject/Topic/Availability/Plan; servicios con
la lógica de distribución (urgencia por fecha de examen + temas pendientes + horas/día) que invoca a
B para el plan; controllers + rutas `/api/v1/...` con envelope. Endpoint de **recálculo** disparado
al completar un tema o al perder un día.
**Entregables (frontend):** `features/planner/` con `api/`, `hooks/` (React Query), componentes con
los 4 estados; vista día por día; marcar tema completado → recálculo reactivo; entrada en el sidebar
(con i18n) dentro del `DashboardShell`.
**Criterio de hecho:** crear materia/tema/horas → generar plan → completar tema → el plan se
recalcula; 4 estados; typecheck/lint verdes.

## Agente D — Flashcards + SRS
**Objetivo:** generación con IA + CRUD manual + motor de repaso espaciado.
**Depende de:** A, B.
**Entregables (backend):** repos/servicios/rutas de Flashcard; endpoint de generación por tema (usa
B); **motor SRS** (ej. SM-2 simplificado) con endpoint "revisar" que actualiza `ease`/`intervalDays`/
`dueDate` según la calificación; endpoint para traer las cartas "due".
**Entregables (frontend):** `features/flashcards/`; UI de estudio (mostrar carta → revelar →
calificar), creación/edición manual; los temas difíciles aparecen más seguido; 4 estados; entrada en
sidebar (i18n).
**Criterio de hecho:** generar cartas de un tema → estudiar → calificar → el `dueDate` cambia y el
orden de aparición refleja la dificultad; typecheck/lint verdes.

## Agente E — Chat de Estudio
**Objetivo:** tutor IA con contexto del estudiante + persistencia de conversación.
**Depende de:** A, B.
**Entregables (backend):** repos/servicios/rutas de ChatSession/ChatMessage; endpoint de mensaje que
ensambla el contexto (vía B) y llama al proveedor (streaming si se puede); persistencia del hilo.
**Entregables (frontend):** `features/chat/`; UI de chat con hilo por sesión; manejo de streaming;
4 estados; entrada en sidebar (i18n).
**Criterio de hecho:** el chat responde conociendo materias/temas/progreso/examen del usuario y
mantiene el hilo; typecheck/lint verdes.

## Agente F — Integración y Contexto Compartido (el diferencial)
**Objetivo:** garantizar que las 3 secciones compartan datos y contexto en vivo.
**Depende de:** C, D, E.
**Entregables:** invalidaciones/refetch cruzados (React Query) y/o efectos de dominio para que:
completar un tema en el planner → actualice el contexto del chat y la frecuencia SRS de sus
flashcards; las flashcards se generen solo sobre temas del planner; el chat referencie el progreso
real. Revisar que no haya duplicación de fuente de verdad (materias/temas/progreso = un solo lugar).
**Criterio de hecho:** un cambio en una sección se refleja correctamente en las otras dos, sin
recargar manualmente; verificado end-to-end.

## Agente G — Polish, i18n y Bugs de la Fundación
**Objetivo:** dejar la fundación pulida (Fase 8 README). Independiente de A–F.
**Depende de:** nada (paralelizable).
**Entregables:** arreglar los 4 bugs de la sección 8 (i18n hardcodeado + toggle de idioma + fecha/
nombre del perfil + lista de notificaciones); completar traducciones es/en de toda la UI nueva y
vieja; error boundaries por feature; revisar tokens de color hardcodeados.
**Criterio de hecho:** cambiar idioma afecta TODA la UI; perfil muestra fecha/nombre correctos;
notificaciones listan lo que el contador indica; typecheck/lint verdes.

## Agente H — QA End-to-End y Deploy
**Objetivo:** validar el sistema completo, conectado, y verificar el deploy.
**Depende de:** F (y G si ya está).
**Entregables:** recorrido end-to-end de las 3 secciones conectadas; checklist del CLAUDE.md;
`pnpm -r typecheck` + lint + build verdes; verificación de los 3 jobs de CI; verificación del deploy
en Render (API + web); smoke test de los flujos clave; actualización final de `error.md` y README.
**Criterio de hecho:** todo verde en CI, deploy live, las 3 secciones funcionan conectadas en
producción, sin estados rotos.

---

# 10. Primer paso del orquestador (antes de codear)
No escribir código todavía. El orquestador (o el Agente A) debe:
1. Leer los 5 documentos (sección 3).
2. Devolver: (a) resumen del estado actual encontrado, (b) la spec propuesta del modelo de datos
   compartido (modelos Prisma + relaciones + índices), (c) el plan de fases detallado por agente.
3. Esperar OK del usuario antes de implementar.

# 11. Recordatorio de éxito
El criterio final no es "cada sección anda", sino que **todo esté conectado, estético, performante y
plenamente funcional** — con el contexto compartido entre planner, flashcards y chat como corazón
del producto.

---

# APÉNDICE A — Plantilla de arranque por agente (copiar/pegar)
Todos los docs están en el repo, así que no hace falta pegarlos: alcanza con apuntar al agente a
`PLAN_AGENTES.md` y decirle cuál es. Mensaje sugerido para cada agente:

```
Sos el **Agente <X> — <nombre>** del proyecto Bract.
1. Leé COMPLETO `PLAN_AGENTES.md` (preámbulo secciones 1–8 + tu sección en 9 + apéndices) y los
   docs que referencia: README.md, CLAUDE.md, error.md, context.md, napkin.md.
2. Respetá spec-first: actualizá el README con la spec de tu feature ANTES de implementar.
3. NO escribas código hasta devolverme: (a) resumen del estado actual relevante a tu agente,
   (b) la spec/plan detallado de tu fase, (c) las env vars nuevas que vas a necesitar.
   Espero mi OK explícito antes de implementar.
4. Trabajá por capas (orden de 8 pasos), mantené `pnpm -r typecheck` + lint + build en verde,
   y verificá antes/durante/después. Documentá decisiones en error.md.
```

# APÉNDICE B — Especificación del SRS (para el Agente D)
Algoritmo SM-2 simplificado. Cada `Flashcard` tiene `ease` (default 2.5), `intervalDays` (default 0),
`dueDate`, `lastReviewedAt`.
- En cada repaso el usuario califica con calidad `q` (mapear botones: Again=0, Hard=3, Good=4, Easy=5).
- Si `q < 3`: `intervalDays = 1`, `ease = max(1.3, ease - 0.2)` (la carta vuelve pronto).
- Si `q >= 3`:
  - 1er repaso exitoso → `intervalDays = 1`; 2do → `6`; siguientes → `round(intervalDays * ease)`.
  - `ease = max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))`.
- `dueDate = now + intervalDays`. El endpoint "due" trae cartas con `dueDate <= now`.
- La `difficulty` del `Topic` puede sesgar el `ease` inicial de sus cartas (temas difíciles → ease menor).

# APÉNDICE C — Contratos de IA (para el Agente B y consumidores)
La capa de IA expone funciones tipadas y **valida la salida con Zod** (la IA puede devolver basura):
- **Generar plan:** entrada = materias (con `examDate`), temas pendientes (con `difficulty`),
  disponibilidad (horas/día). Salida JSON: `[{ date, items: [{ topicId, estimatedMinutes }] }]`.
  La distribución base (urgencia + pendientes + horas) puede calcularse en código y usar la IA para
  afinar/ordenar; validar que todo `topicId` exista y que las horas/día no se excedan.
- **Generar flashcards:** entrada = nombre del tema + contexto de la materia. Salida JSON:
  `[{ question, answer }]`, con un tope de cantidad (ej. 10) y deduplicación.
- **Chat:** system prompt = resumen del contexto del estudiante (materias, temas pendientes/
  completados, próximo examen) + instrucción de tutor. Stream de tokens si el proveedor lo permite;
  persistir cada mensaje en `ChatMessage`. Limitar tamaño del contexto (no mandar toda la DB).
- **Resiliencia:** timeouts, reintentos acotados, y degradación clara si falta `AI_API_KEY` o el
  proveedor falla (nunca romper la app — devolver error manejado con envelope).

# APÉNDICE D — Cómo ejecutar los agentes (modelo, esfuerzo, paralelización)

**Qué pegarle a cada agente:** solo el mensaje del Apéndice A (indicando qué agente es). NO hace
falta pegar los demás archivos — están en el repo y `CLAUDE.md` lo carga Claude Code solo.
⚠️ Antes de arrancar, asegurate de que `context.md`, `napkin.md` y `PLAN_AGENTES.md` estén
**commiteados en el repo** (no solo en tu compu), para que los agentes los lean.

**Modelo recomendado:**
- **Opus** (el más capaz) para los agentes de diseño/integración/QA: **A, B, F, H**.
- **Opus o Sonnet** para los de implementación de features: **C, D, E, G** (Sonnet si querés más
  velocidad/costo; Opus si priorizás calidad — para un producto "óptimo", Opus en todos es lo ideal).

**Nivel de esfuerzo / thinking:**
- **Alto** (pensamiento extendido, "think hard") para **A** (modelo de datos), **B** (IA),
  **F** (integración) y **H** (QA): son los que más razonamiento y verificación requieren.
- **Medio** para **C, D, E, G** (implementación más mecánica siguiendo el patrón de capas).

**Secuencia y paralelización (respetar el grafo de la sección 9):**
1. **A solo, primero.** Todo depende del modelo de datos.
2. **B después de A.**
3. **C, D, E** pueden ir en paralelo **solo si** cada uno trabaja en su propia **rama o git
   worktree** — tocan archivos compartidos (`schema.prisma`, sidebar, router, i18n) y en el mismo
   working tree se pisan. Si no usás worktrees, corrélos **secuencial** (C → D → E).
4. **F** después de C/D/E (mergeados).
5. **G** en paralelo en su propia rama (es independiente de A–F).
6. **H** al final, sobre todo ya integrado.

**Control de calidad entre agentes:** exigí a cada uno que (a) presente el plan antes de codear,
(b) deje typecheck/lint/build en verde, y (c) actualice `error.md`. Revisá/mergeá rama por rama;
no dejes que varios agentes pusheen a `main` a la vez sin pasar por PR/merge ordenado.
