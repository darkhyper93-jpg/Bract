# I-2 — Progreso, puntos débiles y personalización — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir los datos ya persistidos (quiz `QuizAttemptItem` + SRS `Flashcard`) en una señal de **debilidad por tema**, exponerla en un dashboard `/progress`, y usarla de forma **aditiva** para priorizar el planner y enriquecer el chat — todo personalizable vía `UserStudyPreferences`.

**Architecture:** Motor de progreso **read-only on-the-fly** (Prisma `groupBy`, sin tabla de caché, sin N+1). Un único service reusable (`progressService`) expone overview, weak-topics y un `weaknessMap`. Planner (capa 2) y chat (capa 3) consumen el `weaknessMap` detrás de `try/catch` con campos **opcionales** → sin datos = comportamiento byte-idéntico a hoy. Único `db push`: `UserStudyPreferences`.

**Tech Stack:** TypeScript estricto, Zod, Prisma 5.22 (Postgres), Express (capas controller/service/repository), Vitest (backend), React 18 + React Query + Tailwind tokens + recharts + i18next (web).

**Spec de referencia:** `README.md` §3.6 (modelos, fórmula, blend, degradación) · §5.5 (rutas) · Fase 15.

---

## File Structure

**Shared (`packages/shared/src/`)**
- Create `types/progress.types.ts` — enum `RemediationIntensity`, `TopicProgress`, `SubjectProgress`, `ProgressOverview`, `WeakTopic`, `UserStudyPreferences`.
- Create `schemas/progress.schema.ts` — `updatePreferencesSchema`, `weakTopicsQuerySchema`, constantes default + tipos inferidos.
- Modify `index.ts` — exportar ambos.

**Backend (`apps/api/src/`)**
- Create `modules/progress/progress.formula.ts` — pura (sin Prisma/HTTP): fórmula de debilidad + `resolvePreferences` + constantes (`INTENSITY_ALPHA`, `MIN_ANSWERS`, …).
- Create `modules/progress/progress.repository.ts` — `groupBy` quiz + SRS + árbol materias/temas (solo Prisma).
- Create `modules/progress/progress.service.ts` — `getOverview`, `getWeakTopics`, `getWeaknessMap` (DTOs, no req).
- Create `modules/progress/progress.controller.ts` + `progress.routes.ts`.
- Create `modules/preferences/preferences.repository.ts` + `preferences.service.ts` + `preferences.controller.ts` + `preferences.routes.ts`.
- Create `modules/progress/__tests__/progress.formula.test.ts` y `progress.service.test.ts`.
- Modify `prisma/schema.prisma` — modelo `UserStudyPreferences` + enum + back-relation en `User`.
- Modify `server.ts` — montar `progressRouter` y `preferencesRouter`.
- Modify `lib/ai/ai.service.ts` — `GeneratePlanInput` aditivo (`remediationAlpha?`, `topics[].weakness?`, `prioritySubjectIds?`) + blend en `buildBaselinePlan` con DOS términos separados (debilidad + prioridad) + constantes nudge.
- Modify `modules/planner/planner.service.ts` — `buildPlanInput` enriquece con weakness/α (try/catch).
- Modify `lib/ai/ai.context.ts` — `StudentContext.weakTopics?` + render condicional.
- Modify `modules/chat/chat.service.ts` — pasar weakTopics (try/catch).
- Modify `modules/planner/__tests__/planner.distribution.test.ts` y `lib/ai/__tests__/ai.context.test.ts` — golden "sin datos = hoy".

**Web (`apps/web/src/`)**
- Create `features/progress/api/progress.api.ts`, `hooks/useProgress.ts`, `hooks/usePreferences.ts`.
- Create `features/progress/components/ProgressPage.tsx`, `SubjectProgressCard.tsx`, `WeakTopicsList.tsx`, `PreferencesPanel.tsx`, `index.ts`.
- Create `features/progress/schemas/preferences.form.schema.ts`.
- Modify `router/index.tsx` (ruta `/progress`), `components/layout/Sidebar.tsx` (nav item), `lib/i18n.ts` (`nav.progress` + namespace `progress` en/es).

> El repo **no tiene runner de tests en web** (`apps/web/package.json` no define `test`). Las tareas de frontend se verifican con `typecheck` + `lint` + verificación manual de los 4 estados, siguiendo la convención existente (ninguna feature web tiene tests). Todos los tests automatizados de este plan son de backend (Vitest).

---

## FASE 1 — Shared (tipos + Zod)

### Task 1: Tipos compartidos de progreso y preferencias

**Files:**
- Create: `packages/shared/src/types/progress.types.ts`

- [ ] **Step 1: Crear el archivo de tipos**

```typescript
// Producto — Progreso, puntos débiles y personalización (Agente I-2) — README §3.6.
// El progreso/debilidad es DERIVADO (on-the-fly): estos tipos describen la salida del motor,
// no entidades persistidas. El único modelo persistido nuevo es UserStudyPreferences.

// Espeja el enum de Prisma RemediationIntensity. Zod lo consume con z.nativeEnum.
export enum RemediationIntensity {
  OFF = 'OFF',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// Progreso de UN tema (derivado). `hasData=false` ⇒ sin quiz ni SRS → se omite del ranking (EmptyState).
export interface TopicProgress {
  topicId: string;
  name: string;
  accuracy: number | null; // correct/answered (solo ítems contestados); null si no hay quiz
  answered: number;
  weakness: number; // [0,1], 1 = más débil; 0 si !hasData
  lowConfidence: boolean; // answered < MIN_ANSWERS
  hasData: boolean;
}

// Progreso agregado por materia.
export interface SubjectProgress {
  subjectId: string;
  name: string;
  accuracy: number | null; // promedio de los temas con quiz; null si ninguno
  weakness: number | null; // promedio de los temas con datos; null si ninguno
  topics: TopicProgress[];
}

// Respuesta de GET /progress/overview.
export interface ProgressOverview {
  subjects: SubjectProgress[];
  totals: {
    topicsWithData: number;
    avgAccuracy: number | null;
    weakestTopicId: string | null;
  };
}

// Item de GET /progress/weak-topics (solo temas con datos, ordenados por weakness desc).
export interface WeakTopic {
  topicId: string;
  name: string;
  subjectId: string;
  subjectName: string;
  weakness: number;
  accuracy: number | null;
  lowConfidence: boolean;
}

// Preferencias de estudio (1:1 con User). `null` = usar default del motor.
export interface UserStudyPreferences {
  remediationIntensity: RemediationIntensity;
  prioritySubjectIds: string[];
  weightQuiz: number | null;
  weightSrs: number | null;
  dailyGoalMinutes: number | null;
}
```

- [ ] **Step 2: Verificar typecheck del paquete shared**

Run: `pnpm --filter ./packages/shared typecheck`
Expected: PASS (sin errores).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/progress.types.ts
git commit -m "feat(shared): tipos de progreso y preferencias (I-2 F1)"
```

### Task 2: Schemas Zod + export desde el índice

**Files:**
- Create: `packages/shared/src/schemas/progress.schema.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Crear el schema**

```typescript
import { z } from 'zod';
import { RemediationIntensity } from '../types/progress.types';

// Progreso & Personalización (Agente I-2). Schemas compartidos API↔web (fuente única de validación).
// El progreso es solo-lectura (sin schema de escritura). El único input externo es PUT /preferences.

// Defaults de la fórmula de debilidad (README §3.6). El web los usa para mostrar el estado por defecto.
export const DEFAULT_WEIGHT_QUIZ = 0.6;
export const DEFAULT_WEIGHT_SRS = 0.4;
export const DEFAULT_REMEDIATION_INTENSITY = RemediationIntensity.LOW;

// PUT /preferences — todos los campos opcionales (upsert parcial). `null` resetea al default del motor.
export const updatePreferencesSchema = z.object({
  remediationIntensity: z.nativeEnum(RemediationIntensity).optional(),
  prioritySubjectIds: z.array(z.string().cuid()).max(50).optional(),
  weightQuiz: z.number().min(0).max(1).nullable().optional(),
  weightSrs: z.number().min(0).max(1).nullable().optional(),
  dailyGoalMinutes: z.number().int().min(0).max(1440).nullable().optional(),
});

// GET /progress/weak-topics?limit=
export const weakTopicsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type WeakTopicsQuery = z.infer<typeof weakTopicsQuerySchema>;
```

- [ ] **Step 2: Exportar desde el índice**

En `packages/shared/src/index.ts`, agregar la línea de schema junto al resto de `// Producto`:

```typescript
export * from './schemas/quiz.schema';
export * from './schemas/progress.schema';
```

y la línea de tipos junto al resto de `// Producto`:

```typescript
export * from './types/quiz.types';
export * from './types/progress.types';
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm --filter ./packages/shared typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/progress.schema.ts packages/shared/src/index.ts
git commit -m "feat(shared): schemas Zod de preferencias + exports (I-2 F1)"
```

---

## FASE 2 — Backend motor (capa 1)

### Task 3: Fórmula de debilidad (pura) + test

