import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Role } from '@bract/shared';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Modal } from '../../../components/ui/Modal';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { useUser } from '../hooks/useUser';
import { useDeleteUser } from '../hooks/useDeleteUser';
import { UserDetailCard } from './UserDetailCard';
import { ChangeRoleModal } from './ChangeRoleModal';
import { ChangeStatusModal } from './ChangeStatusModal';

export default function UserDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const addNotification = useUIStore((s) => s.addNotification);

  const { user, isLoading, isError, refetch } = useUser(id ?? '');
  const deleteMutation = useDeleteUser();

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const isSuperAdmin = authUser?.role === Role.SUPER_ADMIN;
  const isSelf = authUser?.id === id;

  function handleDelete() {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: t('users.deletedTitle'),
          message: t('users.deletedMessage', { name: user?.name ?? t('users.thisUser') }),
        });
        navigate('/users');
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: t('users.deleteErrorTitle'),
          message: t('users.tryAgain'),
        });
      },
    });
  }

  return (
    <PageWrapper title={user?.name ?? t('nav.userDetail')}>
      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <ErrorState message={t('users.errorLoadDetail')} onRetry={refetch} />
      )}

      {/* Success state */}
      {user && !isLoading && (
        <>
          <UserDetailCard user={user} />

          <div className="flex flex-wrap gap-3">
            {isSuperAdmin && (
              <Button variant="secondary" onClick={() => setRoleModalOpen(true)}>
                {t('users.actions.changeRole')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStatusModalOpen(true)}>
              {t('users.actions.changeStatus')}
            </Button>
            {!isSelf && (
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                {t('users.actions.delete')}
              </Button>
            )}
          </div>

          <ChangeRoleModal
            open={roleModalOpen}
            onClose={() => setRoleModalOpen(false)}
            userId={user.id}
            currentRole={user.role}
            userName={user.name}
          />

          <ChangeStatusModal
            open={statusModalOpen}
            onClose={() => setStatusModalOpen(false)}
            userId={user.id}
            currentStatus={user.status}
            userName={user.name}
          />

          <Modal
            open={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            title={t('users.actions.delete')}
            description={t('users.confirmDeleteName', { name: user.name })}
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteMutation.isPending}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleteMutation.isPending}
                >
                  {t('common.delete')}
                </Button>
              </>
            }
          >
            <p className="text-sm text-text-secondary">
              {t('users.deleteSoftNote')}
            </p>
          </Modal>
        </>
      )}
    </PageWrapper>
  );
}
