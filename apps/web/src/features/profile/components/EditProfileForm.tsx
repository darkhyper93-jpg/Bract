import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, UpdateProfileInput } from '@bract/shared';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useProfile } from '../hooks/useProfile';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import { useUIStore } from '../../../stores/uiStore';

export function EditProfileForm() {
  const { profile } = useProfile();
  const { mutate, isPending } = useUpdateProfile();
  const addNotification = useUIStore((s) => s.addNotification);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: profile?.name ?? '',
    },
  });

  const onSubmit = (data: UpdateProfileInput) => {
    mutate(data, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: 'Perfil actualizado',
        });
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Error al actualizar el perfil',
        });
      },
    });
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Información personal</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nombre"
          {...register('name')}
          error={errors.name?.message}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
