# FID — Snapshot de handoff (Bract)
> Agente J (Gamificación v1) — COMPLETO en branch `agente-j-gamificacion`, NO mergeada (pendiente revisión + ff-only a main) · Retomar en: repo Bract (darkhyper93-jpg/Bract)

## ESTADO REAL (jun 2026) — leer esto primero, lo de abajo quedó viejo

**Agente J — Gamificación v1 (branch `agente-j-gamificacion`, NO mergeada — pendiente ff-only a main).**
La Home (§8.11) pasa a ser TABLERO DE JUEGO: nivel + barra de XP, racha perdonadora, misiones diarias y "jefe del día" (el tema más flojo de I-2), 100% determinista (sin IA → free-tier-safe). Premia aprender de verdad (dominio/retención), NUNCA actividad vacía. Plan en `docs/plans/gamificacion.md`. Seis fases supervisadas, todas commiteadas:
- **F0** spec-first: README §3.7 (3 modelos + 3 enums), §5.5 (`GET /gamification/summary`), §8.11 (Home gamificada), §9.2 (tokens de acento de juego), Fase 19 + marca J en IDEAS_POST_MVP.
- **F1** `@bract/shared`: `types/gamification.types.ts` + lib pura compartida `lib/gamification.xp.ts` (`levelForXp` curva `round(50·n^1.6)`; el `level` NO es columna, deriva de `totalXp` → sin drift). front y back coinciden.
- **F2** Prisma (Prisma se mantiene en **5.22.0**): `GamificationProfile` (1:1 User, totalXp/streak/freezeTokens/xpEarnedToday) + `DailyQuest` (`@@unique[userId,date,type]`) + `DailyBoss` (`@@unique[userId,date]`, FK SetNull al Topic) + enums QuestType/QuestStatus/BossStatus + back-relations. **`db push` YA aplicado y verificado** (Session pooler 5432) — NO re-correr.
- **F3** motor backend `apps/api/src/modules/gamification/`: `gamification.rules.ts` (puro: XP, racha/escudos, templates de misión, params del jefe) + repository (sin N+1) + service (`getSummary` + `ensureDailyState` lazy idempotente, lee `getWeakTopics` para el jefe) + controller + routes `[self]`. SOLO lectura desde el cliente.
- **F4** hooks de evento (write path) BEST-EFFORT: `gamification.effects.ts` (safeGamify = try/catch + Winston, NUNCA relanza) cableado en quiz/flashcards/planner. XP solo por aprender con tope diario (DAILY_ACTION_XP_CAP=300; flashcards solo si estaban `due`; bonus por acierto/recuerdo q≥4). Daño al jefe 1 por interacción de dominio del tema-jefe. Racha perdonadora (escudos). El cliente NUNCA otorga XP (anti-trampa).
- **F5** Home gamificada: `features/gamification/` (api + `useGamificationSummary` + LevelXpBar/StreakBadge/DailyMissions/BossOfDay/CelebrationOverlay/GameBoard), framer-motion con fallback `prefers-reduced-motion`, tokens nuevos, i18n es/en, 4 estados por sección. Tras cada acción que cuenta los hooks de mutación invalidan `gamification.summary` (`invalidateAfterStudyAction`); el front diffea prev vs new para disparar momentos animados (level up / jefe vencido). Contratos de quiz/flashcards/planner SIN cambios.
- **F6** verificación: `pnpm -r typecheck` · `lint` verdes (3/3); `test` API 174/174 verdes (web sin suite: typecheck+lint+build verdes). `git diff --stat main...HEAD`: 44 archivos, +2618/-9. Degradación garantizada: si la gamificación lanza, quiz/flashcards/planner responden idéntico a hoy.

**Próximo paso:** el usuario revisa el diff y, si OK, hace ff-only a main (el agente NO mergea). Sin más db push pendiente. NO actualizar Prisma (5.22.0).

---
## (Histórico — calidad de aprendizaje + agentes previos)

