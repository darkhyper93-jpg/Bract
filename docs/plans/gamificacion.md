# Plan — Agente J: Gamificación (v1 acotado)

## Context

Bract es un SaaS de estudio con un loop adaptativo ya completo y deployado: importar → plan
del día → estudiar (flashcards/SRS + chat) → evaluarse (quiz) → puntos débiles (I-2) → re-plan.
Todo eso ya emite señales de aprendizaje reales que hoy **no alimentan ninguna capa de juego**.

El objetivo (J en `IDEAS_POST_MVP.md` + notas de engagement en `VISION_FUTURO.md §4`) es convertir
el estudio en una experiencia tipo videojuego que **se sienta y se vea** como un juego (estética
vibrante sobre los tokens oscuros de Bract + identidad codex.io), **premiando aprender de verdad
(dominio/retención), nunca actividad vacía ni métricas de vanidad**. Dirección visual y alcance ya
aprobados con el usuario (boceto: nivel + barra de XP, racha perdonadora, misiones diarias atadas a
acciones reales, y un "jefe del día" = el tema más flojo de I-2).

**Decisiones del usuario que fijan el alcance del v1:**
1. **Superficie:** se gamifica el **`/home` actual** (la Home de `§8.10` pasa a ser el tablero de
   juego). Una sección dedicada `/arena` queda para fases futuras.
2. **Economía de XP:** atada a aprender — XP por **completar quiz**, **repasar flashcards vencidas**
   y **cumplir items del plan del día**, con **bonus por dominio** (aciertos, vencer al jefe).
   **CERO XP por abrir la app o actividad vacía.** Topes diarios anti-farmeo.
3. **Racha PERDONADORA:** un día perdido no resetea con culpa — mecanismo de gracia (escudos/día de
   perdón automáticos) + framing amable. Nunca cuesta XP ni nivel.
4. **Logros/insignias:** fuera del v1.
5. **Identidad visual:** tokens oscuros de Bract (`§9.2`) + referencia codex.io. La skill
   `ui-ux-pro-max` se usa **solo** como insumo universal (estilo/animación/checklist QA); se
   descarta su recomendación de paleta/tipografía infantil (Baloo 2 / Comic Neue).

**v1 = XP + niveles + misiones diarias + racha perdonadora + jefe del día + home gamificada,
100% determinista (sin IA → barato y free-tier-safe).**
Fases posteriores (fuera de este plan): logros/insignias, ligas, avatar evolutivo, misiones
adaptadas a metas/horarios, sección `/arena`, feed/historial de XP.

---

## 1. Eventos del sistema que ya existen (de dónde sale el XP, sin reinventar)

La gamificación se engancha como **efecto de dominio cruzado detrás del service dueño de cada dato**,
exactamente el patrón ya probado del **Agente F** (`plannerService.updateTopicStatus` delega en
`flashcardService.onTopicStatusChanged`). Cada hook va **detrás de `try/catch`**: si la gamificación
falla, la feature deployada se comporta idéntico a hoy (nunca tumba quiz/flashcards/planner).

| Acción real | Hook-point exacto (ya existe) | Señal para el juego |
|---|---|---|
| Responder pregunta de quiz | `quizService.answer` (`apps/api/src/modules/quiz/quiz.service.ts:284`) — MCQ con `isCorrect`; OPEN registra | XP por responder + **bonus si correcta**; daño al jefe si el item es del tema-jefe |
| Corregir pregunta abierta | `quizService.gradeOpenItem` (`quiz.service.ts:378`) — `grade` CORRECT/PARTIAL/INCORRECT | bonus por CORRECT (PARTIAL = medio); daño al jefe |
| Completar un quiz | última respuesta → `QuizAttempt.status=COMPLETED` (en `quiz.repository`) | **XP de "completar quiz"** (fuente principal) + progreso de misión |
| Repasar flashcard **vencida** (SRS) | `flashcardService.review` (`apps/api/src/modules/flashcards/flashcard.service.ts:193`) — `quality 0/3/4/5` | XP solo si la carta estaba **due** (anti-farmeo); bonus si recuerdo OK (`q≥4`); daño al jefe |
| Completar item del plan del día | `plannerService.updatePlanItem` (`apps/api/src/modules/planner/planner.service.ts:348`), status `COMPLETED` | XP por cumplir el plan + progreso de misión |
| Completar/dominar un tema | `plannerService.updateTopicStatus` (`planner.service.ts:300`), status `COMPLETED` | XP de dominio (mayor) |
| **Jefe del día** (lectura) | `progressService.getWeakTopics(userId, limit)` (`apps/api/src/modules/progress/progress.service.ts:132`) | el tema más flojo de I-2 → jefe; sin datos ⇒ sin jefe (EmptyState) |

