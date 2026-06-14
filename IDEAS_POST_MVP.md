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

## Agente K — Importación masiva de temas (alta prioridad post-MVP)

Cargar temas de a uno es tedioso. Permitir pegar texto grande o **importar archivos (PDF, .txt, .md,
.pptx)** y que una IA extraiga los temas, los clasifique por dificultad, y cree/ajuste la materia.

**Backend:** endpoint que recibe texto (o texto extraído de archivo) + nombre de materia → Gemini
(reusa lib/ai) devuelve temas estructurados + dificultad (JSON validado con Zod). Parsers de archivo:
.txt/.md triviales; PDF (texto, NO escaneados/imagen → eso sería OCR, fuera de alcance inicial); .pptx
(XML de slides). Lógica: si la materia no existe, crear; si existe, AGREGAR sin borrar, con dedup;
borrar/reemplazar SOLO si el usuario lo pide.

**Decisión de diseño clave:** el "borrar/reemplazar" se maneja con un TOGGLE en la UI (agregar vs
reemplazar), NO dejando que la IA interprete intención de borrado desde texto libre (riesgo de perder
temas por una frase ambigua). La IA solo extrae y clasifica.

**Frontend:** pantalla de importación (pegar texto o subir archivos) → elegir materia (existente/nueva)
→ PREVIEW de temas extraídos con dificultad (editable) → confirmar (agregar/reemplazar). El preview es
obligatorio: nada se crea sin que el usuario revise.

**Límites:** tope de tamaño de archivo/texto por costo de tokens; solo PDFs de texto. Reusa A/B/C.

**Estado:** PENDIENTE — alta prioridad (mejora el flujo central de cargar temas).

## Sección Temario + Estudio on-demand (mayormente frontend)

Dar AGENCIA al estudiante: además de seguir el plan del día que arma la IA, poder elegir "hoy quiero
estudiar ESTE tema ahora" y tener las herramientas a mano.

**Qué falta (parte ya existe pero no unificado):** hoy podés estudiar flashcards por tema y
preguntarle al chat de cualquier tema, pero está organizado por sección (planner/flashcards/chat), no
por tema. Falta:
- Una sección **Temario**: vista de primera clase de todas las materias y sus temas (overview navegable).
- Un flujo **centrado en el tema**: entrar a un tema → estudiarlo on-demand con sus herramientas
  juntas (sus flashcards, el chat enfocado en ese tema, su material/contenido a futuro), independiente
  del plan del día.

**Notas:** mayormente frontend, reusa flashcards (D), chat (E), modelos (A). El chat enfocado en un
tema = pasarle ese tema como foco del contexto. Encaja bien con el Agente K (importación) y con I
(evaluación: "quiz de este tema ahora").

**Estado:** PENDIENTE.

## Agente L — Función por voz (alta utilidad, costo casi cero)

El usuario lo pidió: escribir y escribir es tedioso, sobre todo en el chat tutor. Dos partes:

1. **Voz → texto (dictado)** — botón de micrófono en el input del chat (y opcionalmente en respuestas
   de quiz a futuro). El usuario habla y se transcribe al input; puede editar antes de enviar.
2. **Texto → voz (lectura)** — botón de "escuchar" en las respuestas del tutor, para estudiar con los
   ojos descansados o mientras hace otra cosa.

**Decisión de diseño clave — usar la Web Speech API del navegador (gratis, nativa, sin backend):**
`SpeechRecognition` para dictado y `SpeechSynthesis` para lectura. CERO costo de tokens/API, no agrega
infra ni dependencias de servidor — encaja con la restricción de free tier. Trade-off honesto: soporte
desigual entre navegadores (Chrome/Edge muy bien; Firefox/Safari parcial) y requiere internet. Aceptable:
degradar elegante (si el navegador no soporta, se oculta el botón, el chat sigue funcionando por texto).
NO usar Whisper/Gemini-audio/ElevenLabs por ahora (cuestan plata o cómputo).

**Alcance sugerido:** mayormente frontend. Empezar por el dictado en el chat (resuelve el dolor directo),
después la lectura de respuestas. Spec-first al README. Estados claros: idle · escuchando · transcribiendo ·
error/no-soportado.

**Estado:** PENDIENTE — alta utilidad, bajo costo. Buen candidato para después de I/I-2.

## Pase estético / UI premium (transversal)

El usuario quiere que la web se vea **premium**, no solo que funcione. El "G Polish" fue funcional
(eslint, i18n, fechas); esto es lo VISUAL. Pase dedicado de diseño:
- Consistencia de tokens (color, espaciado, tipografía, radios, sombras) en todos los componentes.
- Micro-interacciones y transiciones suaves (hover, focus, loading skeletons con buen ritmo).
- Jerarquía visual y respiración (densidad, alineación, estados vacíos atractivos).
- Coherencia de la identidad en todas las secciones (planner, flashcards, chat, temario, evaluación).
- **Referencia de diseño: codex.io** (la que más le gustó al usuario) — capturar ese feel.

**Notas:** transversal, frontend. Mejor hacerlo cuando estén todas las features para no repintar dos
veces. Reusa los tokens CSS ya definidos en el README; no hardcodear colores fuera de tokens.

**Estado:** PENDIENTE — idealmente el último gran pase, una vez completas las features.