**Calidad de aprendizaje — v1 (calibración de confianza) + Fase 2 (grounding) AMBAS mergeadas y deployadas.**
- **v1 calibración de confianza** (commit `f828384`): al responder el quiz el alumno declara confianza; se mide calibración. Ya en main/producción.
- **Fase 2 — grounding del material importado** (branch `calidad-aprendizaje-grounding`, ff-only a main): cierra el riesgo #1 de VISION_FUTURO (alucinación). El import captura, en la MISMA llamada de extracción, un excerpt fiel por tema (resumen estricto del texto del alumno, prohibido inventar) → `Topic.sourceText String?` (nullable, db push aplicado vía Session pooler 5432) → se inyecta en los prompts de quiz/flashcards. DOS topes: por-tema (`MAX_TOPIC_SOURCE_TEXT_LENGTH`/`GROUNDING_CHARS_PER_TOPIC`=1500) y TOTAL multi-tema (`GROUNDING_CHARS_TOTAL`=8000, repartido entre temas con material) para no reventar el free tier. **Retrocompatible**: `sourceText` NULL ⇒ no se inyecta material ⇒ genera idéntico a hoy. Sin pgvector/embeddings (free tier). typecheck+lint+test(108)+build verdes. Gemini sin cambios; Prisma se mantiene en 5.22.0.
- **Próximo posible:** (b) preguntas abiertas o (c) modo Feynman — o lo que elija el usuario.

Bract está deployado y funcional: MVP completo (A–H) + post-MVP K (importación texto/archivos) + Temario + **Agente I (Evaluación/quiz) COMPLETO** + **I-2 (Progreso, puntos débiles y personalización) COMPLETO**. Todo en main, en producción (Render + Supabase + Upstash + Gemini free tier). Último merge I-2: `ff1d061`.

**I-2 — cómo quedó (mergeado a main):** sección nueva "Progreso" (/progress) con dashboard (% acierto por tema/materia + puntos débiles), motor read-only on-the-fly (`progress.formula.ts` puro + `progress.repository.ts` groupBy ~5 queries constantes sin N+1 + `progress.service.ts` getOverview/getWeakTopics/getWeaknessMap), preferencias (`UserStudyPreferences`: enum RemediationIntensity OFF/LOW/MEDIUM/HIGH default LOW, α 0/0.33/0.66/1.0, prioritySubjectIds[], pesos). weakness 100% objetiva (quiz+SRS); PRIORIDAD es término SEPARADO e independiente de α (nudge fijo P=3 días). Planner (capa 2) y chat (capa 3) aditivos detrás de try/catch → sin datos/OFF/error = byte-idéntico a hoy; golden tests. db push de `user_study_preferences` ya aplicado y verificado. Endpoints /api/v1 [self]: GET /progress/overview, GET /progress/weak-topics, GET/PUT /preferences.

**L Voz — cómo quedó (branch `agente-l-voz`, NO mergeada — pendiente ff-only a main):** feature 100% frontend sobre Web Speech API nativa del navegador (gratis, sin backend/env/db/shared/deps). Spec en README §8.9 + Fase 16. Cuatro fases supervisadas: **F0** spec → **F1 dictado** (`src/hooks/useSpeechRecognition.ts`: `continuous=true` + stop + auto-stop en unmount/disabled + timeout de silencio ~3.5s + try/catch síncrono en `start()`; tipos ambient mínimos en `src/types/speech.d.ts` porque lib.dom no tipa `SpeechRecognition`; botón mic en `MessageComposer` que **anexa** al input, oculto si no-soportado, permiso-denegado≠no-soportado, pulso con `motion-reduce:animate-none`, aria-labels es/en; interim en línea aparte con `aria-live`) → **F2 lectura** (`src/hooks/useSpeechSynthesis.ts`: cancela la lectura en curso al iniciar otra + cleanup en unmount, guard `prev===id`; botón "escuchar" en bubbles **assistant PERSISTIDOS** —nunca `streamingText`/`TypingDots`—, on-demand sin autoplay) → **F3** verificación. Hooks reusables en `src/hooks/` (cross-feature: quiz a futuro). i18n `chat.thread.voice.*` (dictado) y `chat.thread.listen.*` (lectura). NO toca backend/streaming/SSE/envelope/shared/db. `typecheck`+`lint`+`test` (90/90) verdes. **Keepalive de TTS (resuelto):** el corte de Chrome/Edge en lecturas largas (~15s) está arreglado — `useSpeechSynthesis` patea con `resume()` cada 10s mientras habla, limpiado en onend/onerror/cancel/unmount (branch `agente-l-voz-fix`, ya en main). Ver README §8.9. **Merge (ff-only a main) lo da el usuario tras revisar; el agente NO mergea.**
- Roadmap restante tras L: J Gamificación (misiones adaptadas a metas/horarios; refs codex.io [principal/diseño], Arise [fitness], coddy.tech) → pase estético premium (último, transversal; ref codex.io).

