import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
          title: 'User deleted',
          message: `${user?.name ?? 'User'} has been removed.`,
        });
        navigate('/users');
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Failed to delete user',
          message: 'Please try again.',
        });
      },
    });
  }

  return (
    <PageWrapper title={user?.name ?? 'Detalle de usuario'}>
      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <ErrorState message="Failed to load user details" onRetry={refetch} />
      )}

      {/* Success state */}
      {user && !isLoading && (
        <>
          <UserDetailCard user={user} />

          <div className="flex flex-wrap gap-3">
            {isSuperAdmin && (
              <Button variant="secondary" onClick={() => setRoleModalOpen(true)}>
                Change role
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStatusModalOpen(true)}>
              Change status
            </Button>
            {!isSelf && (
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                Delete user
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
            title="Delete user"
            description={`Are you sure you want to delete ${user.name}? This action cannot be undone.`}
            footer={
              <>
                <Button
                  variant="secondary"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </>
            }
          >
            <p className="text-sm text-text-secondary">
              The user will be soft-deleted and will no longer have access to the platform.
            </p>
          </Modal>
        </>
      )}
    </PageWrapper>
  );
}
