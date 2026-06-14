import apiClient from '../../../lib/axios';
import type {
  ProgressOverview,
  WeakTopic,
  UserStudyPreferences,
  UpdatePreferencesInput,
} from '@bract/shared';

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

  async getPreferences(): Promise<UserStudyPreferences> {
    const res = await apiClient.get<Envelope<{ preferences: UserStudyPreferences }>>('/preferences');
    return res.data.data.preferences;
  },

  async updatePreferences(input: UpdatePreferencesInput): Promise<UserStudyPreferences> {
    const res = await apiClient.put<Envelope<{ preferences: UserStudyPreferences }>>('/preferences', input);
    return res.data.data.preferences;
  },
};