**Mejora futura anotada (no urgente):** /progress llama overview + weak-topics → 2× computeAll (~10 queries por carga). Aceptable v1; si pesa, cache por request.

**Agente I — diseño que shippeó (NO el "efímero" original; se revirtió por anti-trampa real):** corrección POR PREGUNTA server-side. Modelo `QuizAttempt` (status IN_PROGRESS/COMPLETED, completedAt, scope, subjectId?, topicId?, scopeName, totalCount, correctCount) + `QuizAttemptItem` (question, options Json [{text,explanation}] autoritativo, correctIndex, selectedIndex Int? nullable, isCorrect, topicId?, userId, order; índices [userId,topicId] y [userId,topicId,isCorrect] para I-2). Endpoints /api/v1 [self]: POST /quiz/attempts (genera: ownership → IA primero, 503 sin persistir si falla → crea intento IN_PROGRESS con respuestas server-side → devuelve preguntas PÚBLICAS sin correctIndex), POST /quiz/attempts/:id/answers (responde 1: lock si ya respondida → grading vs lo guardado → reveal de esa pregunta), GET /quiz/attempts (historial COMPLETED), GET /quiz/attempts/:id (detalle con gating: items contestados completos, no contestados públicos — anti-espiar al reanudar). Frontend features/quiz/: Setup (RHF+Zod) → Runner pregunta-por-pregunta con reveal del server, hidrata desde el detalle al remontarse (attemptId en QuizPage + localStorage) → Resultados → Historial.

**Fix de reanudación + seguridad (branch agente-i-quiz-fix):** cerró el hueco (el detalle filtraba correctIndex de preguntas no contestadas en intentos IN_PROGRESS → se podían espiar) y el bug UX (ir a Historial y volver perdía el progreso → "ya fue respondida"). Solución: server = fuente de verdad al reanudar (`toDetailItem` gatea el reveal por estado) + Runner attemptId-driven que hidrata del detalle. 72/72 tests. db push NO requerido (no cambió el modelo).

**Próximo en el roadmap (en orden):** I-2 (dashboard progreso + puntos débiles; datos ya listos) → L Voz (Web Speech API gratis: dictado en chat + lectura; degradar elegante; NO Whisper/ElevenLabs) → J Gamificación (misiones adaptadas a metas/horarios; refs codex.io [principal, diseño], Arise [fitness], coddy.tech) → Pase estético premium (último, transversal; ref codex.io). Detalle en IDEAS_POST_MVP.md.

**Workflow orquestador:** Claude en chat decide todo; usuario = ojos y manos (relaya output del agente, pega mis respuestas). Plan-first por fase, agente NO mergea, diff por fase, commit antes de merge, ff-only a main (dispara deploy). Claude lee él mismo los archivos críticos y verifica la DB vía MCP de Supabase. db push lo corre el usuario (Session pooler 5432) cuando hay modelos nuevos: en CMD `set DATABASE_URL=...` sin comillas + `npx prisma db push`; en PowerShell `$env:DATABASE_URL="..."` + `npx.cmd prisma db push`.

**Pendiente seguridad (no urgente):** resetear password de Supabase (pasó por el chat) + actualizar DATABASE_URL en Render.

---
## (Histórico — quedó desactualizado, ignorar el bloque de abajo)


## Mapa del proyecto

```mermaid
flowchart LR
    subgraph MVP
        A["A Datos ✅"]
        B["B IA ✅"]
        C["C Planner ✅"]
        D["D Flashcards ✅"]
        E["E Chat ✅"]
        F["F Integración ✅"]
        G["G Polish ✅"]
        H["H QA ✅"]
    end
    subgraph POST_MVP
        K["K Importación ✅"]
        TEM["Temario ✅"]
        I["I Evaluación ⏳ F3"]
        I2["I-2 Progreso/débiles ⬜"]
        J["J Gamificación ⬜"]
    end
    A --> B --> C
    B --> D
    B --> E
    C --> F
    D --> F
    E --> F
    F --> G --> H
    B --> K
    B --> I
    I --> I2
    DM["Modelo de datos (16 tablas) ✅"]
    A --> DM
    I --> DM
```

