import { prisma } from '../../prisma/client.js';
import { FileStatus } from '@prisma/client';
import type { FileRecord } from '@prisma/client';

export interface CreateFileData {
  key: string;
  bucket: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}

export const filesRepository = {
  async create(data: CreateFileData): Promise<FileRecord> {
    return prisma.fileRecord.create({ data });
  },

  async findById(id: string): Promise<FileRecord | null> {
    return prisma.fileRecord.findUnique({ where: { id } });
  },

  async updateStatus(id: string, status: FileStatus, confirmedAt?: Date): Promise<FileRecord> {
    return prisma.fileRecord.update({
      where: { id },
      data: { status, ...(confirmedAt !== undefined ? { confirmedAt } : {}) },
    });
  },

  async softDelete(id: string): Promise<void> {
    await prisma.fileRecord.update({
      where: { id },
      data: { status: FileStatus.DELETED },
    });
  },

  async findPendingOlderThan(minutes: number): Promise<FileRecord[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return prisma.fileRecord.findMany({
      where: { status: FileStatus.PENDING, createdAt: { lt: cutoff } },
    });
  },
};
