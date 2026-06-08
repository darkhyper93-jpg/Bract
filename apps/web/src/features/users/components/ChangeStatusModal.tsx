import React, { useState } from 'react';
import { UserStatus } from '@bract/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useUIStore } from '../../../stores/uiStore';
import { useChangeUserStatus } from '../hooks/useChangeUserStatus';

interface ChangeStatusModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentStatus: UserStatus;
  userName: string;
}

const statusOptions = [
  { value: UserStatus.ACTIVE, label: 'Active' },
  { value: UserStatus.SUSPENDED, label: 'Suspended' },
];

export function ChangeStatusModal({ open, onClose, userId, currentStatus, userName }: ChangeStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>(
    currentStatus === UserStatus.DELETED ? UserStatus.ACTIVE : currentStatus,
  );
  const mutation = useChangeUserStatus(userId);
  const addNotification = useUIStore((s) => s.addNotification);

  const isSuspending = selectedStatus === UserStatus.SUSPENDED;

  function handleConfirm() {
    mutation.mutate(selectedStatus, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: 'Status updated',
          message: `${userName}'s status changed to ${selectedStatus.toLowerCase()}`,
        });
        onClose();
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Failed to update status',
          message: 'Please try again.',
        });
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Status"
      description={`Update status for ${userName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={mutation.isPending}
            disabled={selectedStatus === currentStatus}
          >
            Confirm
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="New status"
          value={selectedStatus}
          onChange={(v) => setSelectedStatus(v as UserStatus)}
          options={statusOptions.map((o) => ({
            ...o,
            disabled: o.value === currentStatus,
          }))}
        />
        {isSuspending && (
          <p className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
            This user will lose access to the platform while suspended.
          </p>
        )}
      </div>
    </Modal>
  );
}