**Files:**
- Create: `apps/api/src/modules/progress/progress.formula.ts`
- Test: `apps/api/src/modules/progress/__tests__/progress.formula.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { describe, expect, it } from 'vitest';
import { RemediationIntensity } from '@bract/shared';
import {
  computeTopicWeakness,
  resolvePreferences,
  INTENSITY_ALPHA,
  MIN_ANSWERS,
  type TopicSignals,
} from '../progress.formula.js';

const base: TopicSignals = {
  topicId: 't1',
  subjectId: 's1',
  answered: 0,
  correct: 0,
  totalCards: 0,
  dueCards: 0,
  avgEase: null,
};

describe('progress.formula — computeTopicWeakness', () => {
  it('sin quiz ni SRS ⇒ hasData=false, weakness=0 (sin datos ≠ débil)', () => {
    const r = computeTopicWeakness(base, resolvePreferences(null));
    expect(r.hasData).toBe(false);
    expect(r.weakness).toBe(0);
    expect(r.accuracy).toBeNull();
  });

  it('solo quiz: 1 de 4 correctas ⇒ weakness=0.75, accuracy=0.25', () => {
    const r = computeTopicWeakness(
      { ...base, answered: 4, correct: 1 },
      resolvePreferences(null),
    );
    expect(r.hasData).toBe(true);
    expect(r.accuracy).toBeCloseTo(0.25, 5);
    expect(r.weakness).toBeCloseTo(0.75, 5); // solo señal quiz ⇒ pesa 100%
    expect(r.lowConfidence).toBe(false);
  });

  it('answered < MIN_ANSWERS ⇒ lowConfidence=true', () => {
    const r = computeTopicWeakness(
      { ...base, answered: MIN_ANSWERS - 1, correct: 0 },
      resolvePreferences(null),
    );
    expect(r.lowConfidence).toBe(true);
  });

  it('solo SRS: ease en el piso + todas vencidas ⇒ weakness=1', () => {
    const r = computeTopicWeakness(
      { ...base, totalCards: 4, dueCards: 4, avgEase: 1.3 },
      resolvePreferences(null),
    );
    expect(r.weakness).toBeCloseTo(1, 5);
  });

  it('quiz + SRS combinan con pesos default 0.6/0.4', () => {
    // quizWeak=1 (0 correctas), srsWeak=0 (ease máximo, nada vencido)
    const r = computeTopicWeakness(
      { ...base, answered: 5, correct: 0, totalCards: 2, dueCards: 0, avgEase: 2.5 },
      resolvePreferences(null),
    );
    expect(r.weakness).toBeCloseTo(0.6, 5); // 0.6*1 + 0.4*0
  });

  it('la PRIORIDAD no afecta el weakness (es objetivo): mismas señales ⇒ mismo weakness con cualquier pref', () => {
    const signals = { ...base, answered: 2, correct: 1 };
    const a = computeTopicWeakness(signals, resolvePreferences(null));
    const b = computeTopicWeakness(
      signals,
      resolvePreferences({
        remediationIntensity: RemediationIntensity.HIGH,
        prioritySubjectIds: ['s1'], // materia "prioritaria": NO debe inflar el weakness
        weightQuiz: null,
        weightSrs: null,
        dailyGoalMinutes: null,
      }),
    );
    expect(b.weakness).toBe(a.weakness); // weakness 100% objetivo: prioridad/intensidad no lo tocan
  });

  it('INTENSITY_ALPHA: OFF=0, HIGH=1', () => {
    expect(INTENSITY_ALPHA[RemediationIntensity.OFF]).toBe(0);
    expect(INTENSITY_ALPHA[RemediationIntensity.HIGH]).toBe(1);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter ./apps/api exec vitest run src/modules/progress/__tests__/progress.formula.test.ts`
Expected: FAIL con "Cannot find module '../progress.formula.js'".

- [ ] **Step 3: Implementar la fórmula**

```typescript
import { RemediationIntensity } from '@bract/shared';
import type { UserStudyPreferences } from '@bract/shared';
import { DEFAULT_REMEDIATION_INTENSITY, DEFAULT_WEIGHT_QUIZ, DEFAULT_WEIGHT_SRS } from '@bract/shared';

// Fórmula de debilidad por tema (README §3.6). PURA: sin Prisma ni HTTP → testeable en aislamiento y
// reusable por planner (capa 2) y chat (capa 3). El service la alimenta con señales agregadas + prefs.
// weakness es 100% OBJETIVO: SOLO quiz + SRS. La PRIORIDAD (prioritySubjectIds) NO vive acá — es un término
// aparte del planner (ai.service.buildBaselinePlan). El dashboard muestra siempre el weakness real.

export const MIN_ANSWERS = 3; // confianza: por debajo, lowConfidence=true
export const EASE_BASE = 2.5; // ease inicial del SM-2
export const EASE_FLOOR = 1.3; // piso de ease del SM-2
export const SRS_EASE_WEIGHT = 0.6;
export const SRS_OVERDUE_WEIGHT = 0.4;

// Mapa intensidad → α (escala el peso de la debilidad en el plan; ver ai.service.buildBaselinePlan).
export const INTENSITY_ALPHA: Record<RemediationIntensity, number> = {
  [RemediationIntensity.OFF]: 0,
  [RemediationIntensity.LOW]: 0.33,
  [RemediationIntensity.MEDIUM]: 0.66,
  [RemediationIntensity.HIGH]: 1.0,
};

export interface TopicSignals {
  topicId: string;
  subjectId: string;
  answered: number; // ítems de quiz contestados (selectedIndex != null)
  correct: number;
  totalCards: number; // flashcards del tema
  dueCards: number; // flashcards vencidas (dueDate <= now)
  avgEase: number | null; // promedio de ease; null si no hay cartas
}

export interface ResolvedPreferences {
  remediationIntensity: RemediationIntensity;
  weightQuiz: number;
  weightSrs: number;
}
// NOTA: prioritySubjectIds NO está acá a propósito — la prioridad es un término del planner, no de la
// fórmula de debilidad (que es objetiva). El planner lee prioritySubjectIds de preferencesService directo.

export interface WeaknessResult {
  weakness: number;
  accuracy: number | null;
  answered: number;
  lowConfidence: boolean;
  hasData: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Resuelve prefs (o null) a valores concretos con los defaults del motor.
export function resolvePreferences(prefs: UserStudyPreferences | null): ResolvedPreferences {
  return {
    remediationIntensity: prefs?.remediationIntensity ?? DEFAULT_REMEDIATION_INTENSITY,
    weightQuiz: prefs?.weightQuiz ?? DEFAULT_WEIGHT_QUIZ,
    weightSrs: prefs?.weightSrs ?? DEFAULT_WEIGHT_SRS,
  };
}

// weakness ∈ [0,1] (1 = más débil). Ignora la señal ausente; ambas ausentes ⇒ hasData=false.
export function computeTopicWeakness(s: TopicSignals, prefs: ResolvedPreferences): WeaknessResult {
  const hasQuiz = s.answered > 0;
  const hasSrs = s.totalCards > 0;
  const accuracy = hasQuiz ? s.correct / s.answered : null;

  if (!hasQuiz && !hasSrs) {
    return { weakness: 0, accuracy: null, answered: 0, lowConfidence: false, hasData: false };
  }

  const quizWeak = accuracy === null ? null : 1 - accuracy;

  let srsWeak: number | null = null;
  if (hasSrs) {
    const easeGap = clamp01((EASE_BASE - (s.avgEase ?? EASE_BASE)) / (EASE_BASE - EASE_FLOOR));
    const overdueRatio = s.totalCards > 0 ? s.dueCards / s.totalCards : 0;
    srsWeak = clamp01(SRS_EASE_WEIGHT * easeGap + SRS_OVERDUE_WEIGHT * overdueRatio);
  }

  let num = 0;
  let den = 0;
  if (quizWeak !== null) {
    num += prefs.weightQuiz * quizWeak;
    den += prefs.weightQuiz;
  }
  if (srsWeak !== null) {
    num += prefs.weightSrs * srsWeak;
    den += prefs.weightSrs;
  }
  // weakness OBJETIVO: solo quiz + SRS. La prioridad NO se aplica acá (es un término del planner).
  const weakness = den > 0 ? num / den : 0;

  return {
    weakness,
    accuracy,
    answered: s.answered,
    lowConfidence: hasQuiz && s.answered < MIN_ANSWERS,
    hasData: true,
  };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter ./apps/api exec vitest run src/modules/progress/__tests__/progress.formula.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/progress/progress.formula.ts apps/api/src/modules/progress/__tests__/progress.formula.test.ts
git commit -m "feat(progress): fórmula de debilidad pura + tests (I-2 F2)"
```

### Task 4: Repository (groupBy, sin N+1)

**Files:**
- Create: `apps/api/src/modules/progress/progress.repository.ts`

- [ ] **Step 1: Implementar el repository**