Lecturas que la Home ya consume y se reusan tal cual (cero endpoints nuevos para eso):
`useProgressOverview`/`useWeakTopics` (I-2), `useSubjects` (árbol), `usePlan` (plan de hoy).

---

## 2. Modelo de datos (Prisma nuevo → requiere `db push`)

Convenciones del repo: `cuid()`, `userId` denormalizado, `@@map` snake_case, índices por usuario,
enums espejados a `@bract/shared` con `z.nativeEnum`. **El `level` NO es columna**: es función pura
de `totalXp` (`levelForXp`, patrón `srs.ts`/`progress.formula.ts`) → sin drift. Nueva sección
README **§3.7**.

```prisma
// ===== GAMIFICACIÓN (Agente J) =====

model GamificationProfile {            // 1:1 con User — el "jugador"
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  totalXp         Int      @default(0)   // autoritativo (agregado); level = levelForXp(totalXp)
  currentStreak   Int      @default(0)
  longestStreak   Int      @default(0)
  lastStudyDate   DateTime?              // día (UTC) de la última acción que cuenta
  freezeTokens    Int      @default(0)   // escudos de gracia (racha perdonadora)
  xpEarnedToday   Int      @default(0)   // tope diario anti-farmeo de XP "por acción"
  xpTodayDate     DateTime?              // día al que corresponde xpEarnedToday (se resetea al cambiar)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@map("gamification_profiles")
}

model DailyQuest {                      // misiones diarias generadas desde acciones reales
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime    @db.Date       // día de la misión (sin hora)
  type        QuestType
  target      Int
  progress    Int         @default(0)
  status      QuestStatus @default(ACTIVE)
  xpReward    Int
  completedAt DateTime?
  createdAt   DateTime    @default(now())
  @@unique([userId, date, type])        // un set por día, idempotente
  @@index([userId, date])
  @@map("daily_quests")
}

model DailyBoss {                        // jefe del día = tema más flojo (I-2)
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  date        DateTime   @db.Date
  // FK de agrupación, NO ownership (patrón QuizAttempt §3.5) → SetNull preserva historial.
  topicId     String?
  topic       Topic?     @relation(fields: [topicId], references: [id], onDelete: SetNull)
  topicName   String                     // snapshot legible
  subjectName String                     // snapshot legible
  maxHp       Int                        // "vida" = nº de interacciones de dominio en el tema-jefe
  hp          Int                        // restante (llega a 0 = vencido)
  status      BossStatus @default(ACTIVE)
  xpReward    Int
  defeatedAt  DateTime?
  createdAt   DateTime   @default(now())
  @@unique([userId, date])
  @@index([userId, date])
  @@map("daily_bosses")
}

enum QuestType { COMPLETE_QUIZ  REVIEW_DUE_CARDS  COMPLETE_PLAN_ITEMS  DEFEAT_BOSS }
enum QuestStatus { ACTIVE  COMPLETED }
enum BossStatus  { ACTIVE  DEFEATED }
```

**Back-relations en `User`** (solo relaciones): `gamificationProfile GamificationProfile?` ·
`dailyQuests DailyQuest[]` · `dailyBosses DailyBoss[]`. En `Topic`: `dailyBosses DailyBoss[]`.

**Por qué 3 tablas y no menos:** el perfil es el estado del jugador (agregado autoritativo, como el
estado SRS vive en `Flashcard`); quests y boss son por-día con `@@unique` para regenerar idempotente.
**Sin tabla-ledger de XP en v1** (el feed/historial de "+X XP" se difiere): el tope diario se enforce
con `xpEarnedToday`/`xpTodayDate` en el perfil (más barato, sin tabla que crezca). Trade-off
documentado en `error.md`; si en v2 se quiere historial de XP, se agrega un `XpEvent`.

**`db push`:** lo corre el usuario (Session pooler **5432**, no 6543) — **es un borde de revisión**
(parar antes y después). Patrón ya usado en I/I-2/Fase 18 (ver `error.md` 2026-06-09 + `fid.md`).

---

## 3. Economía de XP y mecánicas (deterministas, en `gamification.rules.ts` puro)

