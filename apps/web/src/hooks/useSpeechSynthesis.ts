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

  const cancel = useCallback(() => {
    synth?.cancel();
    setSpeakingId(null);
  }, [synth]);

  const speak = useCallback(
    (id: string, text: string) => {
      if (synth === undefined) return;
      // Cancela cualquier lectura en curso antes de empezar otra (una sola voz a la vez).
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langRef.current;
      // El guard `prev === id` evita que el onend/onerror de una lectura previa (que dispara el
      // cancel() de arriba, asíncrono) apague la lectura nueva que ya marcamos como activa.
      utterance.onend = () => {
        setSpeakingId((prev) => (prev === id ? null : prev));
      };
      utterance.onerror = () => {
        setSpeakingId((prev) => (prev === id ? null : prev));
      };
      setSpeakingId(id);
      synth.speak(utterance);
    },
    [synth],
  );

  // Cancela cualquier lectura en curso al desmontar.
  useEffect(() => {
    return () => {
      synth?.cancel();
    };
  }, [synth]);

  return { isSupported, speakingId, speak, cancel };
}