```typescript
import { prisma } from '../../prisma/client.js';

// Repositorio de progreso (I-2). SOLO Prisma, sin lógica de negocio. Agrega con groupBy sobre los índices
// existentes (§3.5: [userId, topicId, isCorrect]; flashcards: [userId, dueDate]) — NO trae todo a memoria.
// 4 queries de costo constante (sin N+1): árbol materias/temas, quiz por tema, SRS por tema, vencidas por tema.

export interface QuizStatRow {
  topicId: string;
  answered: number;
  correct: number;
}

export interface SrsStatRow {
  topicId: string;
  totalCards: number;
  dueCards: number;
  avgEase: number | null;
}

export interface SubjectTreeRow {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

export const progressRepository = {
  // Árbol materias→temas del usuario (nombres para el overview/weak-topics). select explícito (sin over-fetch).
  async getSubjectTree(userId: string): Promise<SubjectTreeRow[]> {
    return prisma.subject.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        topics: { select: { id: true, name: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  // % de acierto por tema: agrupado por [topicId, isCorrect], solo ítems contestados (selectedIndex != null)
  // y con topicId. Se colapsa a {answered, correct} por tema en una sola pasada.
  async getQuizStatsByTopic(userId: string): Promise<QuizStatRow[]> {
    const rows = await prisma.quizAttemptItem.groupBy({
      by: ['topicId', 'isCorrect'],
      where: { userId, selectedIndex: { not: null }, topicId: { not: null } },
      _count: true,
      orderBy: { topicId: 'asc' },
    });

    const map = new Map<string, { answered: number; correct: number }>();
    for (const r of rows) {
      const topicId = r.topicId as string; // topicId != null por el where
      const count = r._count as number; // Prisma 5.22 tipa _count como unión; en runtime es number
      const acc = map.get(topicId) ?? { answered: 0, correct: 0 };
      acc.answered += count;
      if (r.isCorrect) acc.correct += count;
      map.set(topicId, acc);
    }
    return [...map.entries()].map(([topicId, v]) => ({ topicId, ...v }));
  },

  // Estado SRS por tema: total + ease promedio (un groupBy) y vencidas (otro groupBy con where dueDate<=now).
  async getSrsStatsByTopic(userId: string, now: Date): Promise<SrsStatRow[]> {
    const [totals, due] = await Promise.all([
      prisma.flashcard.groupBy({
        by: ['topicId'],
        where: { userId },
        _count: true,
        _avg: { ease: true },
        orderBy: { topicId: 'asc' },
      }),
      prisma.flashcard.groupBy({
        by: ['topicId'],
        where: { userId, dueDate: { lte: now } },
        _count: true,
        orderBy: { topicId: 'asc' },
      }),
    ]);

    const dueMap = new Map(due.map((d) => [d.topicId, d._count as number]));
    return totals.map((t) => ({
      topicId: t.topicId,
      totalCards: t._count as number,
      dueCards: dueMap.get(t.topicId) ?? 0,
      avgEase: t._avg.ease,
    }));
  },
};
```

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm --filter ./apps/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/progress/progress.repository.ts
git commit -m "feat(progress): repository groupBy sin N+1 (I-2 F2)"
```

### Task 5: Service (overview / weak-topics / weaknessMap) + test

**Files:**
- Create: `apps/api/src/modules/progress/progress.service.ts`
- Test: `apps/api/src/modules/progress/__tests__/progress.service.test.ts`

> En F2 el service usa **preferencias por defecto** (`resolvePreferences(null)`). F4 cablea el repo real de prefs sin cambiar las firmas públicas.

- [ ] **Step 1: Escribir el test que falla**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../progress.repository.js', () => ({
  progressRepository: {
    getSubjectTree: vi.fn(),
    getQuizStatsByTopic: vi.fn(),
    getSrsStatsByTopic: vi.fn(),
  },
}));

import { progressRepository } from '../progress.repository.js';
import { progressService } from '../progress.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(progressRepository.getSrsStatsByTopic).mockResolvedValue([]);
  vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([]);
  vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([]);
});

describe('progressService.getOverview', () => {
  it('sin datos ⇒ subjects con temas hasData=false y totals vacíos', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      { id: 's1', name: 'Mate', topics: [{ id: 't1', name: 'Álgebra' }] },
    ]);
    const ov = await progressService.getOverview('u1');
    expect(ov.subjects[0]!.topics[0]!.hasData).toBe(false);
    expect(ov.totals.topicsWithData).toBe(0);
    expect(ov.totals.weakestTopicId).toBeNull();
  });

  it('cruza quiz por tema → accuracy + weakness', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      { id: 's1', name: 'Mate', topics: [{ id: 't1', name: 'Álgebra' }] },
    ]);
    vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([
      { topicId: 't1', answered: 4, correct: 1 },
    ]);
    const ov = await progressService.getOverview('u1');
    const topic = ov.subjects[0]!.topics[0]!;
    expect(topic.hasData).toBe(true);
    expect(topic.accuracy).toBeCloseTo(0.25, 5);
    expect(topic.weakness).toBeCloseTo(0.75, 5);
    expect(ov.totals.topicsWithData).toBe(1);
    expect(ov.totals.weakestTopicId).toBe('t1');
  });
});

describe('progressService.getWeakTopics', () => {
  it('ordena por weakness desc y omite temas sin datos; respeta limit', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      {
        id: 's1',
        name: 'Mate',
        topics: [
          { id: 't1', name: 'Álgebra' },
          { id: 't2', name: 'Geometría' },
          { id: 't3', name: 'SinDatos' },
        ],
      },
    ]);
    vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([
      { topicId: 't1', answered: 4, correct: 3 }, // weakness 0.25
      { topicId: 't2', answered: 4, correct: 0 }, // weakness 1.0
    ]);
    const weak = await progressService.getWeakTopics('u1', 5);
    expect(weak.map((w) => w.topicId)).toEqual(['t2', 't1']); // t3 omitido
    expect(weak[0]!.subjectName).toBe('Mate');

    const limited = await progressService.getWeakTopics('u1', 1);
    expect(limited).toHaveLength(1);
    expect(limited[0]!.topicId).toBe('t2');
  });
});

describe('progressService.getWeaknessMap', () => {
  it('devuelve Map topicId→weakness solo de temas con datos', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      { id: 's1', name: 'Mate', topics: [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }] },
    ]);
    vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([
      { topicId: 't1', answered: 2, correct: 0 },
    ]);
    const map = await progressService.getWeaknessMap('u1');
    expect(map.get('t1')).toBeCloseTo(1, 5);
    expect(map.has('t2')).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter ./apps/api exec vitest run src/modules/progress/__tests__/progress.service.test.ts`
Expected: FAIL con "Cannot find module '../progress.service.js'".

- [ ] **Step 3: Implementar el service**

```typescript
import type { ProgressOverview, SubjectProgress, TopicProgress, WeakTopic } from '@bract/shared';
import { progressRepository } from './progress.repository.js';
import {
  computeTopicWeakness,
  resolvePreferences,
  type ResolvedPreferences,
  type TopicSignals,
  type WeaknessResult,
} from './progress.formula.js';

// Service de progreso (I-2). Lógica de negocio: cruza señales (quiz + SRS) con la fórmula y arma los DTOs.
// Read-only y reusable: planner (capa 2) y chat (capa 3) consumen getWeaknessMap/getWeakTopics.
// F2 usa prefs por defecto; F4 inyecta las reales vía buildResolvedPreferences (sin cambiar firmas públicas).

interface TopicComputed extends WeaknessResult {
  topicId: string;
  name: string;
  subjectId: string;
  subjectName: string;
}

// F2: prefs por defecto. F4 reemplaza el cuerpo por un fetch al preferences.repository.
async function buildResolvedPreferences(_userId: string): Promise<ResolvedPreferences> {
  return resolvePreferences(null);
}

// Núcleo compartido: arma la lista de temas computados (una sola pasada por la data agregada).
async function computeAll(userId: string): Promise<TopicComputed[]> {
  const now = new Date();
  const [tree, quiz, srs, prefs] = await Promise.all([
    progressRepository.getSubjectTree(userId),
    progressRepository.getQuizStatsByTopic(userId),
    progressRepository.getSrsStatsByTopic(userId, now),
    buildResolvedPreferences(userId),
  ]);

  const quizMap = new Map(quiz.map((q) => [q.topicId, q]));
  const srsMap = new Map(srs.map((s) => [s.topicId, s]));

  const out: TopicComputed[] = [];
  for (const subject of tree) {
    for (const topic of subject.topics) {
      const q = quizMap.get(topic.id);
      const s = srsMap.get(topic.id);
      const signals: TopicSignals = {
        topicId: topic.id,
        subjectId: subject.id,
        answered: q?.answered ?? 0,
        correct: q?.correct ?? 0,
        totalCards: s?.totalCards ?? 0,
        dueCards: s?.dueCards ?? 0,
        avgEase: s?.avgEase ?? null,
      };
      const result = computeTopicWeakness(signals, prefs);
      out.push({
        ...result,
        topicId: topic.id,
        name: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
      });
    }
  }
  return out;
}

function toTopicProgress(c: TopicComputed): TopicProgress {
  return {
    topicId: c.topicId,
    name: c.name,
    accuracy: c.accuracy,
    answered: c.answered,
    weakness: c.weakness,
    lowConfidence: c.lowConfidence,
    hasData: c.hasData,
  };
}

function avgOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export const progressService = {
  async getOverview(userId: string): Promise<ProgressOverview> {
    const computed = await computeAll(userId);
    const bySubject = new Map<string, TopicComputed[]>();
    for (const c of computed) {
      const arr = bySubject.get(c.subjectId) ?? [];
      arr.push(c);
      bySubject.set(c.subjectId, arr);
    }

    const subjects: SubjectProgress[] = [];
    for (const [subjectId, topics] of bySubject) {
      const withData = topics.filter((t) => t.hasData);
      subjects.push({
        subjectId,
        name: topics[0]!.subjectName,
        accuracy: avgOrNull(withData.filter((t) => t.accuracy !== null).map((t) => t.accuracy!)),
        weakness: avgOrNull(withData.map((t) => t.weakness)),
        topics: topics.map(toTopicProgress),
      });
    }

    const withData = computed.filter((t) => t.hasData);
    const weakest = withData.slice().sort((a, b) => b.weakness - a.weakness)[0];
    return {
      subjects,
      totals: {
        topicsWithData: withData.length,
        avgAccuracy: avgOrNull(withData.filter((t) => t.accuracy !== null).map((t) => t.accuracy!)),
        weakestTopicId: weakest?.topicId ?? null,
      },
    };
  },

  async getWeakTopics(userId: string, limit: number): Promise<WeakTopic[]> {
    const computed = await computeAll(userId);
    return computed
      .filter((t) => t.hasData)
      .sort((a, b) => b.weakness - a.weakness)
      .slice(0, limit)
      .map((c) => ({
        topicId: c.topicId,
        name: c.name,
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        weakness: c.weakness,
        accuracy: c.accuracy,
        lowConfidence: c.lowConfidence,
      }));
  },

  // Reusable por planner/chat. Solo temas con datos (sin datos no figura → el consumidor degrada).
  async getWeaknessMap(userId: string): Promise<Map<string, number>> {
    const computed = await computeAll(userId);
    const map = new Map<string, number>();
    for (const c of computed) {
      if (c.hasData) map.set(c.topicId, c.weakness);
    }
    return map;
  },
};
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter ./apps/api exec vitest run src/modules/progress/__tests__/progress.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/progress/progress.service.ts apps/api/src/modules/progress/__tests__/progress.service.test.ts
git commit -m "feat(progress): service overview/weak-topics/weaknessMap + tests (I-2 F2)"
```

### Task 6: Controller + routes + montaje

**Files:**
- Create: `apps/api/src/modules/progress/progress.controller.ts`
- Create: `apps/api/src/modules/progress/progress.routes.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Implementar el controller**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { weakTopicsQuerySchema } from '@bract/shared';
import { progressService } from './progress.service.js';

// Controller: SOLO HTTP. Envelope { success, data }. Rutas [self] (scope a req.user!.id en el service).
export const progressController = {
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await progressService.getOverview(req.user!.id);
      res.json({ success: true, data: { overview } });
    } catch (err) {
      next(err);
    }
  },

  async getWeakTopics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit } = weakTopicsQuerySchema.parse(req.query);
      const weakTopics = await progressService.getWeakTopics(req.user!.id, limit);
      res.json({ success: true, data: { weakTopics } });
    } catch (err) {
      next(err);
    }
  },
};
```

