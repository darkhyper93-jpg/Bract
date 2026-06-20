// Gamificación (Agente J) — README §3.7 / §8.11. Capa de LECTURA: el cliente solo consume
// GET /gamification/summary; el XP/quests/jefe/racha se mutan server-side POR EFECTO de acciones reales
// (anti-trampa — el cliente no puede "darse" XP). Los mappers Prisma→shared (Date→ISO, enum casteado) y la
// derivación del nivel (levelForXp) viven en el service. La curva/constantes están en lib/gamification.xp.

// Espejan los enums de Prisma. Zod los consumiría con z.nativeEnum (acá no hay input del cliente que validar).
export enum QuestType {
  COMPLETE_QUIZ = 'COMPLETE_QUIZ',
  REVIEW_DUE_CARDS = 'REVIEW_DUE_CARDS',
  COMPLETE_PLAN_ITEMS = 'COMPLETE_PLAN_ITEMS',
  DEFEAT_BOSS = 'DEFEAT_BOSS',
}

export enum QuestStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

export enum BossStatus {
  ACTIVE = 'ACTIVE',
  DEFEATED = 'DEFEATED',
}

// Estado del jugador (vista derivada para la UI). El `level` NO se persiste: el service lo deriva con
// `levelForXp(totalXp)`; `xpIntoLevel`/`xpForNextLevel` arman la barra de XP (fill = into/forNext).
export interface GamificationProfile {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number; // escudos de gracia (racha perdonadora)
  lastStudyDate: string | null; // ISO date del último día que contó para la racha
}

// Misión diaria (generada lazy al leer el summary, idempotente por (userId, date, type)).
export interface DailyQuest {
  type: QuestType;
  target: number;
  progress: number;
  status: QuestStatus;
  xpReward: number;
  completedAt: string | null; // ISO; set al completar
}

// Jefe del día = el tema más flojo de I-2. `null` en el summary cuando no hay datos de debilidad (sin jefe).
export interface DailyBoss {
  topicId: string | null; // FK de agrupación (SetNull al borrar el tema); el snapshot lo mantiene legible
  topicName: string;
  subjectName: string;
  maxHp: number;
  hp: number; // restante (0 = vencido)
  status: BossStatus;
  xpReward: number;
  defeatedAt: string | null; // ISO; set al vencerlo
}

// Respuesta de GET /gamification/summary.
export interface GamificationSummary {
  profile: GamificationProfile;
  quests: DailyQuest[];
  boss: DailyBoss | null; // null = sin datos de debilidad (I-2) ⇒ no hay jefe hoy (EmptyState en la Home)
}
