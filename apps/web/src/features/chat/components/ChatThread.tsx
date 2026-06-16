import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatRole } from '@bract/shared';
import type { ChatLanguage, ChatMessage } from '@bract/shared';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useChatSession } from '../hooks/useChatSession';
import { useChatStream } from '../hooks/useChatStream';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { MessageComposer } from './MessageComposer';

// Mapea el idioma del toggle i18n al locale BCP-47 que espera la Web Speech API (§8.9).
const SPEECH_LANG: Record<string, string> = { es: 'es-ES', en: 'en-US' };

// Idioma de la UI normalizado a los soportados por el chat ('es'/'en'); default 'es'. El tutor
// responde SIEMPRE en este idioma (FIX idioma del chat).
function toChatLanguage(lang: string): ChatLanguage {
  return lang.split('-')[0] === 'en' ? 'en' : 'es';
}

// Control de lectura por voz que recibe cada bubble del tutor (texto→voz, §8.9).
// `status` es el de ESTE bubble: 'idle' (no es el activo) | 'speaking' | 'paused'.
interface ListenControl {
  status: 'idle' | 'speaking' | 'paused';
  onSpeak: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  labels: { speak: string; pause: string; resume: string; stop: string };
}

function SpeakerIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

// Botón chico de control de lectura (escuchar/pausar/reanudar/detener). aria-label obligatorio (icon-only-ish).
function ListenButton({
  onClick,
  label,
  active,
  icon,
}: {
  onClick: () => void;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors duration-[150ms]',
        'hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50',
        active ? 'text-brand-primary' : 'text-text-tertiary hover:text-text-secondary',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface ChatThreadProps {
  sessionId: string;
  onBack: () => void;
  // Mensaje a auto-enviar una sola vez al abrir el hilo (deep-link del Temario §8.7, foco por tema).
  // Opcional y aditivo: no cambia el flujo normal del chat. Ver chat/types.ts.
  initialMessage?: string | undefined;
  onInitialConsumed?: (() => void) | undefined;
}

function Bubble({
  role,
  content,
  listen,
}: {
  role: 'user' | 'assistant';
  content: string;
  // Solo se pasa en bubbles del tutor PERSISTIDOS (no en el de streamingText) y si hay soporte de TTS.
  listen?: ListenControl | undefined;
}) {
  const isUser = role === 'user';
  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
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
      {listen && (
        <div className="flex items-center gap-1">
          {listen.status === 'idle' ? (
            <ListenButton
              onClick={listen.onSpeak}
              label={listen.labels.speak}
              active={false}
              icon={<SpeakerIcon />}
            />
          ) : (
            <>
              {listen.status === 'speaking' ? (
                <ListenButton
                  onClick={listen.onPause}
                  label={listen.labels.pause}
                  active
                  icon={<PauseIcon />}
                />
              ) : (
                <ListenButton
                  onClick={listen.onResume}
                  label={listen.labels.resume}
                  active
                  icon={<PlayIcon />}
                />
              )}
              <ListenButton
                onClick={listen.onStop}
                label={listen.labels.stop}
                active={false}
                icon={<StopIcon />}
              />
            </>
          )}
        </div>
      )}
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

export function ChatThread({ sessionId, onBack, initialMessage, onInitialConsumed }: ChatThreadProps) {
  const { t, i18n } = useTranslation();
  const { messages, isLoading, isError, refetch } = useChatSession(sessionId);
  const { send, retry, isStreaming, streamingText, pendingUserContent, error } =
    useChatStream(sessionId, toChatLanguage(i18n.language));
  const speechLang = SPEECH_LANG[i18n.language.split('-')[0] ?? 'en'] ?? 'en-US';
  const {
    isSupported: ttsSupported,
    status: ttsStatus,
    speakingId,
    speak,
    pause: pauseSpeech,
    resume: resumeSpeech,
    cancel: cancelSpeech,
  } = useSpeechSynthesis({ lang: speechLang });
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  // Auto-envío del mensaje inicial (foco por tema), una sola vez por hilo. El componente se remonta
  // por `key={sessionId}` en ChatPage, así que cada sesión nueva tiene su propio guard en false.
  useEffect(() => {
    if (initialMessage && !initialSentRef.current) {
      initialSentRef.current = true;
      void send(initialMessage);
      onInitialConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

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
            {visible.map((m) => {
              const isAssistant = m.role === ChatRole.ASSISTANT;
              return (
                <Bubble
                  key={m.id}
                  role={isAssistant ? 'assistant' : 'user'}
                  content={m.content}
                  // Botón "escuchar" solo en mensajes del tutor PERSISTIDOS y si el navegador soporta TTS.
                  listen={
                    isAssistant && ttsSupported
                      ? {
                          // Solo el mensaje activo refleja speaking/paused; el resto queda en idle.
                          status: speakingId === m.id ? ttsStatus : 'idle',
                          onSpeak: () => speak(m.id, m.content),
                          onPause: pauseSpeech,
                          onResume: resumeSpeech,
                          onStop: cancelSpeech,
                          labels: {
                            speak: t('chat.thread.listen.speak'),
                            pause: t('chat.thread.listen.pause'),
                            resume: t('chat.thread.listen.resume'),
                            stop: t('chat.thread.listen.stop'),
                          },
                        }
                      : undefined
                  }
                />
              );
            })}
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
