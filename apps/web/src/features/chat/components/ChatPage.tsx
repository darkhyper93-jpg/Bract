import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../utils/cn';
import { useUIStore } from '../../../stores/uiStore';
import { useChatMutations } from '../hooks/useChatMutations';
import { SessionList } from './SessionList';
import { ChatThread } from './ChatThread';

// Chat de estudio (Agente E) — layout de 2 columnas responsive: en desktop lista + hilo lado a
// lado; en mobile se muestra una u otra (la lista colapsa al abrir una conversación).
export default function ChatPage() {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { createSession } = useChatMutations();
  const addNotification = useUIStore((s) => s.addNotification);

  function handleNew() {
    createSession.mutate(
      {},
      {
        onSuccess: (session) => setActiveId(session.id),
        onError: () =>
          addNotification({ id: 'chat-new-err', type: 'error', title: t('chat.toast.error') }),
      },
    );
  }

  return (
    <PageWrapper title={t('chat.title')} description={t('chat.description')}>
      <div className="grid h-[calc(100vh-200px)] min-h-[460px] grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        {/* Lista: oculta en mobile cuando hay una conversación abierta */}
        <div className={cn('h-full min-h-0', activeId ? 'hidden lg:block' : 'block')}>
          <SessionList
            activeId={activeId}
            creating={createSession.isPending}
            onSelect={setActiveId}
            onNew={handleNew}
            onDeleted={(id) => setActiveId((cur) => (cur === id ? null : cur))}
          />
        </div>

        {/* Hilo: oculto en mobile cuando no hay conversación abierta */}
        <div className={cn('h-full min-h-0', activeId ? 'block' : 'hidden lg:block')}>
          {activeId ? (
            <ChatThread sessionId={activeId} onBack={() => setActiveId(null)} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-border-subtle bg-bg-surface">
              <EmptyState
                title={t('chat.thread.pickTitle')}
                description={t('chat.thread.pickDescription')}
              />
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
