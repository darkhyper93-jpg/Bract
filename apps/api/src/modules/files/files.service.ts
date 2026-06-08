import crypto from 'crypto';
import { generateSignedUploadUrl, deleteObject } from '../../lib/r2.js';
import { filesRepository } from './files.repository.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { FILE_LIMITS } from '../../config/constants.js';
import type { FileUploadRequestInput, FileUploadResponse, FileConfirmResponse } from '@bract/shared';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const filesService = {
  async requestUploadUrl(
    userId: string,
    dto: FileUploadRequestInput,
  ): Promise<FileUploadResponse> {
    if (!FILE_LIMITS.ALLOWED_MIME_TYPES.includes(dto.mimeType as typeof FILE_LIMITS.ALLOWED_MIME_TYPES[number])) {
      throw new AppError('VALIDATION_ERROR', `MIME type ${dto.mimeType} not allowed`);
    }
    if (dto.size > FILE_LIMITS.MAX_SIZE_BYTES) {
      throw new AppError('VALIDATION_ERROR', `File size exceeds ${FILE_LIMITS.MAX_SIZE_BYTES} bytes`);
    }

    const ext = MIME_TO_EXT[dto.mimeType] ?? 'bin';
    const randomId = crypto.randomUUID().replace(/-/g, '');
    const key = `${userId}/${Date.now()}-${randomId}.${ext}`;

    const uploadUrl = await generateSignedUploadUrl(key, dto.mimeType, FILE_LIMITS.SIGNED_URL_EXPIRY_SECONDS);

    const record = await filesRepository.create({
      key,
      bucket: env.CLOUDFLARE_R2_BUCKET,
      filename: dto.filename,
      mimeType: dto.mimeType,
      size: dto.size,
      uploadedBy: userId,
    });

    return { uploadUrl, fileId: record.id, key };
  },

  async confirmUpload(userId: string, fileId: string): Promise<FileConfirmResponse> {
    const record = await filesRepository.findById(fileId);
    if (!record) {
      throw new AppError('NOT_FOUND', 'File not found');
    }
    if (record.uploadedBy !== userId) {
      throw new AppError('FORBIDDEN', 'You do not own this file');
    }
    if (record.status !== 'PENDING') {
      throw new AppError('CONFLICT', 'File is not in PENDING status');
    }

    await filesRepository.updateStatus(fileId, 'UPLOADED', new Date());

    return { publicUrl: `${env.CLOUDFLARE_R2_PUBLIC_URL}/${record.key}` };
  },

  async deleteFile(userId: string, fileId: string): Promise<void> {
    const record = await filesRepository.findById(fileId);
    if (!record || record.status === 'DELETED') {
      throw new AppError('NOT_FOUND', 'File not found');
    }
    if (record.uploadedBy !== userId) {
      throw new AppError('FORBIDDEN', 'You do not own this file');
    }

    await deleteObject(record.key);
    await filesRepository.softDelete(fileId);
  },
};
