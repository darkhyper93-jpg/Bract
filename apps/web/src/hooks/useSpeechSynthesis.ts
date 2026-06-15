import { useCallback, useEffect, useRef, useState } from 'react';

// Wrapper genérico de la Web Speech API de LECTURA (texto→voz). `speechSynthesis` y
// `SpeechSynthesisUtterance` sí están tipados en lib.dom → no necesita declaración ambient. Ver §8.9.

export type SpeechSynthesisStatus = 'idle' | 'speaking' | 'paused';

interface UseSpeechSynthesisOptions {
  // Idioma BCP-47 (p.ej. 'es-ES' / 'en-US'); lo provee el consumidor desde el toggle i18n.
  lang: string;
}

interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  status: SpeechSynthesisStatus;
  // id del mensaje que se está leyendo (o en pausa) ahora; null = nada. Cada bubble sabe si es el activo.
  speakingId: string | null;
  speak: (id: string, text: string) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export function useSpeechSynthesis({ lang }: UseSpeechSynthesisOptions): UseSpeechSynthesisReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;
  const synth = isSupported ? window.speechSynthesis : undefined;

  const [status, setStatus] = useState<SpeechSynthesisStatus>('idle');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  // id de la lectura activa: el onend/onerror de una lectura previa que termine tarde se ignora si ya
  // no coincide (evita apagar la lectura nueva que el cancel() asíncrono dispara al cambiar de mensaje).
  const activeIdRef = useRef<string | null>(null);

  // KEEPALIVE (Chrome/Edge): speechSynthesis corta las lecturas largas (~15s) si no se la "patea"
  // periódicamente. Guardamos el id del interval en un ref para limpiarlo SIEMPRE (onend/onerror/
  // cancel/pause/unmount) y no dejar intervalos colgados. Ver README §8.9.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);
  const armKeepAlive = useCallback(() => {
    clearKeepAlive();
    // Cada 10s (< ~15s del corte de Chrome) con resume(). Fallback si no alcanza: alternar pause()+resume().
    keepAliveRef.current = setInterval(() => {
      synth?.resume();
    }, 10000);
  }, [synth, clearKeepAlive]);

  const cancel = useCallback(() => {
    clearKeepAlive();
    activeIdRef.current = null;
    synth?.cancel();
    setSpeakingId(null);
    setStatus('idle');
  }, [synth, clearKeepAlive]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (synth === undefined) return;
      // Cancela cualquier lectura en curso antes de empezar otra (una sola voz a la vez).
      synth.cancel();
      // Limpia un keepalive previo ANTES de armar el nuevo → nunca quedan intervalos colgados.
      clearKeepAlive();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langRef.current;
      const handleEnd = () => {
        // Solo reacciona si sigue siendo la lectura activa (no una previa que terminó tarde).
        if (activeIdRef.current !== id) return;
        clearKeepAlive();
        activeIdRef.current = null;
        setSpeakingId(null);
        setStatus('idle');
      };
      utterance.onend = handleEnd;
      utterance.onerror = handleEnd;
      activeIdRef.current = id;
      setSpeakingId(id);
      setStatus('speaking');
      synth.speak(utterance);
      armKeepAlive();
    },
    [synth, clearKeepAlive, armKeepAlive],
  );

  const pause = useCallback(() => {
    if (synth === undefined) return;
    // CRÍTICO: suspender el keepalive mientras está pausado; si no, el resume() de los 10s
    // reanudaría solo lo que el usuario pausó. Se re-arma en resume().
    clearKeepAlive();
    synth.pause();
    setStatus((prev) => (prev === 'speaking' ? 'paused' : prev));
  }, [synth, clearKeepAlive]);

  const resume = useCallback(() => {
    if (synth === undefined) return;
    synth.resume();
    // La lectura vuelve a estar activa → re-armar el keepalive.
    armKeepAlive();
    setStatus((prev) => (prev === 'paused' ? 'speaking' : prev));
  }, [synth, armKeepAlive]);

  // Cancela cualquier lectura en curso (y su keepalive) al desmontar.
  useEffect(() => {
    return () => {
      clearKeepAlive();
      synth?.cancel();
    };
  }, [synth, clearKeepAlive]);

  return { isSupported, status, speakingId, speak, pause, resume, cancel };
}
