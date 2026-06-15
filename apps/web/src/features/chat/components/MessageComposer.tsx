import { useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';

interface MessageComposerProps {
  disabled: boolean;
  onSend: (content: string) => void;
}

// Mapea el idioma del toggle i18n al locale BCP-47 que espera la Web Speech API (§8.9).
const SPEECH_LANG: Record<string, string> = { es: 'es-ES', en: 'en-US' };

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      // El pulso de "escuchando" respeta prefers-reduced-motion (§8.9, a11y).
      className={cn('h-4 w-4', active && 'animate-pulse motion-reduce:animate-none')}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

// Caja de envío: Enter envía, Shift+Enter hace salto de línea. Se bloquea mientras hay un stream.
// Dictado (Web Speech API §8.9): el micrófono anexa la transcripción al texto tipeado; degrada
// oculto si el navegador no soporta la API. Solo muta el `value` local → no toca el stream del chat.
export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const { t, i18n } = useTranslation();
  const [value, setValue] = useState('');

  const langBase = i18n.language.split('-')[0] ?? 'en';
  const speechLang = SPEECH_LANG[langBase] ?? 'en-US';
  const { isSupported, status, errorKind, interimTranscript, start, stop } = useSpeechRecognition({
    lang: speechLang,
    // Anexa cada fragmento final al texto ya tipeado (no reemplaza); el usuario edita antes de enviar.
    onResult: (chunk) =>
      setValue((prev) => (prev.trim().length > 0 ? `${prev.trimEnd()} ${chunk}` : chunk)),
  });

  const isListening = status === 'listening';

  // Auto-stop del dictado cuando el composer se deshabilita (stream activo).
  useEffect(() => {
    if (disabled && isListening) stop();
  }, [disabled, isListening, stop]);

  function submit() {
    const content = value.trim();
    if (content.length === 0 || disabled) return;
    if (isListening) stop();
    onSend(content);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function toggleDictation() {
    if (isListening) stop();
    else start();
  }

  return (
    <div className="border-t border-border-subtle p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.thread.placeholder')}
            rows={1}
            maxLength={4000}
            className="max-h-40 min-h-[40px] resize-none"
            aria-label={t('chat.thread.placeholder')}
          />
        </div>
        {isSupported && (
          <Button
            type="button"
            variant="ghost"
            onClick={toggleDictation}
            disabled={disabled}
            aria-label={isListening ? t('chat.thread.voice.stop') : t('chat.thread.voice.start')}
            aria-pressed={isListening}
            className={cn('px-2', isListening && 'text-brand-primary')}
          >
            <MicIcon active={isListening} />
          </Button>
        )}
        <Button
          type="button"
          onClick={submit}
          loading={disabled}
          disabled={value.trim().length === 0}
          aria-label={t('chat.thread.send')}
        >
          {t('chat.thread.send')}
        </Button>
      </div>

      {/* Estado del dictado: interim mientras escucha (transcribiendo) / error accionable. */}
      {isListening && (
        <p className="mt-1.5 px-1 text-xs italic text-text-tertiary" aria-live="polite">
          {interimTranscript.length > 0 ? interimTranscript : t('chat.thread.voice.listening')}
        </p>
      )}
      {status === 'error' && (
        <p className="mt-1.5 px-1 text-xs text-error" aria-live="assertive">
          {errorKind === 'not-allowed'
            ? t('chat.thread.voice.denied')
            : t('chat.thread.voice.error')}
        </p>
      )}
    </div>
  );
}