Toda la "matemática del juego" vive en un módulo **puro y testeable** (sin DB/HTTP/reloj),
patrón `srs.ts` + `progress.formula.ts`. Constantes con nombre → fáciles de tunear.

**Fuentes de XP (solo aprendizaje; valores iniciales, tuneables):**
```
Repasar flashcard VENCIDA (due):        +2 XP   · bonus recuerdo OK (q≥4): +3
Responder pregunta de quiz:             +2 XP   · bonus si CORRECTA:       +5
Abierta corregida CORRECT:              +12 XP  · PARTIAL: +6  · INCORRECT: +0 bonus
Completar un quiz (attempt COMPLETED):  +15 XP
Completar item del plan del día:        +10 XP
Completar/dominar un tema:              +30 XP
Vencer al jefe del día:                 +50 XP
Abrir la app / actividad sin acierto:    0 XP   (regla dura)
```
- **Anti-farmeo:** las flashcards solo dan XP si estaban **due** (el SRS ya empuja la carta al futuro,
  así que no se puede repetir la misma carta). Además **tope diario** de XP "por acción"
  (`DAILY_ACTION_XP_CAP`, p.ej. 300): los premios de misión/jefe son finitos por día (1 set) → no
  necesitan tope aparte. Completar el mismo quiz no se recompensa dos veces (el attempt ya está
  COMPLETED; el lock anti-trampa impide re-responder).

**Niveles:** `levelForXp(totalXp)` con curva creciente suave, p.ej. XP acumulado para nivel `n` =
`round(50 · n^1.6)` (Lv.2≈150, Lv.5≈660, Lv.10≈2000). Función pura **compartida en `@bract/shared`**
para que front y back coincidan (la barra de XP del front no recalcula distinto al server). Devuelve
`{ level, xpIntoLevel, xpForNextLevel }`.

**Misiones diarias (3/día, generadas desde acciones reales):** se generan **lazy al leer el summary**
(no hace falta un cron) de forma determinista para `(userId, date)`. v1 = targets **fijos sensatos**,
sin IA (adaptarlas a metas/horarios = fase posterior):
- `COMPLETE_QUIZ` (target 1) · `REVIEW_DUE_CARDS` (target 10) · `COMPLETE_PLAN_ITEMS` (target 2).
- Si hay jefe → una de las 3 puede ser `DEFEAT_BOSS`. Completar misión = XP inmediato + momento
  animado (sin paso de "reclamar" en v1).

**Racha PERDONADORA (`applyStreakOnActivity`, pura):**
- Cuenta días con ≥1 acción que cuenta. `lastStudyDate==hoy` → sin cambio; `==ayer` → `streak++`.
- **Día perdido con `freezeTokens>0`** → consume 1 escudo, la racha **continúa** (lastStudyDate=hoy).
- **Sin escudos** → la racha arranca de nuevo en 1 **sin penalizar XP/nivel** y con framing amable
  ("empezá una racha nueva hoy"); `longestStreak` se preserva y se celebra el récord.
- **Ganar escudos:** +1 cada 5 días activos, cap 2 (`FREEZE_EARN_EVERY=5`, `FREEZE_CAP=2`).

**Jefe del día (`DailyBoss`):** al leer el summary, si no existe el de hoy se crea desde
`getWeakTopics(userId, 1)` (el tema más flojo). `maxHp = BOSS_HP` (p.ej. 5). Cada **interacción de
dominio sobre el tema-jefe** (respuesta de quiz correcta **o** repaso SRS con `q≥4` de una carta de
ese tema) hace **1 de daño**; `hp→0` ⇒ `DEFEATED` + `xpReward` + momento animado. **Sin datos de
debilidad ⇒ no hay jefe** (la Home muestra un EmptyState "seguí estudiando para que aparezca un jefe").

---

## 4. Enfoque visual y animaciones (feel de juego de primera clase)

**Identidad:** dark-first de Bract (`§9.2`) + energía de juego al estilo codex.io. Se agrega un set
chico de **tokens de acento de juego** como CSS vars (no hardcodear): `--xp-gold`, `--streak-flame`,
`--boss-crimson`, `--level-glow` (variantes que respetan contraste 4.5:1). Documentados en README §9.2.
**Iconos = SVG** (flama/escudo/espada/nivel), nunca emojis (regla skill `no-emoji-icons`).

