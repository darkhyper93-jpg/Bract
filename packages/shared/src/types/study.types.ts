// Producto — Estudio con IA · Disponibilidad y Plan (cronograma) — README §3.3
// Unidad de tiempo: minutos (la UI muestra horas; la conversión es de presentación) — §3.4.

import { Topic } from './subject.types';

export enum StudyPlanStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum StudyPlanItemStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export interface StudyAvailability {
  id: string;
  userId: string;
  weekday: number; // 0=Domingo ... 6=Sábado
  minutes: number; // minutos disponibles ese día
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlan {
  id: string;
  userId: string;
  status: StudyPlanStatus;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlanItem {
  id: string;
  planId: string;
  topicId: string;
  date: string; // día asignado (ISO)
  order: number | null; // orden del bloque dentro del mismo día
  estimatedMinutes: number;
  status: StudyPlanItemStatus; // bloque del día (≠ Topic.status global)
  completedAt: string | null;
  createdAt: string;
}

// Item enriquecido con su tema (render día por día sin re-fetch). El Agente C arma el include.
export interface StudyPlanItemWithTopic extends StudyPlanItem {
  topic: Topic;
}

// Plan ACTIVE con sus bloques (respuesta de GET /study/plan). El agrupado por día es del Agente C.
export interface StudyPlanWithItems extends StudyPlan {
  items: StudyPlanItemWithTopic[];
}
