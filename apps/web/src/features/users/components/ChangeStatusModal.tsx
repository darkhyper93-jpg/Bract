import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const STATUS_VALUES: UserStatus[] = [UserStatus.ACTIVE, UserStatus.SUSPENDED];

export function ChangeStatusModal({ open, onClose, userId, currentStatus, userName }: ChangeStatusModalProps) {
  const { t } = useTranslation();
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
          title: t('users.statusUpdated'),
          message: t('users.statusUpdatedMessage', { name: userName, status: t(`users.statuses.${selectedStatus}`) }),
        });
        onClose();
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: t('users.statusUpdateError'),
          message: t('users.tryAgain'),
        });
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.actions.changeStatus')}
      description={t('users.updateStatusFor', { name: userName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            loading={mutation.isPending}
            disabled={selectedStatus === currentStatus}
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label={t('users.newStatus')}
          value={selectedStatus}
          onChange={(v) => setSelectedStatus(v as UserStatus)}
          options={STATUS_VALUES.map((value) => ({
            value,
            label: t(`users.statuses.${value}`),
            disabled: value === currentStatus,
          }))}
        />
        {isSuspending && (
          <p className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
            {t('users.suspendWarning')}
          </p>
        )}
      </div>
    </Modal>
  );
}
