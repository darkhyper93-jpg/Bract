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
