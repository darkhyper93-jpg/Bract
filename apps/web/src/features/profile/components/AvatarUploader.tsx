import React, { useRef } from 'react';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { useProfile } from '../hooks/useProfile';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useRemoveAvatar } from '../hooks/useRemoveAvatar';
import { useUIStore } from '../../../stores/uiStore';

export function AvatarUploader() {
  const { profile } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, progress, error } = useAvatarUpload();
  const { mutate: removeAvatar, isPending: isRemoving } = useRemoveAvatar();
  const addNotification = useUIStore((s) => s.addNotification);

  const handleClick = () => {
    if (!isUploading) fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const result = await upload(file);
    if (result) {
      addNotification({
        id: crypto.randomUUID(),
        type: 'success',
        title: 'Foto actualizada',
      });
    }
  };

  const handleRemove = () => {
    removeAvatar(undefined, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: 'Foto eliminada',
        });
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Error al eliminar la foto',
        });
      },
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative cursor-pointer group"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Cambiar foto de perfil"
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        <Avatar
          src={profile?.avatarUrl}
          name={profile?.name}
          size="xl"
          className="h-24 w-24 text-2xl"
        />

        {isUploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60">
            <svg
              className="h-5 w-5 animate-spin text-white mb-1"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-white font-medium">{progress}%</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/0 group-hover:bg-black/50 transition-colors duration-[150ms]">
            <svg
              className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-[150ms]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="mt-0.5 text-[10px] font-medium leading-tight text-white opacity-0 group-hover:opacity-100 transition-opacity duration-[150ms]">
              Cambiar
            </span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden="true"
        />
      </div>

      {error && (
        <p className="text-xs text-error text-center max-w-[180px]">{error}</p>
      )}

      {profile?.avatarUrl && (
        <Button
          variant="ghost"
          size="sm"
          loading={isRemoving}
          onClick={handleRemove}
          className="text-error hover:text-error hover:bg-error/10"
        >
          Eliminar foto
        </Button>
      )}
    </div>
  );
}
