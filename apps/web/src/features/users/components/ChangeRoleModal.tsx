import React, { useState } from 'react';
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

const roleOptions = [
  { value: Role.USER, label: 'User' },
  { value: Role.ADMIN, label: 'Admin' },
  { value: Role.SUPER_ADMIN, label: 'Super Admin' },
];

export function ChangeRoleModal({ open, onClose, userId, currentRole, userName }: ChangeRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const mutation = useChangeUserRole(userId);
  const addNotification = useUIStore((s) => s.addNotification);

  function handleConfirm() {
    mutation.mutate(selectedRole, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: 'Role updated',
          message: `${userName}'s role changed to ${selectedRole.replace('_', ' ')}`,
        });
        onClose();
      },
      onError: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'error',
          title: 'Failed to update role',
          message: 'Please try again.',
        });
      },
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Role"
      description={`Update role for ${userName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            loading={mutation.isPending}
            disabled={selectedRole === currentRole}
          >
            Confirm
          </Button>
        </>
      }
    >
      <Select
        label="New role"
        value={selectedRole}
        onChange={(v) => setSelectedRole(v as Role)}
        options={roleOptions.map((o) => ({
          ...o,
          disabled: o.value === currentRole,
        }))}
      />
    </Modal>
  );
}
