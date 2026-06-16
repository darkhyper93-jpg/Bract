import { useCallback, useEffect, useRef, useState } from 'react';

// Wrapper genérico de la Web Speech API de LECTURA (texto→voz). `speechSynthesis` y
// `SpeechSynthesisUtterance` sí están tipados en lib.dom → no necesita declaración ambient. Ver §8.9.

export type SpeechSynthesisStatus = 'idle' | 'speaking' | 'paused';

// Heurística de calidad: las voces "premium" del SO/navegador suelen llevar estas marcas en el nombre
// (p.ej. "Google español", "Microsoft … Natural", voces "Neural"). Suenan mucho más naturales que la
// default genérica del idioma.
const PREFERRED_VOICE = /google|natural|neural/i;

// Elige la mejor voz disponible para el idioma objetivo (BCP-47). DEPENDE DEL NAVEGADOR/SO: el set de
// voces lo provee el sistema y varía (Chrome trae voces "Google" online; Safari/Edge traen las del SO).
// Orden: 1) voz del idioma con nombre premium (Google/Natural/Neural); 2) voz DEFAULT del idioma
// (la default del idioma suele ser la mejor — antes la evitábamos y sonaba robótica); 3) primera voz
// del idioma. Si no hay ninguna del idioma → undefined (dejamos que el navegador use su voz default).
// Ver README §8.9.
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const base = (lang.split('-')[0] ?? lang).toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  if (matches.length === 0) return undefined;
  return (
    matches.find((v) => PREFERRED_VOICE.test(v.name)) ??
    matches.find((v) => v.default) ??
    matches[0]
  );
}

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

  // Voces del sistema en un ref: `getVoices()` suele llegar VACÍO en el primer render y poblarse async
  // (el navegador dispara `voiceschanged`). Guardamos en ref y la elección se hace recién en `speak()`,
  // así si las voces llegan tarde igual usamos la mejor en la próxima lectura (no re-render necesario).
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (synth === undefined) return;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load(); // algunos navegadores ya las tienen sincrónicamente
    synth.addEventListener('voiceschanged', load); // otros las cargan async → re-leemos al dispararse
    return () => synth.removeEventListener('voiceschanged', load);
  }, [synth]);
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
      // Mejor voz disponible para el idioma (depende del navegador/SO). Si no hay ninguna del idioma,
      // dejamos `utterance.voice` sin setear → el navegador usa su voz default.
      // FIX cruce de idiomas: si el ref llegó vacío (voces aún no cargadas), leémoslas FRESCAS acá; así
      // elegimos una del idioma correcto en vez de caer en la default del navegador (que lee en otro idioma).
      const voices = voicesRef.current.length ? voicesRef.current : (synth.getVoices() ?? []);
      const voice = pickVoice(voices, langRef.current);
      if (voice) utterance.voice = voice;
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
