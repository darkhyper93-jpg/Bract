import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserListItem, Role, UserStatus } from '@bract/shared';
import { Table, Column } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Dropdown } from '../../../components/ui/Dropdown';
import { Modal } from '../../../components/ui/Modal';
import { Pagination } from '../../../components/ui/Pagination';
import { useAuthStore } from '../../../stores/authStore';
import { useUIStore } from '../../../stores/uiStore';
import { useDeleteUser } from '../hooks/useDeleteUser';
import { ChangeRoleModal } from './ChangeRoleModal';
import { ChangeStatusModal } from './ChangeStatusModal';

type BadgeVariant = 'success' | 'warning' | 'neutral' | 'error' | 'info';

const statusVariant: Record<UserStatus, BadgeVariant> = {
  [UserStatus.ACTIVE]: 'success',
  [UserStatus.SUSPENDED]: 'error',
  [UserStatus.DELETED]: 'neutral',
};

const roleVariant: Record<Role, BadgeVariant> = {
  [Role.USER]: 'neutral',
  [Role.ADMIN]: 'info',
  [Role.SUPER_ADMIN]: 'warning',
};

const roleLabel: Record<Role, string> = {
  [Role.USER]: 'User',
  [Role.ADMIN]: 'Admin',
  [Role.SUPER_ADMIN]: 'Super Admin',
};

interface UsersTableProps {
  users: UserListItem[];
  isLoading: boolean;
  isError: boolean;
  meta?: { total: number; page: number; perPage: number; totalPages: number } | undefined;
  onRetry: () => void;
  onPageChange: (page: number) => void;
}

export function UsersTable({ users, isLoading, isError, meta, onRetry, onPageChange }: UsersTableProps) {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const addNotification = useUIStore((s) => s.addNotification);
  const deleteMutation = useDeleteUser();

  const [roleModalUser, setRoleModalUser] = useState<UserListItem | null>(null);
  const [statusModalUser, setStatusModalUser] = useState<UserListItem | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UserListItem | null>(null);

  const isSuperAdmin = authUser?.role === Role.SUPER_ADMIN;

  function handleDelete() {
    if (!deleteModalUser) return;
    deleteMutation.mutate(deleteModalUser.id, {
      onSuccess: () => {
        addNotification({
          id: crypto.randomUUID(),
          type: 'success',
          title: 'User deleted',
          message: `${deleteModalUser.name} has been removed.`,
        });
        setDeleteModalUser(null);
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

  const columns: Column<UserListItem>[] = [
    {
      key: 'user',
      header: 'User',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{row.name}</p>
            <p className="text-xs text-text-tertiary truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (row) => <Badge variant={roleVariant[row.role]}>{roleLabel[row.role]}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={statusVariant[row.status]} dot>
          {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      cell: (row) => (
        <span className="text-sm text-text-secondary">
          {new Date(row.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'w-10',
      className: 'text-right',
      cell: (row) => {
        const isSelf = authUser?.id === row.id;
        const menuItems = [
          {
            key: 'view',
            label: 'View detail',
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
            ),
            onClick: () => navigate(`/users/${row.id}`),
          },
          ...(isSuperAdmin
            ? [
                {
                  key: 'role',
                  label: 'Change role',
                  icon: (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                  ),
                  onClick: () => setRoleModalUser(row),
                },
              ]
            : []),
          {
            key: 'status',
            label: 'Change status',
            icon: (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            ),
            onClick: () => setStatusModalUser(row),
          },
          ...(!isSelf
            ? [
                { key: 'sep', separator: true as const },
                {
                  key: 'delete',
                  label: 'Delete user',
                  danger: true,
                  icon: (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  ),
                  onClick: () => setDeleteModalUser(row),
                },
              ]
            : []),
        ];

        return (
          <Dropdown
            align="right"
            items={menuItems}
            trigger={
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors duration-[150ms]">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            }
          />
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Table
        columns={columns}
        data={users}
        rowKey={(row) => row.id}
        loading={isLoading}
        error={isError ? 'Failed to load users' : null}
        onRetry={onRetry}
        emptyTitle="No users found"
        emptyDescription="Try adjusting your search or filters."
        skeletonRows={5}
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}

      {roleModalUser && (
        <ChangeRoleModal
          open
          onClose={() => setRoleModalUser(null)}
          userId={roleModalUser.id}
          currentRole={roleModalUser.role}
          userName={roleModalUser.name}
        />
      )}

      {statusModalUser && (
        <ChangeStatusModal
          open
          onClose={() => setStatusModalUser(null)}
          userId={statusModalUser.id}
          currentStatus={statusModalUser.status}
          userName={statusModalUser.name}
        />
      )}

      <Modal
        open={Boolean(deleteModalUser)}
        onClose={() => setDeleteModalUser(null)}
        title="Delete user"
        description={`Are you sure you want to delete ${deleteModalUser?.name ?? 'this user'}? This action cannot be undone.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteModalUser(null)}
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
    </div>
  );
}
