import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { Skeleton } from '../../../components/ui/Skeleton';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: () => authApi.verifyEmail(token),
  });

  useEffect(() => {
    if (token) {
      mutate();
    }
  }, [token, mutate]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-error">
            Invalid verification link. Please request a new one.
          </p>
          <Link
            to="/login"
            className="text-sm text-brand-primary hover:text-brand-hover transition-colors duration-[150ms]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {isPending && (
          <>
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </>
        )}

        {isSuccess && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <svg
                className="h-8 w-8 text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold text-text-primary">
                Email verified
              </h1>
              <p className="text-sm text-text-secondary">
                Your account is now active.
              </p>
            </div>
            <Link
              to="/login"
              className="text-sm text-brand-primary hover:text-brand-hover transition-colors duration-[150ms] font-medium"
            >
              Sign in →
            </Link>
          </>
        )}

        {isError && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
              <svg
                className="h-8 w-8 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold text-text-primary">
                Verification failed
              </h1>
              <p className="text-sm text-text-secondary">
                The link may have expired or already been used.
              </p>
            </div>
            <Link
              to="/login"
              className="text-sm text-brand-primary hover:text-brand-hover transition-colors duration-[150ms]"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
