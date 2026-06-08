import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { changePasswordSchema, ChangePasswordInput } from '@bract/shared';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useChangePassword } from '../hooks/useChangePassword';
import { useUIStore } from '../../../stores/uiStore';

export function ChangePasswordForm() {
  const { mutate, isPending } = useChangePassword();
  const addNotification = useUIStore((s) => s.addNotification);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = (data: ChangePasswordInput) => {
    mutate(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          reset();
          addNotification({
            id: crypto.randomUUID(),
            type: 'success',
            title: 'Contraseña actualizada',
          });
        },
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            setError('currentPassword', { message: 'Contraseña actual incorrecta' });
          } else {
            addNotification({
              id: crypto.randomUUID(),
              type: 'error',
              title: 'Error al cambiar la contraseña',
            });
          }
        },
      },
    );
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Cambiar contraseña</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Contraseña actual"
          type="password"
          {...register('currentPassword')}
          error={errors.currentPassword?.message}
        />
        <Input
          label="Nueva contraseña"
          type="password"
          {...register('newPassword')}
          error={errors.newPassword?.message}
        />
        <Input
          label="Confirmar nueva contraseña"
          type="password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={isPending}>
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </div>
  );
}
