import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useProfile } from '../hooks/useProfile';
import { ProfileCard } from './ProfileCard';
import { EditProfileForm } from './EditProfileForm';
import { ChangePasswordForm } from './ChangePasswordForm';

function ProfileSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 flex flex-col items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 flex flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
          <div className="flex justify-end">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 flex flex-col gap-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { isLoading, isError } = useProfile();

  return (
    <PageWrapper title={t('profile.title')}>
      {isLoading ? (
        <ProfileSkeleton />
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error/10 p-6 text-sm text-error">
          {t('profile.errorLoad')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ProfileCard />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <EditProfileForm />
            <ChangePasswordForm />
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
