import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatSession } from '@bract/shared';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useUIStore } from '../../../stores/uiStore';
import { useChatSessions } from '../hooks/useChatSessions';
import { useChatMutations } from '../hooks/useChatMutations';
import { ConfirmDialog } from './ConfirmDialog';

interface SessionListProps {
  activeId: string | null;
  creating: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
}

function IconPlus() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

export function SessionList({ activeId, creating, onSelect, onNew, onDeleted }: SessionListProps) {
  const { t } = useTranslation();
  const { sessions, isLoading, isError, refetch } = useChatSessions();
  const { deleteSession } = useChatMutations();
  const addNotification = useUIStore((s) => s.addNotification);
  const [toDelete, setToDelete] = useState<ChatSession | null>(null);

  function handleDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    deleteSession.mutate(id, {
      onSuccess: () => {
        onDeleted(id);
        setToDelete(null);
        addNotification({ id: `chat-del-${id}`, type: 'success', title: t('chat.toast.sessionDeleted') });
      },
      onError: () => {
        setToDelete(null);
        addNotification({ id: `chat-del-err-${id}`, type: 'error', title: t('chat.toast.error') });
      },
    });
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle p-3">
        <h3 className="text-sm font-semibold text-text-primary">{t('chat.sessions.title')}</h3>
        <Button size="sm" onClick={onNew} loading={creating} leftIcon={<IconPlus />}>
          {t('chat.newChat')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={t('chat.errorLoad')} onRetry={() => void refetch()} />
        ) : sessions.length === 0 ? (
          <EmptyState
            title={t('chat.sessions.empty')}
            description={t('chat.sessions.emptyDescription')}
          />
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      'flex w-full items-center rounded-lg py-2 pl-3 pr-9 text-left text-sm',
                      'transition-colors duration-[150ms]',
                      isActive
                        ? 'bg-brand-muted text-brand-primary'
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                    )}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className="truncate">{s.title ?? t('chat.sessions.untitled')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(s)}
                    aria-label={t('chat.sessions.deleteTitle')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-tertiary opacity-0 transition-all duration-[150ms] hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <IconTrash />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('chat.sessions.deleteTitle')}
        message={t('chat.sessions.deleteConfirm')}
        loading={deleteSession.isPending}
        onConfirm={handleDelete}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
