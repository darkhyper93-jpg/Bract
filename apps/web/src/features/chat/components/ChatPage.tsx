import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { EmptyState } from '../../../components/ui/EmptyState';
import { cn } from '../../../utils/cn';
import { useUIStore } from '../../../stores/uiStore';
import { useChatMutations } from '../hooks/useChatMutations';
import type { ChatLocationState } from '../types';
import { SessionList } from './SessionList';
import { ChatThread } from './ChatThread';

// Chat de estudio (Agente E) — layout de 2 columnas responsive: en desktop lista + hilo lado a
// lado; en mobile se muestra una u otra (la lista colapsa al abrir una conversación).
export default function ChatPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState<string | null>(null);
  const { createSession } = useChatMutations();
  const addNotification = useUIStore((s) => s.addNotification);

  // Deep-link del Temario (§8.7): si llegamos con `focusTopic` en el state de navegación, abrimos una
  // sesión nueva titulada con el tema y dejamos un mensaje inicial para que ChatThread lo auto-envíe.
  // SOLO frontend — no toca el contrato ni el streaming del chat. Guard + limpieza del state para no
  // re-disparar al re-renderizar o al volver.
  const focusHandledRef = useRef(false);
  useEffect(() => {
    const state = location.state as ChatLocationState | null;
    const focus = state?.focusTopic;
    if (!focus || focusHandledRef.current) return;
    focusHandledRef.current = true;
    const message = t('chat.focusInitial', { topic: focus.name, subject: focus.subjectName });
    createSession.mutate(
      { title: focus.name },
      {
        onSuccess: (session) => {
          setActiveId(session.id);
          setInitialMessage(message);
        },
        onError: () =>
          addNotification({ id: 'chat-new-err', type: 'error', title: t('chat.toast.error') }),
      },
    );
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, t, createSession, navigate, addNotification]);

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
            <ChatThread
              key={activeId}
              sessionId={activeId}
              onBack={() => setActiveId(null)}
              initialMessage={initialMessage ?? undefined}
              onInitialConsumed={() => setInitialMessage(null)}
            />
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