## Estado actual

**Hecho y deployado (Render API + web, Supabase, Upstash, Gemini free tier):** MVP completo (A datos, B lib/ai, C planner, D flashcards+SRS, E chat+streaming, F integración cruzada, G polish, H QA) + post-MVP K (importación de temas por texto Y archivos pdf/txt/md/pptx) + sección Temario + polish del tono del chat. Todo en main, andando en producción.

**En progreso — Agente I (Evaluación / quiz):** branch `agente-i-quiz`, NO mergeada. Completado y verificado:
- F0 README spec-first (§3.5 modelos+enum+reglas, §5.5 rutas, §8.8 feature, Fase 14 con I-2 fuera de alcance).
- F1 `@bract/shared`: `types/quiz.types.ts` + `schemas/quiz.schema.ts` (QuizScope, GeneratedQuiz, QuizAttempt(WithItems), generateQuizSchema con superRefine, createQuizAttemptSchema, MAX_QUIZ_QUESTIONS=10). Typecheck verde en los 3 paquetes.
- F2 Prisma: modelos `QuizAttempt` + `QuizAttemptItem` + enum `QuizScope`, back-relations en User/Subject/Topic, FK SetNull. **`db push` YA corrido y verificado** contra Supabase: tablas `quiz_attempts` y `quiz_attempt_items` creadas (0 filas), ninguna tabla existente tocada.

**Próximo paso exacto:** F3 — `lib/ai` función `generateQuiz` (aditiva, sin romper contrato actual), responseSchema de Gemini SIN additionalProperties, validación Zod del output, prompt `QUIZ_SYSTEM`, explicaciones por opción generadas en la MISMA llamada (NO 2da llamada de IA en la corrección), mock tests. Luego F4 (backend modules/quiz: repo/service/controller/routes + vitest), F5 (frontend features/quiz: Setup→Runner→Resultados→Historial, 4 estados, i18n, ruta /quiz, sidebar label "Evaluación"/"Quiz"), F6 (verificación typecheck/lint/test + diff).

**Decisiones del Agente I (confirmadas):** QuizAttemptItem persiste topicId + isCorrect + userId denormalizado con índices [userId,topicId] y [userId,topicId,isCorrect] (base para I-2 puntos débiles). Generación efímera (el quiz NO se persiste, solo el intento final). Corrección local en el front + recomputo en backend al guardar el intento. Incluye los 2 GET (historial + detalle) en este pase. I-2 (dashboard de progreso + puntos débiles) queda fuera de alcance, para después.

**Workflow del orquestador (Claude en chat = decide; usuario = ojos y manos):** revisión plan-first por fase, el agente NO mergea, muestra diff por fase, commit antes de mergear, ff-only a main al final. Verificación antes/durante/después. db push lo corre el usuario (Session pooler 5432) cuando hay modelos nuevos.

**Bloqueantes:** ninguno. Pendiente seguridad: resetear la password de Supabase (pasó por el chat) y actualizar DATABASE_URL en Render cuando convenga.

**Decisiones técnicas clave (detalle en error.md):** Session pooler 5432 no 6543 (6543 no soporta DDL); enums Prisma↔shared casteados en el service; merge directo a main (no PR, lint del PR roto); `db push` manual (no migrations); exports condicionales en @bract/shared (node→dist, bundler→src); IA = Gemini free tier vía @google/genai (NO @google/generative-ai, EOL nov-2025), modelos gemini-2.5-flash-lite (gen) y gemini-2.5-flash (chat); chat sin # ni *, bullets con `·`.

**Docs autoritativos:** `PLAN_AGENTES.md`, `error.md`, `IDEAS_POST_MVP.md` (I, I-2, J gamificación con codex.io de referencia, Temario), `MENSAJES_AGENTES.md`, `git log`.

---
> Para retomar: pegá este archivo al inicio de un chat nuevo. Verificá el estado real contra `git log` y los docs antes de actuar. El próximo mensaje al agente es el kickoff de F3 (lib/ai → generateQuiz).