**Componentes (`features/gamification/components/`, consumidos por la Home):**
- `LevelXpBar` — nivel + barra de XP animada (anima `transform/opacity`, no width directo) con framer-motion.
- `StreakBadge` — flama + contador + escudos; framing amable; tooltip explicando los escudos.
- `DailyMissions` — 3 filas con barra de progreso; check animado + toast "+X XP" al completar.
- `BossOfDay` — card con HP bar que se vacía; nombre del tema-jefe + materia; CTA "Enfrentar" → quiz
  enfocado en ese tema (deep-link a `/quiz` con el set de temas = [tema-jefe], reusa el setup existente).

**Momentos animados (clase primaria, 1–2 elementos por vista máx — regla skill `excessive-motion`):**
- **Subir de nivel:** overlay con glow + pop del número + burst corto (framer-motion, **sin libs nuevas**).
- **Completar misión:** check de la fila + toast XP.
- **Vencer al jefe:** HP a 0 + flash/shake + "¡Jefe vencido! +50 XP".

**Reglas de animación (de la skill, no negociables):** `prefers-reduced-motion` ⇒ fallback estático
(badge/texto, sin movimiento); ease-out al entrar / ease-in al salir; 150–300ms en micro; nada de
loops decorativos infinitos; `cursor-pointer` + focus visible en todo lo clickeable.

**Cómo el front sabe qué animar (decisión, reversible):** los endpoints de acción
(quiz/flashcards/planner) **NO cambian su contrato** (respeta sus specs). Tras una acción que cuenta,
los hooks de mutación invalidan `gamification.summary` (helper central
`invalidateAfterStudyAction(qc)` en `apps/web/src/lib/`, patrón `invalidateStudyContext.ts`). El front
**diffea** el summary previo vs el nuevo (subió de nivel / racha / misión recién COMPLETED / jefe
DEFEATED) y dispara el momento animado. Trade-off: un refetch; a cambio, backend desacoplado. Si
luego se quiere precisión sin refetch, los hooks pueden devolver un delta en `meta` (cambio aditivo).

---

## 5. Endpoints (README §5.5, todas `[self]`)

```
GAMIFICACIÓN (Agente J)
GET  /api/v1/gamification/summary   [self]  // perfil (xp, level derivado, racha, escudos) +
                                            // misiones de hoy + jefe de hoy (las genera lazy si faltan)
```
Solo lectura desde el cliente. El XP/quests/boss/racha se mutan **server-side por efecto** de las
acciones reales (hooks F4), nunca por un POST directo del cliente (anti-trampa: el cliente no puede
"darse" XP). Envelope `{ success, data }` estándar.

---

## 6. Plan por fases (supervisado: parar en bordes, NO mergear, diff por fase)

- **F0 — Spec-first (README):** §3.7 (3 modelos + 3 enums + back-relations + reglas), §5.5
  (`GET /gamification/summary`), §8.11 (Home gamificada: rediseño de la §8.10 sobre eventos existentes),
  §9.2 (tokens de acento de juego), **Fase 19**. Marcar J en `IDEAS_POST_MVP.md`. Sin código de app.
- **F1 — `@bract/shared`:** `types/gamification.types.ts` + `schemas/gamification.schema.ts`
  (`GamificationSummary`, `DailyQuest`, `DailyBoss`, enums, DTO de respuesta) + **`lib/gamification.xp.ts`
  puro compartido** (`levelForXp`, constantes de XP/curva) reexportado en `index.ts`. `typecheck` verde.
- **F2 — Prisma + `db push` (BORDE de revisión):** 3 modelos + enums + back-relations en `User`/`Topic`.
  El usuario corre `db push` (Session pooler 5432). **Parar para revisión** (verifico tablas vía MCP Supabase).
- **F3 — Backend motor + lectura:** `apps/api/src/modules/gamification/` →
  `gamification.rules.ts` (puro: XP, `levelForXp`, racha/escudos, templates de misión, params del jefe) +
  `gamification.repository.ts` (Prisma, sin N+1) + `gamification.service.ts` (`getSummary`: asegura
  quests/boss de hoy de forma idempotente, lee `getWeakTopics` para el jefe) + controller + routes `[self]`.
  Tests de `gamification.rules.ts` (XP capeado, curva de nivel, racha con/sin escudos, daño al jefe).
