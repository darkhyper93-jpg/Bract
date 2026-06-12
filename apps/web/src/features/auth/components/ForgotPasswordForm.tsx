import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useForgotPassword } from '../hooks/useForgotPassword';
import {
  forgotPasswordFormSchema,
  ForgotPasswordFormValues,
} from '../schemas/auth.form.schema';

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const data = error.response.data as { error?: { message?: string } };
    return data?.error?.message ?? fallback;
  }
  return fallback;
}

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { mutate, isPending, isSuccess, error } = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
  });

  const onSubmit = (values: ForgotPasswordFormValues) => {
    mutate(values);
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-text-primary">
            {t('auth.verifyEmailTitle')}
          </h1>
          <p className="text-sm text-text-secondary">
            {t('auth.forgotSuccessDescription')}
          </p>
        </div>
        <Link
          to="/login"
          className="text-sm text-brand-primary hover:text-brand-hover transition-colors duration-[150ms]"
        >
          ← {t('auth.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t('auth.resetPasswordTitle')}
        </h1>
        <p className="text-sm text-text-secondary">
          {t('auth.resetPasswordSubtitle')}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3">
          <p className="text-sm text-error">{getApiErrorMessage(error, t('auth.genericError'))}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" loading={isPending} className="w-full mt-1">
          {t('auth.sendResetLink')}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {t('auth.rememberedIt')}{' '}
        <Link
          to="/login"
          className="text-brand-primary hover:text-brand-hover transition-colors duration-[150ms] font-medium"
        >
          {t('auth.login')}
        </Link>
      </p>
    </div>
  );
}
