import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { MAX_IMPORT_FILE_BYTES, ACCEPTED_IMPORT_FILE_EXTENSIONS } from '@bract/shared';
import { AppError } from '../../lib/errors.js';
import { detectFileKind } from './file-text.js';

// Middleware de upload para la importación desde ARCHIVOS (follow-up Agente K). memoryStorage: el
// archivo nunca toca el disco — se parsea en memoria y se descarta. Límites duros: 1 archivo, tope
// de tamaño (8 MB). El parsing/extracción de texto lo hace el service; acá solo se recibe y valida.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_BYTES, files: 1 },
  // Rechaza por extensión ANTES de bufferear todo (defensa + UX). El mimetype no es confiable.
  fileFilter: (_req, file, cb) => {
    if (detectFileKind(file.originalname) === null) {
      cb(
        new AppError(
          'VALIDATION_ERROR',
          `Tipo de archivo no soportado. Aceptados: ${ACCEPTED_IMPORT_FILE_EXTENSIONS.join(', ')}`,
        ),
      );
      return;
    }
    cb(null, true);
  },
});

const single = upload.single('file');

// Envuelve multer y traduce sus errores al envelope del proyecto (AppError → errorHandler):
// archivo grande → VALIDATION_ERROR (400); el resto, un 400 genérico manejado.
export function uploadImportFile(req: Request, res: Response, next: NextFunction): void {
  single(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `El archivo supera el tope de ${Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB`
          : 'No se pudo procesar el archivo subido';
      next(new AppError('VALIDATION_ERROR', message));
      return;
    }
    next(new AppError('VALIDATION_ERROR', 'No se pudo procesar el archivo subido'));
  });
}
