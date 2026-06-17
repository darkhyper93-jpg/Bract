import { ConfidenceLevel } from '@bract/shared';
import type { ProgressOverview, SubjectProgress, TopicProgress, WeakTopic } from '@bract/shared';
import { progressRepository } from './progress.repository.js';
import { preferencesService } from '../preferences/preferences.service.js';
import {
  computeTopicWeakness,
  resolvePreferences,
  summarizeCalibration,
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

// F4: lee las prefs reales del usuario y las resuelve a valores concretos (firma intacta desde F2).
async function buildResolvedPreferences(userId: string): Promise<ResolvedPreferences> {
  const prefs = await preferencesService.get(userId);
  return resolvePreferences(prefs);
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
    // computeAll y la calibración son independientes → en paralelo (cada uno con sus propias queries).
    const [computed, calibrationRows] = await Promise.all([
      computeAll(userId),
      progressRepository.getCalibrationStats(userId),
    ]);
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
      // Cast enum Prisma→shared en el boundary del service (mismo patrón que el resto de los mappers).
      calibration: summarizeCalibration(
        calibrationRows.map((r) => ({ ...r, confidence: r.confidence as ConfidenceLevel })),
      ),
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
