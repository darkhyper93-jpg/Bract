import apiClient from '../../../lib/axios';
import type { GamificationSummary } from '@bract/shared';

// Capa api/ de Gamificación (Agente J). SOLO lectura desde el cliente: el XP/misiones/jefe/racha se
// mutan server-side por efecto de las acciones reales (anti-trampa). Devuelve el `data` del envelope.

interface Envelope<T> {
  success: true;
  data: T;
}

export const gamificationApi = {
  async getSummary(): Promise<GamificationSummary> {
    const res = await apiClient.get<Envelope<{ summary: GamificationSummary }>>('/gamification/summary');
    return res.data.data.summary;
  },
};
