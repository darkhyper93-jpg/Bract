import React from 'react';
import { UserPublic, UserStatus } from '@bract/shared';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';

type BadgeVariant = 'success' | 'warning' | 'neutral' | 'error' | 'info';

const statusVariant: Record<UserStatus, BadgeVariant> = {
  [UserStatus.ACTIVE]: 'success',
  [UserStatus.SUSPENDED]: 'warning',
  [UserStatus.DELETED]: 'neutral',
};

const roleLabel: Record<string, string> = {
  USER: 'User',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

interface UserDetailCardProps {
  user: UserPublic;
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  );
}

export function UserDetailCard({ user }: UserDetailCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="flex items-start gap-4">
        <Avatar src={user.avatarUrl} name={user.name} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-text-primary">{user.name}</h2>
          <p className="text-sm text-text-secondary">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="info">{roleLabel[user.role] ?? user.role}</Badge>
            <Badge variant={statusVariant[user.status]} dot>
              {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
            </Badge>
            {user.emailVerified && (
              <Badge variant="success">Email verified</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-2">
        <Field label="User ID" value={<code className="text-xs text-text-secondary">{user.id}</code>} />
        <Field
          label="Member since"
          value={new Date(user.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
        <Field label="Email" value={user.email} />
        <Field
          label="Email verified"
          value={
            user.emailVerified ? (
              <span className="text-success">Yes</span>
            ) : (
              <span className="text-warning">No</span>
            )
          }
        />
      </div>
    </div>
  );
}
