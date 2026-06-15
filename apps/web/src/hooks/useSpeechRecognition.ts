import { useCallback, useEffect, useRef, useState } from 'react';

// Wrapper genérico (cross-feature: chat ahora, quiz a futuro) de la Web Speech API de DICTADO.
// Ver README §8.9 y los tipos ambient en src/types/speech.d.ts.

export type SpeechRecognitionStatus = 'idle' | 'listening' | 'error';
// `not-allowed` = permiso de micrófono denegado (accionable, distinto de "no soportado").
// `generic` = cualquier otro fallo (red, captura de audio, etc.).
export type SpeechRecognitionErrorKind = 'not-allowed' | 'generic';

interface UseSpeechRecognitionOptions {
  // Idioma BCP-47 (p.ej. 'es-ES' / 'en-US'); lo provee el consumidor desde el toggle i18n.
  lang: string;
  // Se llama con cada fragmento FINAL reconocido, para que el consumidor lo anexe a su input.
  onResult: (finalTranscript: string) => void;
  // ms de silencio (sin nuevos resultados) tras los que se auto-detiene. Cubre el "micrófono fantasma".
  silenceTimeoutMs?: number;
}

interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  status: SpeechRecognitionStatus;
  errorKind: SpeechRecognitionErrorKind | null;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
}

const DEFAULT_SILENCE_TIMEOUT_MS = 3500;

export function useSpeechRecognition({
  lang,
  onResult,
  silenceTimeoutMs = DEFAULT_SILENCE_TIMEOUT_MS,
}: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const RecognitionCtor =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
      : undefined;
  const isSupported = RecognitionCtor !== undefined;

  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');
  const [errorKind, setErrorKind] = useState<SpeechRecognitionErrorKind | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs frescos para no recrear `start` en cada render ni cerrar sobre valores viejos.
  const onResultRef = useRef(onResult);
  const langRef = useRef(lang);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, silenceTimeoutMs);
  }, [clearSilenceTimer, silenceTimeoutMs]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (RecognitionCtor === undefined || recognitionRef.current !== null) return;

    const recognition = new RecognitionCtor();
    recognition.lang = langRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result === undefined) continue;
        const alternative = result[0];
        if (alternative === undefined) continue;
        if (result.isFinal) {
          const text = alternative.transcript.trim();
          if (text.length > 0) onResultRef.current(text);
        } else {
          interim += alternative.transcript;
        }
      }
      setInterimTranscript(interim);
      armSilenceTimer();
    };

    recognition.onerror = (event) => {
      // Pausa larga sin voz o stop manual → no es un error visible: se deja terminar a idle.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      clearSilenceTimer();
      setErrorKind(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'not-allowed'
          : 'generic',
      );
      setStatus('error');
    };

    recognition.onend = () => {
      clearSilenceTimer();
      recognitionRef.current = null;
      setInterimTranscript('');
      // Si terminó por error, conservamos 'error'; si no, volvemos a idle.
      setStatus((prev) => (prev === 'error' ? prev : 'idle'));
    };

    recognitionRef.current = recognition;
    setErrorKind(null);
    setInterimTranscript('');
    setStatus('listening');
    try {
      recognition.start();
    } catch {
      // start() puede lanzar síncrono (p.ej. InvalidStateError). onend no correría, así que
      // limpiamos a mano: reseteamos el ref (permite reintentar) y marcamos error genérico.
      clearSilenceTimer();
      recognitionRef.current = null;
      setErrorKind('generic');
      setStatus('error');
      return;
    }
    armSilenceTimer();
  }, [RecognitionCtor, armSilenceTimer, clearSilenceTimer]);

  // Auto-stop + limpieza al desmontar (cubre "micrófono fantasma" si el usuario navega).
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [clearSilenceTimer]);

  return { isSupported, status, errorKind, interimTranscript, start, stop };
}
