import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatRole } from '@bract/shared';
import type { ChatMessage } from '@bract/shared';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useChatSession } from '../hooks/useChatSession';
import { useChatStream } from '../hooks/useChatStream';
import { MessageComposer } from './MessageComposer';

interface ChatThreadProps {
  sessionId: string;
  onBack: () => void;
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          // pre-line (no pre-wrap): preserva los saltos de línea entre ítems/párrafos
          // pero COLAPSA runs de espacios/tabs, evitando el padding gigante tras el "·".
          'max-w-[80%] whitespace-pre-line rounded-lg px-3.5 py-2.5 text-sm',
          isUser
            ? 'bg-brand-muted text-text-primary'
            : 'bg-bg-elevated text-text-secondary',
        )}
      >
        {content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-lg bg-bg-elevated px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatThread({ sessionId, onBack }: ChatThreadProps) {
  const { t } = useTranslation();
  const { messages, isLoading, isError, refetch } = useChatSession(sessionId);
  const { send, retry, isStreaming, streamingText, pendingUserContent, error } =
    useChatStream(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al fondo cuando llegan tokens o mensajes nuevos.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, pendingUserContent, isStreaming, error]);

  // Solo USER/ASSISTANT en el hilo (los SYSTEM, si existieran, no se muestran).
  const visible = messages.filter(
    (m: ChatMessage) => m.role === ChatRole.USER || m.role === ChatRole.ASSISTANT,
  );
  const isEmpty =
    visible.length === 0 && pendingUserContent === null && !isStreaming && error === null;

  const errorMessage =
    error?.code === 'AI_UNAVAILABLE' ? t('chat.error.aiUnavailable') : t('chat.error.stream');

  return (
    <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-bg-surface">
      {/* Header con back en mobile */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle px-3 lg:hidden">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-text-secondary transition-colors duration-[150ms] hover:bg-bg-elevated hover:text-text-primary"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('chat.thread.back')}
        </button>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton height={44} className="w-1/2" />
            <Skeleton height={60} className="ml-auto w-2/3" />
            <Skeleton height={48} className="w-3/5" />
          </div>
        ) : isError ? (
          <ErrorState message={t('chat.errorLoad')} onRetry={() => void refetch()} />
        ) : isEmpty ? (
          <EmptyState title={t('chat.thread.empty')} description={t('chat.thread.emptyDescription')} />
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((m) => (
              <Bubble
                key={m.id}
                role={m.role === ChatRole.USER ? 'user' : 'assistant'}
                content={m.content}
              />
            ))}
            {pendingUserContent !== null && <Bubble role="user" content={pendingUserContent} />}
            {isStreaming &&
              (streamingText.length > 0 ? (
                <Bubble role="assistant" content={streamingText} />
              ) : (
                <TypingDots />
              ))}
            {error !== null && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-error/30 bg-error/10 px-3.5 py-2.5">
                <span className="text-sm text-error">{errorMessage}</span>
                <Button size="sm" variant="secondary" onClick={retry}>
                  {t('chat.error.retry')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <MessageComposer disabled={isStreaming} onSend={(c) => void send(c)} />
    </div>
  );
}
