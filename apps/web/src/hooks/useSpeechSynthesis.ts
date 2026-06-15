import { useCallback, useEffect, useRef, useState } from 'react';

// Wrapper genérico de la Web Speech API de LECTURA (texto→voz). `speechSynthesis` y
// `SpeechSynthesisUtterance` sí están tipados en lib.dom → no necesita declaración ambient. Ver §8.9.

interface UseSpeechSynthesisOptions {
  // Idioma BCP-47 (p.ej. 'es-ES' / 'en-US'); lo provee el consumidor desde el toggle i18n.
  lang: string;
}

interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  // id del mensaje que se está leyendo ahora (null = nada). Permite que cada bubble sepa si es el activo.
  speakingId: string | null;
  speak: (id: string, text: string) => void;
  cancel: () => void;
}

export function useSpeechSynthesis({ lang }: UseSpeechSynthesisOptions): UseSpeechSynthesisReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;
  const synth = isSupported ? window.speechSynthesis : undefined;

  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // KEEPALIVE (Chrome/Edge): speechSynthesis corta las lecturas largas (~15s) si no se la "patea"
  // periódicamente. Guardamos el id del interval en un ref para poder limpiarlo SIEMPRE
  // (onend/onerror/cancel/unmount) y no dejar intervalos colgados. Ver README §8.9.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearKeepAlive();
    synth?.cancel();
    setSpeakingId(null);
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
      // El guard `prev === id` evita que el onend/onerror de una lectura previa (que dispara el
      // cancel() de arriba, asíncrono) apague la lectura nueva que ya marcamos como activa.
      utterance.onend = () => {
        clearKeepAlive();
        setSpeakingId((prev) => (prev === id ? null : prev));
      };
      utterance.onerror = () => {
        clearKeepAlive();
        setSpeakingId((prev) => (prev === id ? null : prev));
      };
      setSpeakingId(id);
      synth.speak(utterance);
      // KEEPALIVE: mientras habla, la "pateamos" cada 10s (< ~15s del corte de Chrome) con resume().
      // Si en pruebas resume() solo no alcanza, alternar pause()+resume(). Se limpia en
      // onend/onerror/cancel/unmount, así nunca queda corriendo sin lectura activa.
      keepAliveRef.current = setInterval(() => {
        synth.resume();
      }, 10000);
    },
    [synth, clearKeepAlive],
  );

  // Cancela cualquier lectura en curso (y su keepalive) al desmontar.
  useEffect(() => {
    return () => {
      clearKeepAlive();
      synth?.cancel();
    };
  }, [synth, clearKeepAlive]);

  return { isSupported, speakingId, speak, cancel };
}
