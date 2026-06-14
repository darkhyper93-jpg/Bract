import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../progress.repository.js', () => ({
  progressRepository: {
    getSubjectTree: vi.fn(),
    getQuizStatsByTopic: vi.fn(),
    getSrsStatsByTopic: vi.fn(),
  },
}));

import { progressRepository } from '../progress.repository.js';
import { progressService } from '../progress.service.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(progressRepository.getSrsStatsByTopic).mockResolvedValue([]);
  vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([]);
  vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([]);
});

describe('progressService.getOverview', () => {
  it('sin datos ⇒ subjects con temas hasData=false y totals vacíos', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      { id: 's1', name: 'Mate', topics: [{ id: 't1', name: 'Álgebra' }] },
    ]);
    const ov = await progressService.getOverview('u1');
    expect(ov.subjects[0]!.topics[0]!.hasData).toBe(false);
    expect(ov.totals.topicsWithData).toBe(0);
    expect(ov.totals.weakestTopicId).toBeNull();
  });

  it('cruza quiz por tema → accuracy + weakness', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      { id: 's1', name: 'Mate', topics: [{ id: 't1', name: 'Álgebra' }] },
    ]);
    vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([
      { topicId: 't1', answered: 4, correct: 1 },
    ]);
    const ov = await progressService.getOverview('u1');
    const topic = ov.subjects[0]!.topics[0]!;
    expect(topic.hasData).toBe(true);
    expect(topic.accuracy).toBeCloseTo(0.25, 5);
    expect(topic.weakness).toBeCloseTo(0.75, 5);
    expect(ov.totals.topicsWithData).toBe(1);
    expect(ov.totals.weakestTopicId).toBe('t1');
  });
});

describe('progressService.getWeakTopics', () => {
  it('ordena por weakness desc y omite temas sin datos; respeta limit', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      {
        id: 's1',
        name: 'Mate',
        topics: [
          { id: 't1', name: 'Álgebra' },
          { id: 't2', name: 'Geometría' },
          { id: 't3', name: 'SinDatos' },
        ],
      },
    ]);
    vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([
      { topicId: 't1', answered: 4, correct: 3 },
      { topicId: 't2', answered: 4, correct: 0 },
    ]);
    const weak = await progressService.getWeakTopics('u1', 5);
    expect(weak.map((w) => w.topicId)).toEqual(['t2', 't1']);
    expect(weak[0]!.subjectName).toBe('Mate');

    const limited = await progressService.getWeakTopics('u1', 1);
    expect(limited).toHaveLength(1);
    expect(limited[0]!.topicId).toBe('t2');
  });
});

describe('progressService.getWeaknessMap', () => {
  it('devuelve Map topicId→weakness solo de temas con datos', async () => {
    vi.mocked(progressRepository.getSubjectTree).mockResolvedValue([
      { id: 's1', name: 'Mate', topics: [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }] },
    ]);
    vi.mocked(progressRepository.getQuizStatsByTopic).mockResolvedValue([
      { topicId: 't1', answered: 2, correct: 0 },
    ]);
    const map = await progressService.getWeaknessMap('u1');
    expect(map.get('t1')).toBeCloseTo(1, 5);
    expect(map.has('t2')).toBe(false);
  });
});