- [ ] **Step 2: Implementar las rutas**

```typescript
import { Router } from 'express';
import { progressController } from './progress.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

// Progreso (Agente I-2) — rutas §5.5. Montado en /api/v1. Todas [self]: authenticate + scope en el service.
const router: Router = Router();

router.get('/progress/overview', authenticate, progressController.getOverview);
router.get('/progress/weak-topics', authenticate, progressController.getWeakTopics);

export { router as progressRouter };
```

- [ ] **Step 3: Montar en server.ts**

En `apps/api/src/server.ts`, agregar el import junto a los demás routers:

```typescript
import { quizRouter } from './modules/quiz/quiz.routes.js';
import { progressRouter } from './modules/progress/progress.routes.js';
```

y el `app.use` después del quiz (línea ~79):

```typescript
app.use('/api/v1', quizRouter);

// Fase 15 — Progreso & puntos débiles (Agente I-2): motor on-the-fly (read-only)
app.use('/api/v1', progressRouter);
```

- [ ] **Step 4: Verificar typecheck y la suite de progreso**

Run: `pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/api exec vitest run src/modules/progress`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/progress/progress.controller.ts apps/api/src/modules/progress/progress.routes.ts apps/api/src/server.ts
git commit -m "feat(progress): controller + routes [self] + montaje (I-2 F2)"
```

---

## FASE 3 — Dashboard (capa 1, frontend)

### Task 7: API web + hooks React Query

**Files:**
- Create: `apps/web/src/features/progress/api/progress.api.ts`
- Create: `apps/web/src/features/progress/hooks/useProgress.ts`

- [ ] **Step 1: Implementar la capa api/**

```typescript
import apiClient from '../../../lib/axios';
import type { ProgressOverview, WeakTopic } from '@bract/shared';

// Capa api/ de Progreso (I-2). Funciones tipadas que consumen /progress/*. Devuelven el data del envelope.

interface Envelope<T> {
  success: true;
  data: T;
}

export const progressApi = {
  async getOverview(): Promise<ProgressOverview> {
    const res = await apiClient.get<Envelope<{ overview: ProgressOverview }>>('/progress/overview');
    return res.data.data.overview;
  },

  async getWeakTopics(limit = 10): Promise<WeakTopic[]> {
    const res = await apiClient.get<Envelope<{ weakTopics: WeakTopic[] }>>('/progress/weak-topics', {
      params: { limit },
    });
    return res.data.data.weakTopics;
  },
};
```

- [ ] **Step 2: Implementar los hooks**

```typescript
import { useQuery } from '@tanstack/react-query';
import { progressApi } from '../api/progress.api';

// staleTime 60s: el progreso cambia al responder quizzes/repasar; no necesita refetch agresivo.
const STALE_MS = 60_000;

export function useProgressOverview() {
  return useQuery({
    queryKey: ['progress', 'overview'],
    queryFn: () => progressApi.getOverview(),
    staleTime: STALE_MS,
  });
}

