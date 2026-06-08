import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useForgotPassword } from '../hooks/useForgotPassword';
import {
  forgotPasswordFormSchema,
  ForgotPasswordFormValues,
} from '../schemas/auth.form.schema';

function getApiErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const data = error.response.data as { error?: { message?: string } };
    return data?.error?.message ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function ForgotPasswordForm() {
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
            Check your email
          </h1>
          <p className="text-sm text-text-secondary">
            If that email exists in our system, you&apos;ll receive password
            reset instructions shortly.
          </p>
        </div>
        <Link
          to="/login"
          className="text-sm text-brand-primary hover:text-brand-hover transition-colors duration-[150ms]"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-text-primary">
          Reset your password
        </h1>
        <p className="text-sm text-text-secondary">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3">
          <p className="text-sm text-error">{getApiErrorMessage(error)}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" loading={isPending} className="w-full mt-1">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Remembered it?{' '}
        <Link
          to="/login"
          className="text-brand-primary hover:text-brand-hover transition-colors duration-[150ms] font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