- **F4 — Backend hooks de evento (escritura, delegación limpia, `try/catch`):** `gamificationService`
  expone `onQuizAnswered` / `onQuizCompleted` / `onFlashcardReviewed` / `onPlanItemCompleted` /
  `onTopicCompleted`. `quiz.service`/`flashcard.service`/`planner.service` **delegan** (un `await`
  detrás de `try/catch` que loguea con Winston y nunca relanza). Import unidireccional hacia
  `gamification` (sin ciclos). Tests de los efectos (XP, avance de misión, daño/derrota del jefe, racha).
- **F5 — Frontend Home gamificada:** `features/gamification/` (api + hook `useGamificationSummary` +
  widgets) y rediseño de `features/home/HomePage.tsx`: arriba el tablero de juego (`LevelXpBar`,
  `StreakBadge`, `DailyMissions`, `BossOfDay`), debajo las secciones actuales (progreso/materias/plan).
  Momentos animados (framer-motion) con fallback `prefers-reduced-motion`; tokens nuevos; i18n es/en
  (`home.*` + `gamification.*`); 4 estados por sección; `invalidateAfterStudyAction` cableado en los
  hooks de mutación de quiz/flashcards/planner.
- **F6 — Verificación:** `pnpm -r typecheck` · `lint` · `test` verdes; `git diff --stat`; actualizar
  `fid.md`. **No mergear** (ff-only a main lo da el usuario tras revisar).

**Fuera del v1 (fases posteriores):** logros/insignias, ligas, avatar evolutivo, misiones adaptadas a
metas/horarios, sección `/arena`, ledger/historial de XP, delta de gamificación inline en `meta`.

---

## 7. Verificación end-to-end

- `gamification.rules.ts` y `lib/gamification.xp.ts`: tests puros (curva de nivel, tope diario, racha
  con escudo / sin escudo / mismo día / día siguiente, daño al jefe, derrota).
- Efectos: tests de `onQuizAnswered`/`onFlashcardReviewed`/`onPlanItemCompleted` (mockeando repos):
  XP correcto, avance de misión, daño al jefe solo si el tema coincide, racha actualizada.
- **Degradación (golden):** si el módulo de gamificación lanza, quiz/flashcards/planner responden
  **idéntico a hoy** (el `try/catch` aísla); sin datos de I-2 ⇒ sin jefe (EmptyState), sin romper.
- Manual: completar un quiz / repasar cartas due / completar un item del plan → ver subir XP, avanzar
  misiones, bajar HP del jefe y, al llegar a 0, el momento de "jefe vencido". Verificar
  `prefers-reduced-motion` (sin animación) y responsive (375/768/1024/1440).
- Checklist CLAUDE.md (capas, Zod, envelope, 4 estados, sin `console.log`, sin `any`) + checklist QA de
  la skill (no emojis como iconos, focus visible, transiciones 150–300ms, contraste 4.5:1).

---

## 8. Dudas / decisiones a confirmar (no bloquean el v1; defaults sensatos)

1. **"Vencer al jefe" — qué cuenta y cuánta vida.** Default: `maxHp=5`; daño 1 por **respuesta de
   quiz correcta** o **repaso SRS `q≥4`** de una carta **del tema-jefe**.
2. **Curva de nivel y valores de XP.** Defaults: `round(50·n^1.6)` y la tabla de XP de §3 (tuneable).
3. **Escudos de racha.** Default: +1 cada 5 días activos, cap 2; sin escudos un día perdido reinicia
   a 1 (sin costo de XP/nivel, récord preservado).
4. **Misiones fijas vs escaladas al plan.** v1 con targets fijos (1 quiz / 10 cartas / 2 items);
   adaptar a metas/horarios = fase posterior.
5. **Contrato de acción intacto + refetch del summary** (recomendado) vs delta de gamificación en
   `meta` de cada acción. v1 = refetch (más simple, desacoplado).
6. **Iconos:** SVG inline / set existente (no emojis). Si no hay preferencia, SVG inline (cero deps).

---

## Estado de ejecución (checkpoint para retomar)

- [x] Plan aprobado y commiteado en `docs/plans/gamificacion.md` (branch `agente-j-gamificacion`).
- [ ] F0 — Spec-first (README + IDEAS)
- [ ] F1 — `@bract/shared` contract + XP lib
- [ ] F2 — Prisma + `db push` ← **BORDE DE REVISIÓN (esperar al usuario)**
- [ ] F3 — Backend motor + lectura
- [ ] F4 — Backend hooks de evento
- [ ] F5 — Frontend Home gamificada
- [ ] F6 — Verificación ← **BORDE DE REVISIÓN final (git diff --stat, no mergear)**
