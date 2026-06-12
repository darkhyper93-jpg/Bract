import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useLogin } from '../hooks/useLogin';
import {
  loginFormSchema,
  LoginFormValues,
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
    const data = error.response.data as {
      error?: { message?: string };
    };
    return data?.error?.message ?? fallback;
  }
  return fallback;
}

export function LoginForm() {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const passwordReset = (location.state as { passwordReset?: boolean } | null)
    ?.passwordReset;

  const { mutate, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = (values: LoginFormValues) => {
    mutate(values);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t('auth.welcomeBack')}
        </h1>
        <p className="text-sm text-text-secondary">{t('auth.signInSubtitle')}</p>
      </div>

      {passwordReset && (
        <div className="rounded-lg border border-success/20 bg-success/10 px-4 py-3">
          <p className="text-sm text-success">
            {t('auth.passwordResetSuccess')}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3">
          <p className="text-sm text-error">{getApiErrorMessage(error, t('auth.loginError'))}</p>
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

        <Input
          label={t('auth.password')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          rightAddon={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-text-tertiary hover:text-text-secondary transition-colors duration-[150ms]"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              {showPassword ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          }
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs text-brand-primary hover:text-brand-hover transition-colors duration-[150ms]"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" loading={isPending} className="w-full mt-1">
          {t('auth.login')}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          className="text-brand-primary hover:text-brand-hover transition-colors duration-[150ms] font-medium"
        >
          {t('auth.createOne')}
        </Link>
      </p>
    </div>
  );
}
