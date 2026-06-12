import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '@bract/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useUIStore } from '../../../stores/uiStore';
import { useChangeUserRole } from '../hooks/useChangeUserRole';

interface ChangeRoleModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentRole: Role;
  userName: string;
}

const ROLE_VALUES: Role[] = [Role.USER, Role.ADMIN, Role.SUPER_ADMIN];

export function ChangeRoleModal({ open, onClose, userId, currentRole, userName }: ChangeRoleModalProps) {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const mutation = useChangeUserRole(userId);
  const addNotification = useUIStore((s) => s.addNotification);

  function handleConfirm() {
    mutation.mutate(selectedRole, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: t('users.roleUpdated'),
          message: t('users.roleUpdatedMessage', { name: userName, role: t(`users.roles.${selectedRole}`) }),
        });
        onClose();
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: t('users.roleUpdateError'),
          message: t('users.tryAgain'),
        });
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('users.actions.changeRole')}
      description={t('users.updateRoleFor', { name: userName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            loading={mutation.isPending}
            disabled={selectedRole === currentRole}
          >
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <Select
        label={t('users.newRole')}
        value={selectedRole}
        onChange={(v) => setSelectedRole(v as Role)}
        options={ROLE_VALUES.map((value) => ({
          value,
          label: t(`users.roles.${value}`),
          disabled: value === currentRole,
        }))}
      />
    </Modal>
  );
}
