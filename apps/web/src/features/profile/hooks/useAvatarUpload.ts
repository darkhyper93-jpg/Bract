import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../stores/authStore';
import { queryKeys } from '../../../lib/queryKeys';
import { filesApi } from '../api/files.api';
import { profileApi } from '../api/profile.api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_SIZE = 10 * 1024 * 1024;

interface UseAvatarUploadReturn {
  upload: (file: File) => Promise<string>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useAvatarUpload(): UseAvatarUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const upload = async (file: File): Promise<string> => {
    setError(null);
    setProgress(0);

    // Step 1: Validate type and size
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      setError('Formato no permitido. Usa JPEG, PNG o WebP.');
      return '';
    }
    if (file.size > MAX_SIZE) {
      setError('El archivo supera el límite de 10MB.');
      return '';
    }

    setIsUploading(true);

    try {
      // Step 2: Request signed URL from API
      const { uploadUrl, fileId } = await filesApi.requestUploadUrl({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      // Step 3: PUT directly to R2 — no apiClient, R2 rejects Bract's Authorization header
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      setProgress(50);

      // Step 4: Confirm upload
      const { publicUrl } = await filesApi.confirmUpload(fileId);

      // Step 5: Update profile in DB with new avatarUrl
      const updatedUser = await profileApi.updateProfile({ avatarUrl: publicUrl });

      // Step 6: Sync cache and auth store
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      useAuthStore.getState().setUser(updatedUser);
      setProgress(100);

      return publicUrl;
    } catch {
      setError('Error al subir la imagen. Intenta de nuevo.');
      setProgress(0);
      return '';
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading, progress, error };
}
