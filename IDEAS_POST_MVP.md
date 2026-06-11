# 🚩 IDEAS POST-MVP — Recordar DESPUÉS del Agente H

> **NO implementar hasta cerrar el MVP (E ✅ → F → G → H).** Son features nuevas, no polish.
> Spec-first: agregar al README antes de codear. Reusan lib/ai (B), modelos (A) y SRS (D).

## Agente I — "Modo Práctica / Evaluación" (5 ideas en UNA feature coherente)

El flujo conecta las 5 ideas que pidió el usuario, no son sueltas:

1. **Generar quiz por tema** (preguntas estructuradas con opciones) — reusa la generación de B.
2. **Cobertura completa sin huecos** — la IA descompone el tema en subconceptos y asegura que las
   preguntas/cartas cubran todo, sin repetir. (La más sofisticada: probablemente necesita una capa
   de subconceptos por Topic.)
3. **Corrección con explicación por opción** — por qué la correcta es correcta y por qué tu elección
   estuvo mal. Reusa lib/ai.
4. **Evaluar progreso** — vista agregada que sintetiza Topic.status + estado SRS + resultados de quiz
   ("dominás 70% de Mate, flojo en integrales").
5. **Detectar puntos débiles** — cruza flashcards/quizzes/temas para señalar dónde flaqueás; los
   resultados retroalimentan el SRS y el contexto del chat.

**Diseño sugerido:** modelos nuevos para intentos/resultados de quiz; endpoints de generar/corregir/
analizar; UI de quiz + vista de progreso/puntos débiles. Encaja como Agente I con su propia spec.

**Estado:** PENDIENTE — retomar cuando H confirme el MVP completo y deployado.

## Agente J — "Progresión gamificada y adaptativa"

Sistema de progresión interactivo tipo juego: **misiones adaptadas a las metas y horarios del
estudiante**, integradas al track de progreso adaptativo (se conecta con planner + SRS + evaluación).

**Referencias de diseño/UX (capturar al construir):**
- **codex.io** ← la que más le gustó al usuario, sobre todo el DISEÑO. Inspirarse principalmente acá.
- **Arise** (app de fitness) — sistema de progresión/misiones.
- **coddy.tech** — otro estilo de la misma función.

**Notas:** gamificación = retención/engagement en apps de estudio. Las misiones deben adaptarse a
metas + horarios (reusa la disponibilidad y el planner) y al progreso real (reusa SRS + evaluación
del Agente I). Post-MVP, feature/agente nuevo, spec-first. Revisar codex.io en detalle al diseñar.

**Estado:** PENDIENTE.
