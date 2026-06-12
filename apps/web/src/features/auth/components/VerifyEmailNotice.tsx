import React from 'react';
import { useTranslation, Trans } from 'react-i18next';

interface VerifyEmailNoticeProps {
  email?: string | undefined;
}

export function VerifyEmailNotice({ email }: VerifyEmailNoticeProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-muted">
        <svg
          className="h-8 w-8 text-brand-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-text-primary">
          {t('auth.verifyEmailTitle')}
        </h2>
        <p className="text-sm text-text-secondary">
          {email ? (
            <Trans
              i18nKey="auth.verifyEmailSentTo"
              values={{ email }}
              components={{ b: <span className="font-medium text-text-primary" /> }}
            />
          ) : (
            t('auth.verifyEmailSentGeneric')
          )}
        </p>
      </div>

      <p className="text-xs text-text-tertiary">
        {t('auth.verifyEmailSpam')}
      </p>
    </div>
  );
}
