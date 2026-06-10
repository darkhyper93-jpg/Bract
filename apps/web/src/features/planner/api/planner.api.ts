import apiClient from '../../../lib/axios';
import type {
  Subject,
  SubjectWithTopics,
  Topic,
  TopicStatus,
  StudyAvailability,
  StudyPlanItem,
  StudyPlanWithItems,
  StudyPlanItemStatus,
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateTopicInput,
  UpdateTopicInput,
  SetAvailabilityInput,
} from '@bract/shared';

// Capa api/ del Planificador (Agente C). Funciones tipadas que consumen las rutas §5.5.
// Todas devuelven el `data` desempaquetado del envelope `{ success, data }`.

interface Envelope<T> {
  success: true;
  data: T;
}

export const plannerApi = {
  // ---- Materias ----
  async listSubjects(): Promise<SubjectWithTopics[]> {
    const res = await apiClient.get<Envelope<{ subjects: SubjectWithTopics[] }>>('/subjects');
    return res.data.data.subjects;
  },

  async createSubject(input: CreateSubjectInput): Promise<Subject> {
    const res = await apiClient.post<Envelope<{ subject: Subject }>>('/subjects', input);
    return res.data.data.subject;
  },

  async updateSubject(id: string, input: UpdateSubjectInput): Promise<Subject> {
    const res = await apiClient.patch<Envelope<{ subject: Subject }>>(`/subjects/${id}`, input);
    return res.data.data.subject;
  },

  async deleteSubject(id: string): Promise<void> {
    await apiClient.delete(`/subjects/${id}`);
  },

  // ---- Temas ----
  async createTopic(subjectId: string, input: CreateTopicInput): Promise<Topic> {
    const res = await apiClient.post<Envelope<{ topic: Topic }>>(
      `/subjects/${subjectId}/topics`,
      input,
    );
    return res.data.data.topic;
  },

  async updateTopic(id: string, input: UpdateTopicInput): Promise<Topic> {
    const res = await apiClient.patch<Envelope<{ topic: Topic }>>(`/topics/${id}`, input);
    return res.data.data.topic;
  },

  async deleteTopic(id: string): Promise<void> {
    await apiClient.delete(`/topics/${id}`);
  },

  // Completar/cambiar estado de un tema → el backend recalcula el plan activo y lo devuelve.
  async updateTopicStatus(
    id: string,
    status: TopicStatus,
  ): Promise<{ topic: Topic; plan: StudyPlanWithItems | null }> {
    const res = await apiClient.patch<Envelope<{ topic: Topic; plan: StudyPlanWithItems | null }>>(
      `/topics/${id}/status`,
      { status },
    );
    return res.data.data;
  },

  // ---- Disponibilidad ----
  async getAvailability(): Promise<StudyAvailability[]> {
    const res = await apiClient.get<Envelope<{ availability: StudyAvailability[] }>>(
      '/study/availability',
    );
    return res.data.data.availability;
  },

  async setAvailability(input: SetAvailabilityInput): Promise<StudyAvailability[]> {
    const res = await apiClient.put<Envelope<{ availability: StudyAvailability[] }>>(
      '/study/availability',
      input,
    );
    return res.data.data.availability;
  },

  // ---- Plan ----
  async getPlan(): Promise<StudyPlanWithItems | null> {
    const res = await apiClient.get<Envelope<{ plan: StudyPlanWithItems | null }>>('/study/plan');
    return res.data.data.plan;
  },

  async generatePlan(): Promise<StudyPlanWithItems> {
    const res = await apiClient.post<Envelope<{ plan: StudyPlanWithItems }>>(
      '/study/plan/generate',
      {},
    );
    return res.data.data.plan;
  },

  // Marcar un bloque del día (COMPLETED/SKIPPED); SKIPPED recalcula y devuelve el plan.
  async updatePlanItem(
    id: string,
    status: StudyPlanItemStatus,
  ): Promise<{ item: StudyPlanItem; plan: StudyPlanWithItems | null }> {
    const res = await apiClient.patch<
      Envelope<{ item: StudyPlanItem; plan: StudyPlanWithItems | null }>
    >(`/study/plan/items/${id}`, { status });
    return res.data.data;
  },
};
