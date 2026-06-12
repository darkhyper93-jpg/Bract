import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Subject as PrismaSubject } from '@prisma/client';
import { ImportMode, TopicDifficulty } from '@bract/shared';
import { AppError } from '../../../lib/errors.js';

// Mockeamos el repo (Prisma) y la capa de IA: el service corre real, sin DB ni red.
vi.mock('../import.repository.js', () => ({
  importRepository: {
    findSubjectWithTopicNames: vi.fn(),
    createSubject: vi.fn(),
    applyImport: vi.fn(),
  },
}));
vi.mock('../../../lib/ai/index.js', () => ({
  extractTopics: vi.fn(),
}));

import { importRepository } from '../import.repository.js';
import { extractTopics } from '../../../lib/ai/index.js';
import { importService } from '../import.service.js';

const now = new Date('2026-06-12T00:00:00.000Z');

function makeSubject(over: Partial<PrismaSubject> = {}): PrismaSubject {
  return {
    id: 's1',
    userId: 'u1',
    name: 'Matemática',
    examDate: null,
    color: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // applyImport por defecto devuelve cuántas filas recibió (= temas creados).
  vi.mocked(importRepository.applyImport).mockImplementation((_id, _replace, rows) =>
    Promise.resolve(rows.length),
  );
});

describe('extractPreview', () => {
  it('delega en la IA y pasa el subjectName como contexto (no escribe en DB)', async () => {
    vi.mocked(extractTopics).mockResolvedValue([
      { name: 'Integrales', difficulty: TopicDifficulty.HARD },
    ]);

    const preview = await importService.extractPreview({ text: 'apuntes…', subjectName: 'Mate' });

    expect(extractTopics).toHaveBeenCalledWith({ text: 'apuntes…', subjectName: 'Mate' });
    expect(preview.topics).toEqual([{ name: 'Integrales', difficulty: TopicDifficulty.HARD }]);
    // EXTRACT nunca persiste.
    expect(importRepository.applyImport).not.toHaveBeenCalled();
    expect(importRepository.createSubject).not.toHaveBeenCalled();
  });
});

describe('commitImport — ADD sobre materia existente', () => {
  it('deduplica contra los temas existentes y entre sí, sin borrar (replace=false)', async () => {
    vi.mocked(importRepository.findSubjectWithTopicNames).mockResolvedValue({
      ...makeSubject(),
      topics: [{ name: 'Integrales' }], // ya existe
    });

    const result = await importService.commitImport('u1', {
      mode: ImportMode.ADD,
      subjectId: 's1',
      topics: [
        { name: 'integrales', difficulty: TopicDifficulty.HARD }, // dup de existente (normalizado)
        { name: 'Derivadas', difficulty: TopicDifficulty.MEDIUM },
        { name: 'Derivadas', difficulty: TopicDifficulty.EASY }, // dup interno
      ],
    });

    expect(importRepository.applyImport).toHaveBeenCalledOnce();
    const [subjectId, replace, rows] = vi.mocked(importRepository.applyImport).mock.calls[0]!;
    expect(subjectId).toBe('s1');
    expect(replace).toBe(false); // ADD nunca borra
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ subjectId: 's1', userId: 'u1', name: 'Derivadas' });
    expect(result.createdCount).toBe(1);
    expect(result.skippedCount).toBe(2);
    expect(result.mode).toBe(ImportMode.ADD);
  });
});

describe('commitImport — REPLACE sobre materia existente', () => {
  it('borra los existentes (replace=true) y NO dedup contra ellos; solo dedup interno', async () => {
    vi.mocked(importRepository.findSubjectWithTopicNames).mockResolvedValue({
      ...makeSubject(),
      topics: [{ name: 'Integrales' }],
    });

    const result = await importService.commitImport('u1', {
      mode: ImportMode.REPLACE,
      subjectId: 's1',
      topics: [
        { name: 'Integrales', difficulty: TopicDifficulty.HARD }, // coincide con existente pero NO se omite (replace)
        { name: 'Límites', difficulty: TopicDifficulty.MEDIUM },
      ],
    });

    const [, replace, rows] = vi.mocked(importRepository.applyImport).mock.calls[0]!;
    expect(replace).toBe(true);
    expect(rows).toHaveLength(2); // ambos se crean
    expect(result.createdCount).toBe(2);
    expect(result.skippedCount).toBe(0);
  });
});

describe('commitImport — materia nueva (subjectName)', () => {
  it('crea la materia y agrega todos los temas (ADD, sin existentes)', async () => {
    vi.mocked(importRepository.createSubject).mockResolvedValue(makeSubject({ id: 's2', name: 'Física' }));

    const result = await importService.commitImport('u1', {
      mode: ImportMode.ADD,
      subjectName: 'Física',
      topics: [{ name: 'Cinemática', difficulty: TopicDifficulty.MEDIUM }],
    });

    expect(importRepository.createSubject).toHaveBeenCalledWith('u1', 'Física');
    expect(importRepository.findSubjectWithTopicNames).not.toHaveBeenCalled();
    const [subjectId, replace, rows] = vi.mocked(importRepository.applyImport).mock.calls[0]!;
    expect(subjectId).toBe('s2');
    expect(replace).toBe(false);
    expect(rows).toHaveLength(1);
    expect(result.subject.name).toBe('Física');
    expect(result.createdCount).toBe(1);
  });
});

describe('commitImport — ownership', () => {
  it('materia ajena/inexistente → NOT_FOUND, no persiste', async () => {
    vi.mocked(importRepository.findSubjectWithTopicNames).mockResolvedValue(null);

    await expect(
      importService.commitImport('u1', {
        mode: ImportMode.ADD,
        subjectId: 's1',
        topics: [{ name: 'X', difficulty: TopicDifficulty.EASY }],
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(importRepository.applyImport).not.toHaveBeenCalled();
  });
});