export function useWeakTopics(limit = 10) {
  return useQuery({
    queryKey: ['progress', 'weak', limit],
    queryFn: () => progressApi.getWeakTopics(limit),
    staleTime: STALE_MS,
  });
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm --filter ./apps/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/progress/api/progress.api.ts apps/web/src/features/progress/hooks/useProgress.ts
git commit -m "feat(web/progress): api + hooks React Query (I-2 F3)"
```

### Task 8: Componentes del dashboard (4 estados + barras + lista)

**Files:**
- Create: `apps/web/src/features/progress/components/SubjectProgressCard.tsx`
- Create: `apps/web/src/features/progress/components/WeakTopicsList.tsx`
- Create: `apps/web/src/features/progress/components/ProgressPage.tsx`
- Create: `apps/web/src/features/progress/index.ts`

> Reusar componentes existentes del design system: `Skeleton` (loading), `EmptyState` (empty), `ErrorState`/patrón de error de `features/analytics/components/AnalyticsPage.tsx`. Si los nombres difieren, seguir exactamente el patrón de esa página (abrirla como referencia). Barras = `recharts` `BarChart` como en `features/dashboard/components/UserGrowthChart.tsx`. Colores SOLO con tokens CSS (`var(--...)` / clases `text-brand-primary`, etc.).

- [ ] **Step 1: Barra de progreso por materia**

```tsx
import { useTranslation } from 'react-i18next';
import type { SubjectProgress } from '@bract/shared';
import { cn } from '../../../utils/cn';

// Tarjeta por materia: barra de acierto por tema + chip de debilidad. Sin datos ⇒ tema en estado tenue.
export function SubjectProgressCard({ subject }: { subject: SubjectProgress }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{subject.name}</h3>
        {subject.accuracy !== null && (
          <span className="text-xs text-text-tertiary">
            {t('progress.accuracy')}: {Math.round(subject.accuracy * 100)}%
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {subject.topics.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3">
            <span
              className={cn(
                'w-40 shrink-0 truncate text-xs',
                topic.hasData ? 'text-text-secondary' : 'text-text-tertiary',
              )}
            >
              {topic.name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              {topic.hasData && topic.accuracy !== null && (
                <div
                  className="h-full rounded-full bg-brand-primary"
                  style={{ width: `${Math.round(topic.accuracy * 100)}%` }}
                />
              )}
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-text-tertiary">
              {topic.hasData ? `${Math.round(topic.weakness * 100)}% ${t('progress.weakShort')}` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Lista de puntos débiles**

```tsx
import { useTranslation } from 'react-i18next';
import type { WeakTopic } from '@bract/shared';

export function WeakTopicsList({ topics }: { topics: WeakTopic[] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('progress.weakTitle')}</h3>
      <ol className="space-y-2">
        {topics.map((topic, i) => (
          <li key={topic.topicId} className="flex items-center gap-3 text-sm">
            <span className="w-5 shrink-0 text-text-tertiary">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-text-primary">{topic.name}</p>
              <p className="truncate text-xs text-text-tertiary">{topic.subjectName}</p>
            </div>
            <span className="shrink-0 rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
              {Math.round(topic.weakness * 100)}%
              {topic.lowConfidence ? ` · ${t('progress.lowConfidence')}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 3: Página con los 4 estados**

```tsx
import { useTranslation } from 'react-i18next';
import { useProgressOverview, useWeakTopics } from '../hooks/useProgress';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SubjectProgressCard } from './SubjectProgressCard';
import { WeakTopicsList } from './WeakTopicsList';

// Vista de primera clase /progress. 4 estados: loading · error · empty · success.
// IMPORTANTE: si los imports de Skeleton/EmptyState difieren, copiar los de features/analytics/components/AnalyticsPage.tsx.
export default function ProgressPage() {
  const { t } = useTranslation();
  const overview = useProgressOverview();
  const weak = useWeakTopics(10);

  if (overview.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="p-6">
        <EmptyState
          title={t('common.error')}
          description={t('progress.errorDescription')}
          action={{ label: t('common.retry'), onClick: () => void overview.refetch() }}
        />
      </div>
    );
  }

  const data = overview.data!;
  const hasAnyData = data.totals.topicsWithData > 0;

  if (!hasAnyData) {
    return (
      <div className="p-6">
        <EmptyState title={t('progress.emptyTitle')} description={t('progress.emptyDescription')} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{t('progress.title')}</h1>
        <p className="text-sm text-text-tertiary">{t('progress.description')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {data.subjects.map((subject) => (
            <SubjectProgressCard key={subject.subjectId} subject={subject} />
          ))}
        </div>
        <div>
          {weak.isSuccess && weak.data.length > 0 && <WeakTopicsList topics={weak.data} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Barrel export**

```typescript
export { default as ProgressPage } from './components/ProgressPage';
```

- [ ] **Step 5: Verificar typecheck + lint**

Run: `pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web lint`
Expected: PASS. (Si falla por nombre de `EmptyState`/`Skeleton`/prop `action`, ajustar al API real del design system — abrir `components/ui/` y `features/analytics/components/AnalyticsPage.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/progress/components apps/web/src/features/progress/index.ts
git commit -m "feat(web/progress): dashboard con 4 estados (I-2 F3)"
```

### Task 9: Ruta + sidebar + i18n

**Files:**
- Modify: `apps/web/src/router/index.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Modify: `apps/web/src/lib/i18n.ts`

- [ ] **Step 1: Registrar la ruta lazy**

En `apps/web/src/router/index.tsx`, agregar el lazy import junto a los demás (después de `QuizPage`):

```typescript
const QuizPage = React.lazy(() => import('../features/quiz/components/QuizPage'));
const ProgressPage = React.lazy(() => import('../features/progress').then((m) => ({ default: m.ProgressPage })));
```

y la ruta dentro del bloque `<DashboardShell />` (después del bloque `/quiz`):

```tsx
{
  path: '/progress',
  element: (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <ProgressPage />
      </Suspense>
    </ErrorBoundary>
  ),
  handle: { titleKey: 'nav.progress', breadcrumb: [{ labelKey: 'nav.progress' }] },
},
```

- [ ] **Step 2: Agregar el item al sidebar**

En `apps/web/src/components/layout/Sidebar.tsx`, agregar un icono (junto a los demás `Icon*`):

```tsx
function IconTrendingUp() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
```

y la entrada en `NAV_ITEMS` (después de `quiz`):

```tsx
{ to: '/quiz', labelKey: 'quiz', icon: <IconQuiz /> },
{ to: '/progress', labelKey: 'progress', icon: <IconTrendingUp /> },
```

- [ ] **Step 3: Agregar las traducciones**

En `apps/web/src/lib/i18n.ts`, agregar `progress: 'Progress'` en `en.translation.nav` y `progress: 'Progreso'` en `es.translation.nav`. Luego agregar el namespace `progress` en ambos idiomas (junto a otros namespaces de feature):

```typescript
// en.translation
progress: {
  title: 'Progress',
  description: 'Your accuracy and weak spots by subject and topic',
  accuracy: 'Accuracy',
  weakShort: 'weak',
  weakTitle: 'Weak topics',
  lowConfidence: 'low confidence',
  emptyTitle: 'No progress data yet',
  emptyDescription: 'Take a quiz or review flashcards to start seeing your progress.',
  errorDescription: 'Could not load your progress.',
  // Preferencias (F4)
  preferencesTitle: 'Personalization',
  remediationIntensity: 'Remediation intensity',
  remediationOff: 'Off',
  remediationLow: 'Low',
  remediationMedium: 'Medium',
  remediationHigh: 'High',
  prioritySubjects: 'Priority subjects',
  prioritySubjectsEmpty: 'Create subjects to choose priorities.',
  prioritySubjectsError: 'Could not load your subjects.',
  dailyGoalMinutes: 'Daily goal (minutes)',
  save: 'Save preferences',
  saved: 'Preferences saved',
},
```

```typescript
// es.translation
progress: {
  title: 'Progreso',
  description: 'Tu acierto y puntos débiles por materia y tema',
  accuracy: 'Acierto',
  weakShort: 'flojo',
  weakTitle: 'Puntos débiles',
  lowConfidence: 'poca confianza',
  emptyTitle: 'Todavía no hay datos de progreso',
  emptyDescription: 'Hacé un quiz o repasá flashcards para empezar a ver tu progreso.',
  errorDescription: 'No se pudo cargar tu progreso.',
  // Preferencias (F4)
  preferencesTitle: 'Personalización',
  remediationIntensity: 'Intensidad de remediación',
  remediationOff: 'Apagada',
  remediationLow: 'Baja',
  remediationMedium: 'Media',
  remediationHigh: 'Alta',
  prioritySubjects: 'Materias a priorizar',
  prioritySubjectsEmpty: 'Creá materias para elegir prioridades.',
  prioritySubjectsError: 'No se pudieron cargar tus materias.',
  dailyGoalMinutes: 'Meta diaria (minutos)',
  save: 'Guardar preferencias',
  saved: 'Preferencias guardadas',
},
```

- [ ] **Step 4: Verificar typecheck + lint y arrancar la app**

Run: `pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web lint`
Expected: PASS. Verificación manual: `pnpm --filter ./apps/web dev`, entrar a `/progress` con un usuario sin quizzes (EmptyState) y con quizzes (barras + lista). Cambiar idioma y confirmar i18n.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/router/index.tsx apps/web/src/components/layout/Sidebar.tsx apps/web/src/lib/i18n.ts
git commit -m "feat(web/progress): ruta /progress + sidebar + i18n es/en (I-2 F3)"
```

---

## FASE 4 — Personalización (modelo + módulo + UI)

> **NOTA de diseño (debilidad ≠ prioridad, ajuste pre-F2/F4/F5):** `prioritySubjectIds` se persiste igual en
> `UserStudyPreferences`, pero es consumido por el **planner** (F5) como término propio del orden, con **nudge
> fijo independiente de α** (vale aun en `OFF`) — **NO** por la fórmula de debilidad (que quedó 100% objetiva,
> solo quiz + SRS). No hay cambio de código en Task 10/11 por esto (el módulo de preferencias solo guarda/lee el
> array; el mapper Prisma↔shared no toca prioridad).
> **UI de prioridad SÍ en v1 (Task 12):** el multiselect de materias prioritarias va en la pantalla de
> preferencias, con sus 4 estados (reusa `useSubjects` como fuente del árbol de materias). Sin esto la prioridad
> no sería ejercitable y la personalización quedaría incompleta.

### Task 10: Modelo Prisma UserStudyPreferences (db push lo corre el usuario)

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Agregar la back-relation en User**

En el modelo `User` de `apps/api/prisma/schema.prisma`, junto a las relaciones de producto:

```prisma
  quizAttempts      QuizAttempt[]
  quizAttemptItems  QuizAttemptItem[]
  studyPreferences  UserStudyPreferences?
```

- [ ] **Step 2: Agregar el modelo + enum al final del archivo**

```prisma
// ==========================================
// PROGRESO & PERSONALIZACIÓN (I-2) — §3.6
// Único modelo nuevo: preferencias. El progreso/debilidad es DERIVADO (on-the-fly), no se persiste.
// ==========================================

model UserStudyPreferences {
  id                   String               @id @default(cuid())
  userId               String               @unique
  user                 User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  remediationIntensity RemediationIntensity @default(LOW)
  prioritySubjectIds   String[]             @default([])
  weightQuiz           Float?
  weightSrs            Float?
  dailyGoalMinutes     Int?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@map("user_study_preferences")
}

enum RemediationIntensity {
  OFF
  LOW
  MEDIUM
  HIGH
}
```

- [ ] **Step 3: PEDIR AL USUARIO que corra el db push**

> El plan **no corre `db push`**. Pasarle al usuario este comando y esperar confirmación antes de seguir:
>
> ```bash
> pnpm --filter ./apps/api exec prisma db push
> ```
>
> (Aplica el modelo a Postgres y regenera el client. Tras confirmar, seguir.)

- [ ] **Step 4: Verificar el client regenerado**

Run: `pnpm --filter ./apps/api typecheck`
Expected: PASS (el tipo `UserStudyPreferences` de `@prisma/client` ya existe).

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(progress): modelo UserStudyPreferences + enum (I-2 F4)"
```

### Task 11: Módulo preferences + cableado en progressService

**Files:**
- Create: `apps/api/src/modules/preferences/preferences.repository.ts`
- Create: `apps/api/src/modules/preferences/preferences.service.ts`
- Create: `apps/api/src/modules/preferences/preferences.controller.ts`
- Create: `apps/api/src/modules/preferences/preferences.routes.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/modules/progress/progress.service.ts`

- [ ] **Step 1: Repository (upsert + get)**

```typescript
import type { Prisma, UserStudyPreferences as PrismaPrefs } from '@prisma/client';
import { prisma } from '../../prisma/client.js';

// Repositorio de preferencias (I-2). Solo Prisma. 1:1 con User (userId @unique) → upsert.
export const preferencesRepository = {
  async findByUser(userId: string): Promise<PrismaPrefs | null> {
    return prisma.userStudyPreferences.findUnique({ where: { userId } });
  },

  async upsert(userId: string, data: Prisma.UserStudyPreferencesUpdateInput): Promise<PrismaPrefs> {
    return prisma.userStudyPreferences.upsert({
      where: { userId },
      update: data,
      create: {
        user: { connect: { id: userId } },
        ...(data as Prisma.UserStudyPreferencesCreateInput),
      },
    });
  },
};
```

- [ ] **Step 2: Service (mapper Prisma→shared + defaults)**

```typescript
import type { UserStudyPreferences as PrismaPrefs } from '@prisma/client';
import { RemediationIntensity } from '@bract/shared';
import type { UpdatePreferencesInput, UserStudyPreferences } from '@bract/shared';
import { DEFAULT_REMEDIATION_INTENSITY } from '@bract/shared';
import { preferencesRepository } from './preferences.repository.js';

// Service de preferencias (I-2). DTOs, no req. Mapea Prisma→shared y devuelve defaults si no hay fila.
function toPrefs(p: PrismaPrefs | null): UserStudyPreferences {
  if (!p) {
    return {
      remediationIntensity: DEFAULT_REMEDIATION_INTENSITY,
      prioritySubjectIds: [],
      weightQuiz: null,
      weightSrs: null,
      dailyGoalMinutes: null,
    };
  }
  return {
    remediationIntensity: p.remediationIntensity as RemediationIntensity,
    prioritySubjectIds: p.prioritySubjectIds,
    weightQuiz: p.weightQuiz,
    weightSrs: p.weightSrs,
    dailyGoalMinutes: p.dailyGoalMinutes,
  };
}

export const preferencesService = {
  async get(userId: string): Promise<UserStudyPreferences> {
    return toPrefs(await preferencesRepository.findByUser(userId));
  },

  async update(userId: string, input: UpdatePreferencesInput): Promise<UserStudyPreferences> {
    const data: Record<string, unknown> = {};
    if (input.remediationIntensity !== undefined) data['remediationIntensity'] = input.remediationIntensity;
    if (input.prioritySubjectIds !== undefined) data['prioritySubjectIds'] = input.prioritySubjectIds;
    if (input.weightQuiz !== undefined) data['weightQuiz'] = input.weightQuiz;
    if (input.weightSrs !== undefined) data['weightSrs'] = input.weightSrs;
    if (input.dailyGoalMinutes !== undefined) data['dailyGoalMinutes'] = input.dailyGoalMinutes;
    const updated = await preferencesRepository.upsert(userId, data);
    return toPrefs(updated);
  },
};
```

- [ ] **Step 3: Controller**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { updatePreferencesSchema } from '@bract/shared';
import { preferencesService } from './preferences.service.js';

export const preferencesController = {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const preferences = await preferencesService.get(req.user!.id);
      res.json({ success: true, data: { preferences } });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updatePreferencesSchema.parse(req.body);
      const preferences = await preferencesService.update(req.user!.id, input);
      res.json({ success: true, data: { preferences } });
    } catch (err) {
      next(err);
    }
  },
};
```

- [ ] **Step 4: Routes + montaje**

```typescript
import { Router } from 'express';
import { preferencesController } from './preferences.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router: Router = Router();
router.get('/preferences', authenticate, preferencesController.get);
router.put('/preferences', authenticate, preferencesController.update);

export { router as preferencesRouter };
```

En `apps/api/src/server.ts`, importar y montar (después de `progressRouter`):

```typescript
import { preferencesRouter } from './modules/preferences/preferences.routes.js';
```

```typescript
app.use('/api/v1', progressRouter);

// Fase 15 — Preferencias de estudio (Agente I-2): personalización de la fórmula y el plan
app.use('/api/v1', preferencesRouter);
```

- [ ] **Step 5: Cablear prefs reales en el progressService**

En `apps/api/src/modules/progress/progress.service.ts`, reemplazar la función placeholder `buildResolvedPreferences` para que lea las prefs reales:

```typescript
import { preferencesService } from '../preferences/preferences.service.js';
```

```typescript
async function buildResolvedPreferences(userId: string): Promise<ResolvedPreferences> {
  const prefs = await preferencesService.get(userId);
  return resolvePreferences(prefs);
}
```

- [ ] **Step 6: Verificar typecheck + la suite de progreso (los tests siguen verdes con defaults)**

Run: `pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/api exec vitest run src/modules/progress`
Expected: PASS. (El test del service mockea solo `progress.repository`; `preferencesService.get` corre real pero sin fila → defaults → mismos resultados. Si el test fallara por la dependencia real, mockear `../preferences/preferences.service.js` devolviendo defaults en el `beforeEach`.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/preferences apps/api/src/server.ts apps/api/src/modules/progress/progress.service.ts
git commit -m "feat(preferences): módulo prefs + cableado en el motor de progreso (I-2 F4)"
```

### Task 12: UI de preferencias

**Files:**
- Create: `apps/web/src/features/progress/schemas/preferences.form.schema.ts`
- Create: `apps/web/src/features/progress/hooks/usePreferences.ts`
- Create: `apps/web/src/features/progress/components/PreferencesPanel.tsx`
- Modify: `apps/web/src/features/progress/components/ProgressPage.tsx`

- [ ] **Step 1: API web de preferencias (extender progress.api.ts)**

En `apps/web/src/features/progress/api/progress.api.ts`, agregar al objeto `progressApi` (e importar los tipos):

```typescript
import type { ProgressOverview, WeakTopic, UserStudyPreferences, UpdatePreferencesInput } from '@bract/shared';
```

```typescript
  async getPreferences(): Promise<UserStudyPreferences> {
    const res = await apiClient.get<Envelope<{ preferences: UserStudyPreferences }>>('/preferences');
    return res.data.data.preferences;
  },

  async updatePreferences(input: UpdatePreferencesInput): Promise<UserStudyPreferences> {
    const res = await apiClient.put<Envelope<{ preferences: UserStudyPreferences }>>('/preferences', input);
    return res.data.data.preferences;
  },
```

- [ ] **Step 2: Hooks de preferencias (query + mutation que invalida progreso)**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePreferencesInput } from '@bract/shared';
import { progressApi } from '../api/progress.api';

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => progressApi.getPreferences(),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) => progressApi.updatePreferences(input),
    onSuccess: (data) => {
      qc.setQueryData(['preferences'], data);
      // las prefs cambian la fórmula → invalidar el progreso para refetch
      void qc.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}
```

- [ ] **Step 3: Schema del form**

```typescript
import { z } from 'zod';
import { RemediationIntensity } from '@bract/shared';

// Form de preferencias (v1). Incluye el multiselect de materias prioritarias (prioritySubjectIds).
export const preferencesFormSchema = z.object({
  remediationIntensity: z.nativeEnum(RemediationIntensity),
  dailyGoalMinutes: z.coerce.number().int().min(0).max(1440).nullable(),
  prioritySubjectIds: z.array(z.string().cuid()).max(50),
});

export type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;
```

- [ ] **Step 4: Panel de preferencias (React Hook Form + Zod resolver)**

```tsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { RemediationIntensity } from '@bract/shared';
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences';
import { preferencesFormSchema, type PreferencesFormValues } from '../schemas/preferences.form.schema';
import { useSubjects } from '../../planner/hooks/useSubjects';
import { Skeleton } from '../../../components/ui/Skeleton';

const INTENSITIES: RemediationIntensity[] = [
  RemediationIntensity.OFF,
  RemediationIntensity.LOW,
  RemediationIntensity.MEDIUM,
  RemediationIntensity.HIGH,
];

const INTENSITY_LABEL_KEY: Record<RemediationIntensity, string> = {
  [RemediationIntensity.OFF]: 'progress.remediationOff',
  [RemediationIntensity.LOW]: 'progress.remediationLow',
  [RemediationIntensity.MEDIUM]: 'progress.remediationMedium',
  [RemediationIntensity.HIGH]: 'progress.remediationHigh',
};

export function PreferencesPanel() {
  const { t } = useTranslation();
  const prefs = usePreferences();
  const subjects = useSubjects(); // fuente única del árbol de materias (reuso del planner)
  const update = useUpdatePreferences();

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      remediationIntensity: RemediationIntensity.LOW,
      dailyGoalMinutes: null,
      prioritySubjectIds: [],
    },
  });

  useEffect(() => {
    if (prefs.data) {
      form.reset({
        remediationIntensity: prefs.data.remediationIntensity,
        dailyGoalMinutes: prefs.data.dailyGoalMinutes,
        prioritySubjectIds: prefs.data.prioritySubjectIds,
      });
    }
  }, [prefs.data, form]);

  if (prefs.isLoading) return <Skeleton className="h-40 w-full" />;

  const onSubmit = (values: PreferencesFormValues) => update.mutate(values);

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="rounded-xl border border-border-subtle bg-bg-surface p-4"
    >
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('progress.preferencesTitle')}</h3>

      <label className="mb-1 block text-xs text-text-secondary">{t('progress.remediationIntensity')}</label>
      <select
        {...form.register('remediationIntensity')}
        className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
      >
        {INTENSITIES.map((i) => (
          <option key={i} value={i}>
            {t(INTENSITY_LABEL_KEY[i])}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs text-text-secondary">{t('progress.dailyGoalMinutes')}</label>
      <input
        type="number"
        {...form.register('dailyGoalMinutes')}
        className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
      />

      {/* Multiselect de materias prioritarias — adelanta esas materias en el plan (nudge fijo, vale aun en OFF).
          Los 4 estados de la query de materias (loading · error · empty · success). */}
      <label className="mb-1 block text-xs text-text-secondary">{t('progress.prioritySubjects')}</label>
      <div className="mb-4">
        {subjects.isLoading && <Skeleton className="h-20 w-full" />}
        {subjects.isError && <p className="text-xs text-error">{t('progress.prioritySubjectsError')}</p>}
        {subjects.isSuccess && subjects.data.length === 0 && (
          <p className="text-xs text-text-tertiary">{t('progress.prioritySubjectsEmpty')}</p>
        )}
        {subjects.isSuccess && subjects.data.length > 0 && (
          <ul className="space-y-1">
            {subjects.data.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`prio-${s.id}`}
                  value={s.id}
                  {...form.register('prioritySubjectIds')}
                  className="h-4 w-4 rounded border-border-subtle bg-bg-elevated"
                />
                <label htmlFor={`prio-${s.id}`} className="truncate text-sm text-text-secondary">
                  {s.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={update.isPending}
        className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {update.isPending ? t('common.loading') : t('progress.save')}
      </button>
      {update.isSuccess && <p className="mt-2 text-xs text-success">{t('progress.saved')}</p>}
    </form>
  );
}
```

> **Nota de reuso (confirmar el path real):** `useSubjects` es la fuente única del árbol materias→temas que ya
> consumen quiz/flashcards/import. Si el import real difiere de `../../planner/hooks/useSubjects` (o el hook
> devuelve otra forma), ajustar al API existente — abrir el hook y seguir su firma. Los checkboxes nativos con
> `register('prioritySubjectIds')` y `value={s.id}` agrupan los marcados en un array (RHF), sin dep nueva.

- [ ] **Step 5: Montar el panel en la página**

En `apps/web/src/features/progress/components/ProgressPage.tsx`, importar `PreferencesPanel` y renderizarlo en la columna derecha **encima** de `WeakTopicsList` (dentro del estado success):

```tsx
import { PreferencesPanel } from './PreferencesPanel';
```

```tsx
        <div className="space-y-4">
          <PreferencesPanel />
          {weak.isSuccess && weak.data.length > 0 && <WeakTopicsList topics={weak.data} />}
        </div>
```

> Nota: el `PreferencesPanel` se muestra solo en el estado success (cuando ya hay datos). Es aceptable para v1; si se quiere visible también en empty, moverlo fuera del early-return — fuera de alcance ahora.

- [ ] **Step 6: Verificar typecheck + lint y probar**

Run: `pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web lint`
Expected: PASS. Manual: cambiar intensidad → guardar → confirmar toast/“saved” y que `/progress` refetchea.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/progress
git commit -m "feat(web/progress): UI de preferencias (RHF + Zod) (I-2 F4)"
```

---

## FASE 5 — Integración Planner (capa 2, aditivo)

### Task 13: Blend de debilidad en el baseline + golden test

**Files:**
- Modify: `apps/api/src/lib/ai/ai.service.ts`
- Modify: `apps/api/src/modules/planner/planner.service.ts`
- Test: `apps/api/src/modules/planner/__tests__/planner.distribution.test.ts`

- [ ] **Step 1: Extender el contrato y el baseline en ai.service.ts (aditivo)**

En `apps/api/src/lib/ai/ai.service.ts`:

(a) agregar campos **opcionales** a `GeneratePlanInput`:

```typescript
export interface GeneratePlanInput {
  subjects: { id: string; name: string; examDate: string | null }[];
  topics: {
    id: string;
    subjectId: string;
    name: string;
    status: TopicStatus;
    difficulty: TopicDifficulty;
    weakness?: number; // [0,1] — I-2 (capa 2), DEBILIDAD objetiva. Ausente/0 ⇒ sin efecto.
  }[];
  availability: { weekday: number; minutes: number }[];
  horizonDays?: number;
  now?: string;
  remediationAlpha?: number; // [0,1] — I-2. 0 (default) ⇒ orden idéntico a hoy.
  prioritySubjectIds?: string[]; // I-2 (capa 2), PRIORIDAD (preferencia). Vacío/ausente ⇒ sin efecto.
}
```

(b) agregar las constantes del nudge junto a `DIFFICULTY_RANK`:

```typescript
// I-2 (capa 2) — DOS términos SEPARADOS y ADITIVOS en el orden del baseline (README §3.6): DEBILIDAD (objetiva,
// modulada por α) y PRIORIDAD (preferencia, nudge FIJO independiente de α). Ninguno multiplica al otro; topeados.
const NUDGE_MAX_DAYS = 7; // adelanto máx. por DEBILIDAD para temas CON examen (se modula por α)
const NUDGE_DIFFICULTY_WEIGHT = 1.5; // cuánto mueve la DEBILIDAD dentro del grupo SIN examen (se modula por α)
const PRIORITY_NUDGE_DAYS = 3; // adelanto FIJO por PRIORIDAD para temas CON examen (< NUDGE_MAX_DAYS) — sin α
const PRIORITY_NOEXAM_WEIGHT = 1.0; // cuánto mueve la PRIORIDAD dentro del grupo SIN examen — sin α
```

(c) reemplazar **solo el `.sort(...)`** dentro de `buildBaselinePlan` (el resto del algoritmo queda igual). El sort actual:

```typescript
  const ordered = [...pending].sort((a, b) => {
    const da = examDaysFor(examBySubject.get(a.subjectId) ?? null, now);
    const db = examDaysFor(examBySubject.get(b.subjectId) ?? null, now);
    if (da !== db) return da - db;
    return DIFFICULTY_RANK[b.difficulty] - DIFFICULTY_RANK[a.difficulty];
  });
```

pasa a:

```typescript
  const alpha = input.remediationAlpha ?? 0;
  const prioritySet = new Set(input.prioritySubjectIds ?? []);
  const prio = (subjectId: string): number => (prioritySet.has(subjectId) ? 1 : 0); // factor SEPARADO de weakness
  // effectiveDays: temas CON examen reciben DOS nudges acumulativos y topeados. La DEBILIDAD se modula por α;
  // la PRIORIDAD es un nudge FIJO (sin α) → vale aunque alpha=0 (OFF). Adelanto total ≤ α·D + P. SIN examen ⇒ +∞.
  const effectiveDays = (t: { subjectId: string; weakness?: number }): number => {
    const examDays = examDaysFor(examBySubject.get(t.subjectId) ?? null, now);
    if (examDays >= Number.MAX_SAFE_INTEGER) return Number.POSITIVE_INFINITY;
    return (
      examDays -
      alpha * NUDGE_MAX_DAYS * (t.weakness ?? 0) -
      PRIORITY_NUDGE_DAYS * prio(t.subjectId) // prioridad: nudge FIJO, independiente de α
    );
  };
  // score (grupo SIN examen): dificultad de hoy + debilidad (×α) + prioridad (peso FIJO, sin α).
  // Sin datos de debilidad y sin prioridad ⇒ = difficultyRank (idéntico a hoy); una materia prioritaria sube por Wp aun en OFF.
  const score = (t: { subjectId: string; difficulty: TopicDifficulty; weakness?: number }): number =>
    DIFFICULTY_RANK[t.difficulty] +
    alpha * NUDGE_DIFFICULTY_WEIGHT * (t.weakness ?? 0) +
    PRIORITY_NOEXAM_WEIGHT * prio(t.subjectId); // prioridad: peso FIJO, independiente de α

  const ordered = [...pending].sort((a, b) => {
    const ea = effectiveDays(a);
    const eb = effectiveDays(b);
    if (ea !== eb) return ea - eb; // urgencia (con ambos nudges); +∞ = sin examen va al final
    return score(b) - score(a); // desempate: dificultad (+ debilidad si α>0, + prioridad siempre)
  });
```

> Invariante (README §3.6): con `alpha=0` o `weakness` ausente en todos, `effectiveDays = examDays` y `score = difficultyRank` → orden **idéntico a hoy**. Los temas sin examen (+∞) siempre van después de los que tienen examen.

- [ ] **Step 2: Enriquecer buildPlanInput en planner.service.ts (try/catch → degrada)**

En `apps/api/src/modules/planner/planner.service.ts`:

(a) imports:

```typescript
import { progressService } from '../progress/progress.service.js';
import { preferencesService } from '../preferences/preferences.service.js';
import { INTENSITY_ALPHA } from '../progress/progress.formula.js';
import { logger } from '../../lib/logger.js';
```

(b) reemplazar `buildPlanInput` para sumar weakness + α de forma aditiva y a prueba de fallos:

```typescript
async function buildPlanInput(userId: string): Promise<GeneratePlanInput> {
  const subjects = await subjectRepository.findManyByUserWithTopics(userId);
  const availability = await studyRepository.getAvailability(userId);

  // I-2 (capa 2): debilidad (objetiva) + intensidad + materias prioritarias (preferencia). Si algo falla,
  // degradamos a SIN señal (= comportamiento de hoy).
  let weaknessMap = new Map<string, number>();
  let alpha = 0;
  let prioritySubjectIds: string[] = [];
  try {
    const [map, prefs] = await Promise.all([
      progressService.getWeaknessMap(userId),
      preferencesService.get(userId),
    ]);
    weaknessMap = map;
    alpha = INTENSITY_ALPHA[prefs.remediationIntensity];
    prioritySubjectIds = prefs.prioritySubjectIds;
  } catch (err) {
    logger.error('planner: weakness/priority enrichment failed; degradando a baseline de hoy', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      examDate: s.examDate ? s.examDate.toISOString() : null,
    })),
    topics: subjects.flatMap((s) =>
      s.topics.map((t) => ({
        id: t.id,
        subjectId: t.subjectId,
        name: t.name,
        status: t.status as TopicStatus,
        difficulty: t.difficulty as TopicDifficulty,
        weakness: weaknessMap.get(t.id) ?? 0,
      })),
    ),
    availability: availability.map((a) => ({ weekday: a.weekday, minutes: a.minutes })),
    remediationAlpha: alpha,
    prioritySubjectIds,
  };
}
```

- [ ] **Step 3: Escribir el golden test (sin datos = hoy) + el test de blend**

Agregar al final del `describe` en `apps/api/src/modules/planner/__tests__/planner.distribution.test.ts`. Primero, en el `beforeEach`, mockear los nuevos servicios para que por defecto NO aporten señal (ver nota abajo). Agregar estos mocks arriba con los otros `vi.mock`:

```typescript
vi.mock('../../progress/progress.service.js', () => ({
  progressService: { getWeaknessMap: vi.fn(async () => new Map<string, number>()) },
}));
vi.mock('../../preferences/preferences.service.js', () => ({
  preferencesService: { get: vi.fn(async () => ({ remediationIntensity: 'LOW', prioritySubjectIds: [], weightQuiz: null, weightSrs: null, dailyGoalMinutes: null })) },
}));
```

e importarlos para manipularlos en los tests nuevos:

```typescript
import { progressService } from '../../progress/progress.service.js';
import { preferencesService } from '../../preferences/preferences.service.js';
import { RemediationIntensity } from '@bract/shared';
```

Tests nuevos:

```typescript
it('GOLDEN: sin datos de debilidad Y sin materias prioritarias ⇒ orden idéntico al baseline de hoy', async () => {
  // Misma data que el test de urgencia. weaknessMap vacío + prioritySubjectIds=[] (defaults del beforeEach):
  // ambos términos (debilidad y prioridad) en 0 ⇒ effectiveDays=examDays ⇒ idéntico a hoy, con cualquier α.
  vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
    { ...subj('urgent', 2), topics: [topic('u_a', 'urgent')] },
    { ...subj('later', 10), topics: [topic('l_a', 'later')] },
  ]);
  vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

  await plannerService.generatePlan('u1');

  const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
  // El primer bloque sigue siendo el de la materia con examen más cercano.
  expect(items[0]!.topicId).toBe('u_a');
});

it('con HIGH intensity, un tema flojo con examen algo más lejano puede adelantarse', async () => {
  // urgente: examen en 8 días, no flojo. later: examen en 10 días, muy flojo.
  vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
    { ...subj('urgent', 8), topics: [topic('u_a', 'urgent')] },
    { ...subj('later', 10), topics: [topic('l_a', 'later')] },
  ]);
  vi.mocked(progressService.getWeaknessMap).mockResolvedValue(new Map([['l_a', 1]]));
  vi.mocked(preferencesService.get).mockResolvedValue({
    remediationIntensity: RemediationIntensity.HIGH,
    prioritySubjectIds: [],
    weightQuiz: null,
    weightSrs: null,
    dailyGoalMinutes: null,
  });
  vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

  await plannerService.generatePlan('u1');

  const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
  // l_a: effectiveDays = 10 - 1*7*1 = 3 < 8 ⇒ se adelanta a u_a.
  expect(items[0]!.topicId).toBe('l_a');
});

it('PRIORIDAD independiente de α: en OFF, una materia prioritaria con examen algo más lejano igual se adelanta', async () => {
  // urgente: examen en 5 días, NO prioritaria. priori: examen en 7 días, prioritaria. SIN datos de debilidad.
  // remediationIntensity=OFF ⇒ α=0 ⇒ el nudge de DEBILIDAD se anula, pero el de PRIORIDAD (fijo) sigue aplicando.
  vi.mocked(subjectRepository.findManyByUserWithTopics).mockResolvedValue([
    { ...subj('urgent', 5), topics: [topic('u_a', 'urgent')] },
    { ...subj('priori', 7), topics: [topic('p_a', 'priori')] },
  ]);
  vi.mocked(preferencesService.get).mockResolvedValue({
    remediationIntensity: RemediationIntensity.OFF,
    prioritySubjectIds: ['priori'],
    weightQuiz: null,
    weightSrs: null,
    dailyGoalMinutes: null,
  });
  vi.mocked(studyRepository.createActivePlan).mockResolvedValue(activePlan());

  await plannerService.generatePlan('u1');

  const [, items] = vi.mocked(studyRepository.createActivePlan).mock.calls[0]!;
  // p_a: effectiveDays = 7 - 0 (α=0, sin nudge de debilidad) - 3*1 (prioridad FIJA) = 4 < 5 ⇒ se adelanta a u_a.
  // Prueba clave: la prioridad NO depende de α (vale aun en OFF) y no toca el weakness.
  expect(items[0]!.topicId).toBe('p_a');
});
```

> Nota sobre los tests existentes: como ahora `buildPlanInput` llama a `progressService`/`preferencesService`, los tests previos del archivo siguen verdes gracias a los mocks por defecto del `beforeEach` (map vacío + LOW). Asegurate de que `vi.mocked(progressService.getWeaknessMap).mockResolvedValue(new Map())` y el de prefs estén en el `beforeEach`.

- [ ] **Step 4: Correr la suite del planner**

Run: `pnpm --filter ./apps/api exec vitest run src/modules/planner`
Expected: PASS (incluye los 2 tests nuevos y los previos sin regresión).

- [ ] **Step 5: Hint opcional al prompt de la IA (aditivo, sin romper)**

En `apps/api/src/lib/ai/ai.prompts.ts`, `buildPlanUserPrompt` recibe `input` (con `topics[].weakness`). Agregar, **solo si hay temas con `weakness > 0`**, una línea al prompt listando los topicIds más flojos (top 5) como sugerencia. Si ninguno tiene weakness, el prompt queda **idéntico**. Abrir el archivo y seguir su estilo de armado de string; mantener el cambio acotado a un bloque condicional. La salida de la IA se sigue validando con `validateAndClampPlan` (no hay nuevo riesgo).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter ./apps/api typecheck`
Expected: PASS.

```bash
git add apps/api/src/lib/ai/ai.service.ts apps/api/src/lib/ai/ai.prompts.ts apps/api/src/modules/planner/planner.service.ts apps/api/src/modules/planner/__tests__/planner.distribution.test.ts
git commit -m "feat(planner): términos separados de debilidad + prioridad (aditivos) en el baseline + golden test (I-2 F5)"
```

---

## FASE 6 — Integración Chat (capa 3, aditivo)

### Task 14: weakTopics en el contexto del estudiante + golden test

**Files:**
- Modify: `apps/api/src/lib/ai/ai.context.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Test: `apps/api/src/lib/ai/__tests__/ai.context.test.ts`

- [ ] **Step 1: Extender StudentContext (aditivo) y el render condicional**

En `apps/api/src/lib/ai/ai.context.ts`:

(a) agregar el campo opcional a la interfaz:

```typescript
export interface StudentContext {
  subjects: StudentContextSubject[];
  pendingTopicCount: number;
  completedTopicCount: number;
  nextExam: { subjectName: string; examDate: string; daysUntilExam: number } | null;
  weakTopics?: { name: string; weakness: number }[]; // I-2 (capa 3). Ausente ⇒ prompt idéntico a hoy.
}
```

(b) hacer que `assembleStudentContext` acepte el dato opcional **sin cambiar el comportamiento por defecto**:

```typescript
export function assembleStudentContext(
  subjects: SubjectWithTopics[],
  now: Date = new Date(),
  weakTopics?: { name: string; weakness: number }[],
): StudentContext {
```

y, justo antes del `return`, incorporarlo solo si viene con datos:

```typescript
  const ctx: StudentContext = { subjects: ctxSubjects, pendingTopicCount, completedTopicCount, nextExam };
  if (weakTopics && weakTopics.length > 0) {
    ctx.weakTopics = weakTopics;
  }
  return ctx;
}
```

(c) en `renderContextForPrompt`, agregar el bloque **solo si hay weakTopics** (antes del `return lines.join('\n')`):

```typescript
  if (ctx.weakTopics && ctx.weakTopics.length > 0) {
    const names = ctx.weakTopics.map((w) => `${w.name} (${Math.round(w.weakness * 100)}%)`);
    lines.push(`Temas más flojos (priorizá reforzarlos): ${names.join(', ')}.`);
  }
```

- [ ] **Step 2: Pasar weakTopics desde el chat.service (try/catch → degrada)**

En `apps/api/src/modules/chat/chat.service.ts`:

(a) import:

```typescript
import { progressService } from '../progress/progress.service.js';
```

(b) reemplazar el armado de contexto (líneas ~165-166):

```typescript
    const subjects = await plannerService.listSubjects(userId);
    // I-2 (capa 3): top puntos débiles para ajustar explicaciones. Si falla, contexto = hoy.
    let weakTopics: { name: string; weakness: number }[] | undefined;
    try {
      const weak = await progressService.getWeakTopics(userId, 5);
      if (weak.length > 0) weakTopics = weak.map((w) => ({ name: w.name, weakness: w.weakness }));
    } catch (err) {
      logger.error('chat: weak-topics enrichment failed; contexto sin debilidad', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const context = assembleStudentContext(subjects, new Date(), weakTopics);
```

> El streaming, el historial, `buildChatSystemPrompt` y el manejo de disconnect **no cambian**. El único cambio es el contenido del contexto (un bloque extra de texto, condicional).

- [ ] **Step 3: Golden test del contexto**

Agregar a `apps/api/src/lib/ai/__tests__/ai.context.test.ts`:

```typescript
it('GOLDEN: sin weakTopics ⇒ el prompt es idéntico a hoy', () => {
  const subjects = [
    { id: 's1', userId: 'u1', name: 'Mate', examDate: null, color: null, createdAt: '', updatedAt: '', topics: [] },
  ] as unknown as Parameters<typeof assembleStudentContext>[0];
  const withoutArg = renderContextForPrompt(assembleStudentContext(subjects));
  const withEmpty = renderContextForPrompt(assembleStudentContext(subjects, new Date(), []));
  expect(withEmpty).toBe(withoutArg); // pasar [] no agrega bloque
  expect(withoutArg).not.toContain('flojos');
});

it('con weakTopics ⇒ agrega el bloque de puntos débiles', () => {
  const subjects = [
    { id: 's1', userId: 'u1', name: 'Mate', examDate: null, color: null, createdAt: '', updatedAt: '', topics: [] },
  ] as unknown as Parameters<typeof assembleStudentContext>[0];
  const rendered = renderContextForPrompt(
    assembleStudentContext(subjects, new Date(), [{ name: 'Álgebra', weakness: 0.8 }]),
  );
  expect(rendered).toContain('Álgebra');
  expect(rendered).toContain('flojos');
});
```

> Si `renderContextForPrompt` / `assembleStudentContext` no están importados en el test, agregarlos al import existente desde `'../ai.context.js'`.

- [ ] **Step 4: Correr la suite de ai.context + typecheck**

Run: `pnpm --filter ./apps/api exec vitest run src/lib/ai/__tests__/ai.context.test.ts && pnpm --filter ./apps/api typecheck`
Expected: PASS (golden + bloque nuevo, sin regresión).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/ai/ai.context.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/lib/ai/__tests__/ai.context.test.ts
git commit -m "feat(chat): puntos débiles en el contexto del tutor (aditivo) + golden test (I-2 F6)"
```

---

## FASE 7 — Verificación

### Task 15: Verificación integral

**Files:** (sin cambios de código salvo fixes que surjan)

- [ ] **Step 1: Suite completa de backend**

Run: `pnpm --filter ./apps/api test`
Expected: PASS (todas las suites, incluidas progress.formula, progress.service, planner golden, ai.context golden).

- [ ] **Step 2: Typecheck + lint de todo el monorepo**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS en `@bract/shared`, `@bract/api`, `@bract/web`.

- [ ] **Step 3: Revisión de no-N+1 (SQL emitido)**

Levantar la API con log de queries Prisma (temporalmente, en `apps/api/src/prisma/client.ts`, instanciar con `log: ['query']` si no lo está — revertir luego). Pegar `GET /api/v1/progress/overview` con un usuario con varias materias/temas y confirmar que el nº de queries es **constante** (≈4: árbol, quiz groupBy, srs groupBy total, srs groupBy due) y NO crece con la cantidad de temas. Documentar el conteo en el commit.

- [ ] **Step 4: Verificación manual de degradación (capas 2 y 3)**

- Usuario SIN quizzes/flashcards: `/progress` muestra `EmptyState`; generar plan → mismo orden que antes; chat → system prompt sin bloque de débiles.
- Usuario CON datos + `remediationIntensity=OFF`: plan idéntico al de hoy (la debilidad no influye).
- Usuario CON datos + `HIGH`: el plan adelanta temas flojos; el chat menciona reforzarlos.

- [ ] **Step 5: Checklist CLAUDE.md**

Confirmar: envelopes correctos en los 3 endpoints nuevos; rutas con `authenticate`; sin `console.log`; sin `any` injustificado; sin imports relativos cross-package (usar `@bract/shared`); componentes con loading·empty·error·success; queries sin N+1; nombres consistentes.

- [ ] **Step 6: Commit final / cierre**

```bash
git add -A
git commit -m "chore(progress): verificación I-2 (tests verdes, no-N+1, degradación) (F7)"
```

> **No mergear** (instrucción del usuario). Al terminar F7, reportar estado y dejar la rama para revisión.

---

## Self-Review (hecho)

- **Cobertura del spec §3.6:** modelos (Task 1/10) · fórmula quiz+SRS OBJETIVA, sin prioridad (Task 3) · pesos por prefs (Task 3/11) · blend "nudge en días" con DOS términos separados (debilidad + prioridad) + caso sin-examen (Task 13) · enriquecimiento chat (Task 14) · endpoints §5.5 (Task 6/11) · degradación con try/catch (Task 13/14) · dashboard 4 estados + EmptyState + i18n + tokens (Task 8/9). ✔
- **Debilidad ≠ prioridad (ajuste pre-F2/F4/F5):** `weakness` 100% objetivo (quiz + SRS); `PRIORITY_BOOST` eliminado de la fórmula; la prioridad es un término propio del planner (`PRIORITY_NUDGE_DAYS`/`PRIORITY_NOEXAM_WEIGHT`), **independiente de α** (nudge fijo, vale aun en OFF), topeado, después de la urgencia de examen. Invariante "idéntico a hoy" = sin datos de debilidad **Y** sin materias prioritarias. Golden test intacto + test de prioridad en OFF. UI de prioridad (multiselect) incluida en v1 (Task 12). ✔
- **Sin placeholders:** todo step de código incluye el código real. Las únicas instrucciones "abrí el archivo y seguí el estilo" son para `ai.prompts.ts` (hint opcional) y para confirmar nombres del design system — ambos acotados y verificables por typecheck/lint. ✔
- **Consistencia de tipos:** `RemediationIntensity`, `UserStudyPreferences`, `TopicSignals`, `ResolvedPreferences`, `WeaknessResult`, `progressService.{getOverview,getWeakTopics,getWeaknessMap}`, `INTENSITY_ALPHA`, `GeneratePlanInput.{topics[].weakness,remediationAlpha}` se usan con el mismo nombre/firma en todas las tasks. ✔
- **db push aislado:** Task 10 Step 3 lo delega al usuario (no lo corre el plan). ✔
