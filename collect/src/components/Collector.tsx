'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_LABELS } from '@/lib/labels';
import { promptFor } from '@/lib/prompt';
import type { Language, Phrase } from '@/lib/types';

const STORAGE_KEY = 'kgb-collect-v1';
const MIC_KEY = 'kgb-mic-device';
const CLIENT_MAX_MS = 15_000;
const CLIENT_MIN_MS = 300;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const LANGS: { id: Language; label: string }[] = [
  { id: 'fon', label: 'Fon' },
  { id: 'yoruba', label: 'Yoruba' },
  { id: 'fr', label: 'Français' },
];

const GENDERS = [
  { id: 'femme', label: 'Femme' },
  { id: 'homme', label: 'Homme' },
];

const AGES = [
  { id: '18-25', label: '18 à 25 ans' },
  { id: '26-35', label: '26 à 35 ans' },
  { id: '36-50', label: '36 à 50 ans' },
  { id: '51+', label: '51 ans et plus' },
];

type MicChoice = { id: string; label: string };

type Step = 'home' | 'consent' | 'profile' | 'record';
type Phase = 'idle' | 'recording' | 'review' | 'sending';

type Draft = {
  consent: boolean;
  language: Language | '';
  speakerCode: string;
  gender: string;
  ageRange: string;
  order: Partial<Record<Language, string[]>>;
  cursor: Partial<Record<Language, number>>;
  sent: Partial<Record<Language, string[]>>;
  skipped: Partial<Record<Language, string[]>>;
};

function emptyDraft(): Draft {
  return {
    consent: false,
    language: '',
    speakerCode: '',
    gender: '',
    ageRange: '',
    order: {},
    cursor: {},
    sent: {},
    skipped: {},
  };
}

function makeCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = 'loc-';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

function shuffle(ids: string[]): string[] {
  const copy = ids.slice();
  const random = new Uint32Array(copy.length);
  crypto.getRandomValues(random);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = random[i] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ensureOrder(ids: string[], existing: string[] | undefined): string[] {
  const known = new Set(ids);
  const kept = (existing ?? []).filter((id) => known.has(id));
  if (kept.length === 0) return shuffle(ids);
  const have = new Set(kept);
  return kept.concat(ids.filter((id) => !have.has(id)));
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed || typeof parsed !== 'object') return null;
    const draft = { ...emptyDraft(), ...parsed, cursor: parsed.cursor ?? {} };
    if (draft.gender !== 'femme' && draft.gender !== 'homme') draft.gender = '';
    return draft;
  } catch {
    return null;
  }
}

function firstOpenIndex(order: string[], sent?: string[], skipped?: string[]): number {
  const done = new Set([...(sent ?? []), ...(skipped ?? [])]);
  const index = order.findIndex((id) => !done.has(id));
  return index === -1 ? order.length : index;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

const WAVE_BARS = 36;

function clock(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function flatWave(height = 0.08): number[] {
  return Array.from({ length: WAVE_BARS }, () => height);
}

function resamplePeaks(samples: number[], count: number): number[] {
  if (samples.length === 0) return flatWave();
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i * samples.length) / count);
    const end = Math.max(start + 1, Math.floor(((i + 1) * samples.length) / count));
    let peak = 0;
    for (let j = start; j < Math.min(end, samples.length); j += 1) peak = Math.max(peak, samples[j] ?? 0);
    out.push(peak);
  }
  return out;
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const scoped = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext || scoped.webkitAudioContext || null;
}

function rmsLevel(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const sample = (data[i] - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / data.length);
  return Math.min(1, rms * 7);
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 17v3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 8a7 7 0 1 0 1.2 6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M19 4v4h-4" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function playableBlob(blob: Blob): Blob | null {
  const probe = document.createElement('audio');
  const raw = blob.type || '';
  const base = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  const candidates = [
    raw,
    base,
    base === 'audio/mp4' || base === 'video/mp4' ? 'audio/mp4' : '',
    base === 'audio/mp4' || base === 'video/mp4' ? 'video/mp4' : '',
    base === 'audio/webm' || base === 'video/webm' ? 'audio/webm' : '',
    base === 'audio/webm' || base === 'video/webm' ? 'audio/webm;codecs=opus' : '',
    base === 'audio/ogg' ? 'audio/ogg;codecs=opus' : '',
  ].filter((type, index, all) => type && all.indexOf(type) === index);
  const chosen = candidates.find((type) => probe.canPlayType(type) !== '');
  if (!chosen) return null;
  if (chosen === raw) return blob;
  return new Blob([blob], { type: chosen });
}

function chooseMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function audioConstraints(deviceId: string): MediaTrackConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  return audio;
}

function extensionFor(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base.includes('mp4') || base.includes('aac') || base.includes('m4a')) return 'm4a';
  if (base.includes('ogg')) return 'ogg';
  if (base.includes('wav')) return 'wav';
  if (base.includes('mpeg') || base.includes('mp3')) return 'mp3';
  return 'webm';
}

function readDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const url = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('metadata'));
    };
    audio.src = url;
  });
}

export default function Collector({ phrases }: { phrases: Phrase[] }) {
  const [step, setStep] = useState<Step>('home');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [armClear, setArmClear] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [levels, setLevels] = useState<number[]>(() => flatWave());
  const [mics, setMics] = useState<MicChoice[]>([]);
  const [micId, setMicId] = useState('');
  const [micStatus, setMicStatus] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveRaf = useRef<number | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(0);
  const honeypotRef = useRef('');
  const playRef = useRef<HTMLAudioElement | null>(null);
  const playUrlRef = useRef<string | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const playSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playRafRef = useRef<number | null>(null);
  const playingRef = useRef(false);
  const samplesRef = useRef<number[]>([]);
  const silenceMsRef = useRef(0);
  const silenceNotedRef = useRef(false);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const micIdRef = useRef('');
  const micStatusRef = useRef('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const phraseById = useMemo(() => new Map(phrases.map((phrase) => [phrase.id, phrase])), [phrases]);
  const ids = useMemo(() => phrases.map((phrase) => phrase.id), [phrases]);

  useEffect(() => {
    const saved = loadDraft();
    if (saved) setDraft(saved);
    const savedMic = localStorage.getItem(MIC_KEY) || '';
    micIdRef.current = savedMic;
    setMicId(savedMic);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  useEffect(() => {
    if (step !== 'record') return;
    void refreshMics();
  }, [step]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (waveRaf.current !== null) cancelAnimationFrame(waveRaf.current);
      if (playUrlRef.current) URL.revokeObjectURL(playUrlRef.current);
      playRef.current?.pause();
      playRef.current?.remove();
      void audioCtxRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const rec = recRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
    };
  }, []);

  const language = draft.language;
  const order = language ? draft.order[language] ?? [] : [];
  const sentIds = language ? draft.sent[language] ?? [] : [];
  const sentSet = useMemo(() => new Set(sentIds), [sentIds]);
  const storedCursor = language ? draft.cursor?.[language] : undefined;
  const safeCursor =
    order.length === 0 ? 0 : Math.min(Math.max(storedCursor ?? 0, 0), order.length);
  const atEnd = order.length > 0 && safeCursor >= order.length;
  const current = atEnd ? undefined : phraseById.get(order[safeCursor] ?? '');
  const sentTotal = (['fon', 'yoruba', 'fr'] as const).reduce(
    (sum, lang) => sum + new Set(draft.sent[lang] ?? []).size,
    0,
  );
  const sentCount = order.filter((id) => sentSet.has(id)).length;
  const missingCount = order.filter((id) => !sentSet.has(id)).length;
  const firstMissing = order.findIndex((id) => !sentSet.has(id));

  useEffect(() => {
    releasePlayback();
    setBlob(null);
    setPhase('idle');
    setElapsed(0);
    setDurationMs(0);
    setLevels(flatWave());
    setError('');
    setInfo('');
    // La lecture est liée à la phrase affichée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderStreamRef.current = null;
  }

  function noteMic(status: string) {
    if (micStatusRef.current === status) return;
    micStatusRef.current = status;
    setMicStatus(status);
  }

  async function refreshMics() {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const found = await navigator.mediaDevices.enumerateDevices();
    const inputs = found.filter((device) => device.kind === 'audioinput');
    setMics(
      inputs.map((device, index) => ({
        id: device.deviceId,
        label: device.label.trim() || `Microphone ${index + 1}`,
      })),
    );
  }

  async function stopAnalyser() {
    if (waveRaf.current !== null) {
      cancelAnimationFrame(waveRaf.current);
      waveRaf.current = null;
    }
    const context = audioCtxRef.current;
    audioCtxRef.current = null;
    if (context && context.state !== 'closed') {
      try {
        await context.suspend();
      } catch {
        /* déjà coupé */
      }
      try {
        await context.close();
      } catch {
        /* déjà fermé */
      }
    }
  }

  function releasePlayback() {
    const player = playRef.current;
    playRef.current = null;
    if (player) {
      player.onended = null;
      player.ontimeupdate = null;
      player.onerror = null;
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.remove();
    }
    if (playRafRef.current !== null) {
      cancelAnimationFrame(playRafRef.current);
      playRafRef.current = null;
    }
    if (playSourceRef.current) {
      try {
        playSourceRef.current.stop();
      } catch {
        /* déjà arrêté */
      }
      playSourceRef.current = null;
    }
    const playbackContext = playCtxRef.current;
    playCtxRef.current = null;
    if (playbackContext && playbackContext.state !== 'closed') void playbackContext.close();
    if (playUrlRef.current) {
      URL.revokeObjectURL(playUrlRef.current);
      playUrlRef.current = null;
    }
    playingRef.current = false;
    setPlaying(false);
    setPlaybackMs(0);
  }

  function paintEnvelope(samples: number[], filled: number) {
    const count = Math.max(1, Math.min(WAVE_BARS, filled));
    const shaped = resamplePeaks(samples, count);
    const next = shaped.concat(flatWave().slice(shaped.length));
    setLevels(next.slice(0, WAVE_BARS));
  }

  function watchMic(context: AudioContext, stream: MediaStream) {
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.35;
    source.connect(analyser);
    samplesRef.current = [];
    silenceMsRef.current = 0;
    silenceNotedRef.current = false;
    const data = new Uint8Array(analyser.fftSize);
    let last = performance.now();
    const draw = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const sample = (data[i] - 128) / 128;
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = rmsLevel(data);
      samplesRef.current.push(level);
      const now = performance.now();
      silenceMsRef.current = rms < 0.012 ? silenceMsRef.current + (now - last) : 0;
      last = now;
      const track = stream.getAudioTracks()[0];
      const muted = !track || track.readyState !== 'live' || track.muted || !track.enabled;
      noteMic(muted ? 'Micro muet' : 'Micro actif');
      if (silenceMsRef.current >= 1500 && !silenceNotedRef.current) {
        silenceNotedRef.current = true;
        noteMic('Micro muet');
        setInfo('Le micro ne capte rien. Choisissez un autre micro.');
      } else if (rms >= 0.012 && silenceNotedRef.current) {
        silenceNotedRef.current = false;
        setInfo('');
      }
      const elapsedMs = Date.now() - startedRef.current;
      setElapsed(elapsedMs);
      const filled = Math.max(1, Math.round(Math.min(1, elapsedMs / CLIENT_MAX_MS) * WAVE_BARS));
      paintEnvelope(samplesRef.current, filled);
      waveRaf.current = requestAnimationFrame(draw);
    };
    draw();
  }

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function goConsent() {
    setStep('consent');
  }

  function goProfile() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      consent: true,
      speakerCode: currentDraft.speakerCode || makeCode(),
    }));
    setStep('profile');
  }

  function startPhrases() {
    if (!draft.language) return;
    const lang = draft.language;
    setDraft((currentDraft) => {
      const nextOrder = ensureOrder(ids, currentDraft.order[lang]);
      const stored = currentDraft.cursor?.[lang];
      const cursor =
        typeof stored === 'number' && stored >= 0
          ? Math.min(stored, nextOrder.length)
          : firstOpenIndex(nextOrder, currentDraft.sent[lang], currentDraft.skipped[lang]);
      return {
        ...currentDraft,
        order: { ...currentDraft.order, [lang]: nextOrder },
        cursor: { ...currentDraft.cursor, [lang]: cursor },
      };
    });
    setStep('record');
  }

  function resume() {
    if (!draft.consent) {
      setStep('consent');
      return;
    }
    if (!draft.language) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        speakerCode: currentDraft.speakerCode || makeCode(),
      }));
      setStep('profile');
      return;
    }
    startPhrases();
  }

  function clearLocal() {
    if (!armClear) {
      setArmClear(true);
      return;
    }
    const fresh = emptyDraft();
    setDraft(fresh);
    localStorage.removeItem(STORAGE_KEY);
    setArmClear(false);
    setStep('home');
  }

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}`;
    const payload = {
      title: 'KwèGbaTché, donner sa voix',
      text: 'Aidez à entraîner un assistant vocal en fon, en yoruba et en français.',
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShareUrl('');
    } catch {
      setCopied(false);
      setShareUrl(url);
    }
  }

  async function startRecording() {
    setError('');
    setInfo('');
    releasePlayback();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Cet appareil ne peut pas enregistrer ici. Ouvrez Chrome ou Safari, ou importez un audio.');
      return;
    }
    const Context = audioContextCtor();
    if (!Context) {
      setError('Cet appareil ne peut pas analyser le micro.');
      return;
    }
    const context = new Context();
    audioCtxRef.current = context;
    const resumed = context.resume();
    try {
      const preferred = micIdRef.current;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints(preferred) });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints('') });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }
      await resumed;
      if (context.state === 'suspended') await context.resume();
      streamRef.current = stream;
      let forRecorder = stream;
      try {
        forRecorder = stream.clone();
      } catch {
        forRecorder = stream;
      }
      recorderStreamRef.current = forRecorder;
      await refreshMics();
      const track = stream.getAudioTracks()[0];
      noteMic(!track || track.readyState !== 'live' || track.muted || !track.enabled ? 'Micro muet' : 'Micro actif');
      track?.addEventListener('mute', () => noteMic('Micro muet'));
      track?.addEventListener('unmute', () => noteMic('Micro actif'));
      watchMic(context, stream);
      const mime = chooseMime();
      const rec = mime ? new MediaRecorder(forRecorder, { mimeType: mime }) : new MediaRecorder(forRecorder);
      chunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      rec.onstop = () => {
        const chunks = chunksRef.current.slice();
        const history = samplesRef.current.slice();
        const ms = Math.max(0, Date.now() - startedRef.current);
        const recorded = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        void finishTake(recorded, history, ms);
      };
      recRef.current = rec;
      rec.start(250);
      startedRef.current = Date.now();
      setElapsed(0);
      setPhase('recording');
      clearTimer();
      timerRef.current = window.setInterval(() => {
        const ms = Date.now() - startedRef.current;
        setElapsed(ms);
        if (ms >= CLIENT_MAX_MS) {
          const active = recRef.current;
          if (active && active.state === 'recording') active.stop();
          setInfo('Durée maximum atteinte.');
        }
      }, 200);
    } catch {
      await stopAnalyser();
      stopStream();
      setPhase((currentPhase) => (currentPhase === 'recording' ? 'idle' : currentPhase));
      setError(
        "Le micro ne s'ouvre pas. Autorisez-le, ou ouvrez la page dans Chrome ou Safari. Dans WhatsApp : menu, puis Ouvrir dans le navigateur.",
      );
    }
  }

  async function finishTake(recorded: Blob, history: number[], ms: number) {
    await stopAnalyser();
    stopStream();
    clearTimer();
    setElapsed(ms);
    setDurationMs(ms);
    if (recorded.size < 800) {
      setBlob(null);
      setLevels(flatWave());
      setPhase('idle');
      setError("L'enregistrement est vide. Réessayez.");
      return;
    }
    setBlob(recorded);
    setLevels(resamplePeaks(history, WAVE_BARS));
    setPhase('review');
    const envelope = await envelopeFromBlob(recorded);
    if (!envelope) return;
    setLevels(envelope.bars);
    if (envelope.durationMs > 0) setDurationMs(envelope.durationMs);
  }

  function stopRecording() {
    const rec = recRef.current;
    if (rec && rec.state === 'recording') rec.stop();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setInfo('');
    try {
      const seconds = await readDuration(file);
      const ms = Math.round(seconds * 1000);
      if (!Number.isFinite(ms) || ms < CLIENT_MIN_MS || ms > 20_000) {
        setError('Le fichier doit durer entre une demi-seconde et 20 secondes.');
        return;
      }
      setDurationMs(ms);
      setBlob(file);
      setPhase('review');
    } catch {
      setError('Impossible de lire ce fichier audio.');
    }
  }

  function rerecord() {
    stopAnalyser();
    releasePlayback();
    setBlob(null);
    setLevels(flatWave());
    setPhase('idle');
    setElapsed(0);
    setDurationMs(0);
    setInfo('');
    setError('');
  }

  function replay() {
    if (playingRef.current) {
      releasePlayback();
      return;
    }
    if (!blob || blob.size < 2048) {
      setError("L'enregistrement est vide. Réessayez.");
      return;
    }
    releasePlayback();
    const recordContext = audioCtxRef.current;
    audioCtxRef.current = null;
    if (recordContext && recordContext.state !== 'closed') {
      void recordContext.suspend();
      void recordContext.close();
    }
    const Context = audioContextCtor();
    const playbackContext = Context ? new Context() : null;
    if (playbackContext) {
      playCtxRef.current = playbackContext;
      void playbackContext.resume();
    }
    const source = playableBlob(blob);
    if (!source) {
      if (playbackContext) void playDecoded(playbackContext, blob);
      else setError('Lecture impossible. Réessayez.');
      return;
    }
    const url = URL.createObjectURL(source);
    playUrlRef.current = url;
    const player = document.createElement('audio');
    player.setAttribute('playsinline', 'true');
    player.preload = 'auto';
    player.volume = 1;
    player.muted = false;
    player.src = url;
    player.setAttribute('aria-hidden', 'true');
    document.body.appendChild(player);
    playRef.current = player;
    player.ontimeupdate = () => setPlaybackMs(player.currentTime * 1000);
    player.onended = () => {
      playingRef.current = false;
      setPlaying(false);
      const end = Number.isFinite(player.duration) ? player.duration * 1000 : 0;
      setPlaybackMs(end);
    };
    let fallbackStarted = false;
    const fallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      if (playbackContext) void playDecoded(playbackContext, blob);
      else {
        playingRef.current = false;
        setPlaying(false);
        setError('Lecture impossible. Réessayez.');
      }
    };
    player.onerror = () => {
      if (!playingRef.current) fallback();
    };
    player.load();
    const started = player.play();
    void Promise.resolve(started)
      .then(() => {
        playingRef.current = true;
        setPlaying(true);
        if (playbackContext && playbackContext.state !== 'closed') {
          void playbackContext.suspend();
          void playbackContext.close();
          if (playCtxRef.current === playbackContext) playCtxRef.current = null;
        }
      })
      .catch(fallback);
  }

  async function playDecoded(context: AudioContext, data: Blob) {
    try {
      if (context.state === 'suspended') await context.resume();
      const copy = (await data.arrayBuffer()).slice(0);
      const buffer = await context.decodeAudioData(copy);
      if (!buffer.duration || buffer.length < 1) throw new Error('durée nulle');
      let peak = 0;
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 32) peak = Math.max(peak, Math.abs(channel[i] ?? 0));
      if (peak < 0.001) throw new Error('silence');
      const node = context.createBufferSource();
      node.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 1;
      node.connect(gain);
      gain.connect(context.destination);
      playSourceRef.current = node;
      const origin = context.currentTime;
      node.onended = () => {
        if (playSourceRef.current !== node) return;
        playingRef.current = false;
        setPlaying(false);
        setPlaybackMs(buffer.duration * 1000);
      };
      node.start();
      playingRef.current = true;
      setPlaying(true);
      const tick = () => {
        if (!playingRef.current || playSourceRef.current !== node) return;
        setPlaybackMs(Math.min(buffer.duration, context.currentTime - origin) * 1000);
        playRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      playingRef.current = false;
      setPlaying(false);
      setError('Lecture impossible. Réessayez.');
    }
  }

  async function envelopeFromBlob(data: Blob): Promise<{ bars: number[]; durationMs: number } | null> {
    const Context = audioContextCtor();
    if (!Context) return null;
    const context = new Context();
    try {
      const copy = (await data.arrayBuffer()).slice(0);
      const buffer = await context.decodeAudioData(copy);
      if (!buffer.duration || buffer.length < 1) return null;
      const channel = buffer.getChannelData(0);
      const size = Math.max(1, Math.floor(channel.length / WAVE_BARS));
      const bars: number[] = [];
      for (let i = 0; i < WAVE_BARS; i += 1) {
        const start = i * size;
        const end = Math.min(channel.length, start + size);
        let sum = 0;
        for (let j = start; j < end; j += 1) sum += (channel[j] ?? 0) * (channel[j] ?? 0);
        const rms = Math.sqrt(sum / Math.max(1, end - start));
        bars.push(Math.min(1, rms * 7));
      }
      return { bars, durationMs: Math.round(buffer.duration * 1000) };
    } catch {
      return null;
    } finally {
      if (context.state !== 'closed') await context.close();
    }
  }

  function move(next: number) {
    if (!language || order.length === 0) return;
    if (phase === 'recording' || phase === 'sending' || phase === 'review') return;
    const clamped = Math.max(0, Math.min(order.length, next));
    setDraft((currentDraft) => ({
      ...currentDraft,
      cursor: { ...currentDraft.cursor, [language]: clamped },
    }));
  }

  async function send() {
    if (!blob || !current || !language || phase === 'sending') return;
    if (durationMs < CLIENT_MIN_MS) {
      setError('Enregistrement trop court. Réessayez.');
      return;
    }
    releasePlayback();
    setPhase('sending');
    setError('');
    const body = new FormData();
    body.set('audio', blob, `prise.${extensionFor(blob.type)}`);
    body.set('language', language);
    body.set('phraseId', current.id);
    body.set('speakerCode', draft.speakerCode);
    body.set('gender', draft.gender);
    body.set('ageRange', draft.ageRange);
    body.set('consent', 'yes');
    body.set('durationMs', String(durationMs));
    const trap = document.querySelector<HTMLInputElement>('#societe')?.value ?? honeypotRef.current;
    body.set('societe', trap);
    const phraseId = current.id;
    try {
      const response = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'X-Kwegbatche-Client': 'web' },
        body,
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; speakerCode?: string };
      if (!response.ok) {
        setError(data.error || 'Envoi impossible. Réessayez.');
        setPhase('review');
        return;
      }
      setDraft((currentDraft) => {
        const previous = currentDraft.sent[language] ?? [];
        const sent = previous.includes(phraseId) ? previous : [...previous, phraseId];
        const phraseOrder = currentDraft.order[language] ?? [];
        const index = currentDraft.cursor?.[language] ?? 0;
        return {
          ...currentDraft,
          speakerCode:
            typeof data.speakerCode === 'string' && data.speakerCode
              ? data.speakerCode
              : currentDraft.speakerCode,
          sent: { ...currentDraft.sent, [language]: sent },
          cursor: { ...currentDraft.cursor, [language]: Math.min(phraseOrder.length, index + 1) },
        };
      });
    } catch {
      setError('Pas de réseau. Réessayez.');
      setPhase('review');
    }
  }

  const total = order.length || phrases.length;
  const prompt = current && language ? promptFor(current, language) : null;
  const alreadySent = Boolean(current && sentSet.has(current.id));
  const navLocked = phase === 'recording' || phase === 'sending' || phase === 'review';
  const shownMs = playing ? playbackMs : phase === 'recording' ? elapsed : durationMs;
  const waveProgress = playing
    ? Math.min(1, durationMs > 0 ? playbackMs / durationMs : 0)
    : Math.min(1, Math.max(0, shownMs / CLIENT_MAX_MS));
  const timerLabel = playing
    ? `${clock(playbackMs)} / ${clock(durationMs || CLIENT_MAX_MS)}`
    : `${clock(phase === 'recording' ? elapsed : durationMs)} / 00:15`;

  return (
    <div className="stack-lg">
      {step === 'home' ? (
        <section className="card stack">
          <h1>Aidez l’assistant à vous comprendre</h1>
          <p className="lead">
            KwèGbaTché est un assistant vocal pour le mobile money, en fon, en yoruba et en français.
            Votre voix sert à l’entraîner et à le tester.
          </p>
          <p>Quelques phrases courtes, sur votre téléphone. Environ dix minutes.</p>
          <p>Pas de nom complet. Pas de numéro de téléphone.</p>
          {hydrated && sentTotal > 0 ? (
            <p className="note">
              Vous avez déjà envoyé {plural(sentTotal, 'phrase', 'phrases')} sur cet appareil.
            </p>
          ) : null}
          <button type="button" className="btn primary" onClick={goConsent}>
            Commencer
          </button>
          {hydrated && (sentTotal > 0 || draft.consent) ? (
            <button type="button" className="btn secondary" onClick={resume}>
              Continuer
            </button>
          ) : null}
          <button type="button" className="btn secondary" onClick={() => void share()}>
            {copied ? 'Lien copié' : 'Partager le lien'}
          </button>
          {shareUrl ? (
            <label className="field">
              Copiez ce lien
              <input type="text" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
            </label>
          ) : null}
          {hydrated && sentTotal > 0 ? (
            <button type="button" className="btn quiet" onClick={clearLocal}>
              {armClear ? 'Confirmer l’effacement' : 'Effacer la progression sur ce téléphone'}
            </button>
          ) : null}
          <a className="footer-link" href="/admin">
            Validation équipe
          </a>
        </section>
      ) : null}

      {step === 'consent' ? (
        <section className="card stack">
          <h1>Votre accord</h1>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.consent}
              onChange={(event) => setDraft((currentDraft) => ({ ...currentDraft, consent: event.target.checked }))}
            />
            <span>
              J’accepte que ma voix soit utilisée seulement pour entraîner et tester le prototype KwèGbaTché,
              pour le GPU Challenge. Je peux demander la suppression de mes enregistrements avec mon code
              locuteur. On ne me demande ni mon nom complet, ni mon numéro de téléphone. J’ai 18 ans ou plus.
            </span>
          </label>
          <button type="button" className="btn primary" disabled={!draft.consent} onClick={goProfile}>
            Continuer
          </button>
          <button type="button" className="btn quiet" onClick={() => setStep('home')}>
            Retour
          </button>
        </section>
      ) : null}

      {step === 'profile' ? (
        <section className="card stack">
          <h1>Votre profil</h1>
          <fieldset>
            <legend>Langue</legend>
            <div className="choices langs">
              {LANGS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="choice"
                  aria-pressed={draft.language === item.id}
                  onClick={() => setDraft((currentDraft) => ({ ...currentDraft, language: item.id }))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="field">
            Code locuteur, facultatif
            <input
              type="text"
              maxLength={32}
              autoComplete="off"
              value={draft.speakerCode}
              onChange={(event) =>
                setDraft((currentDraft) => ({ ...currentDraft, speakerCode: event.target.value }))
              }
            />
          </label>
          <p className="help">
            Un mot court, sans votre vrai nom. Notez-le pour continuer plus tard, ou pour demander une
            suppression.
          </p>
          <fieldset>
            <legend>Sexe, facultatif</legend>
            <div className="choices pair">
              {GENDERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="choice"
                  aria-pressed={draft.gender === item.id}
                  onClick={() =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      gender: currentDraft.gender === item.id ? '' : item.id,
                    }))
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Âge, facultatif</legend>
            <div className="choices split">
              {AGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="choice"
                  aria-pressed={draft.ageRange === item.id}
                  onClick={() =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      ageRange: currentDraft.ageRange === item.id ? '' : item.id,
                    }))
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="btn primary" disabled={!draft.language} onClick={startPhrases}>
            Voir les phrases
          </button>
        </section>
      ) : null}

      {step === 'record' && language && current && prompt ? (
        <section className="card stack">
          <p className="meta">
            {LANGUAGE_LABELS[language]}
            {draft.speakerCode ? `, code ${draft.speakerCode}` : ''}
          </p>
          <p className="meta">{plural(sentCount, 'envoyée', 'envoyées')}</p>
          <p className="note">{prompt.hint}</p>
          {alreadySent ? (
            <p className="note">Déjà envoyée. Une nouvelle prise ne compte pas deux fois.</p>
          ) : null}
          <p className="sentence-pill" aria-live="polite">
            {prompt.text}
          </p>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (phase === 'review') void send();
            }}
          >
            <div className="hp" aria-hidden="true">
              <label htmlFor="societe">Société</label>
              <input
                id="societe"
                name="societe"
                tabIndex={-1}
                autoComplete="off"
                onChange={(event) => {
                  honeypotRef.current = event.target.value;
                }}
              />
            </div>
            {mics.length > 1 ? (
              <label className="field mic-picker">
                Microphone
                <select
                  value={mics.some((item) => item.id === micId) ? micId : ''}
                  onChange={(event) => {
                    const next = event.target.value;
                    micIdRef.current = next;
                    setMicId(next);
                    localStorage.setItem(MIC_KEY, next);
                  }}
                >
                  <option value="">Micro par défaut</option>
                  {mics.map((item) => (
                    <option key={item.id || item.label} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {micStatus ? <p className="help">{micStatus}</p> : null}
            <div className="wave" aria-hidden="true">
              {levels.map((level, index) => (
                <span
                  key={index}
                  data-on={index / levels.length < waveProgress ? '1' : '0'}
                  style={{ ['--h' as string]: String(level) }}
                />
              ))}
            </div>
            <div className="deck">
              <button
                type="button"
                className="mic"
                data-on={phase === 'recording' ? '1' : '0'}
                aria-label={phase === 'recording' ? 'Arrêter' : 'Enregistrer'}
                disabled={phase === 'sending'}
                onClick={() => (phase === 'recording' ? stopRecording() : void startRecording())}
              >
                {phase === 'recording' ? <StopIcon /> : <MicIcon />}
              </button>
              <p className="timer">{timerLabel}</p>
              <button
                type="button"
                className="btn secondary redo"
                disabled={!blob || phase === 'recording' || phase === 'sending'}
                onClick={rerecord}
              >
                <RedoIcon />
                Recommencer
              </button>
            </div>
            <p className="help">Sur téléphone, Chrome ou Safari fonctionne mieux que la fenêtre WhatsApp.</p>
            {phase === 'idle' ? (
              <>
                <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
                  Importer un audio
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void onFile(file);
                  }}
                />
              </>
            ) : null}
            {phase === 'review' || phase === 'sending' ? (
              <div className="nav-row">
                <button type="button" className="btn replay" disabled={!blob || phase === 'sending'} onClick={replay}>
                  {playing ? "Arrêter l'écoute" : 'Réécouter'}
                </button>
                <button type="submit" className="btn validate" disabled={phase === 'sending'}>
                  {phase === 'sending' ? 'Envoi en cours' : "Valider l'envoi"}
                </button>
              </div>
            ) : null}
            <div aria-live="polite">
              {error ? (
                <p className="alert" role="alert">
                  {error}
                </p>
              ) : null}
              {info ? <p className="note">{info}</p> : null}
            </div>
            <div className="nav-row">
              <button
                type="button"
                className="btn secondary"
                disabled={safeCursor <= 0 || navLocked}
                onClick={() => move(safeCursor - 1)}
              >
                Précédent
              </button>
              <button type="button" className="btn secondary" disabled={navLocked} onClick={() => move(safeCursor + 1)}>
                Suivant
              </button>
            </div>
            {phase === 'review' ? (
              <p className="help">Validez l'envoi ou recommencez avant de changer de phrase.</p>
            ) : null}
            <div className="card-foot">
              <div
                className="bar"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={safeCursor + 1}
                aria-label="Position dans les phrases"
              >
                <span style={{ width: `${total ? ((safeCursor + 1) / total) * 100 : 0}%` }} />
              </div>
              <p>
                Phrase {safeCursor + 1} sur {total}
              </p>
            </div>
          </form>
          <p className="help">Vous pouvez fermer la page. Rouvrez le même lien sur ce téléphone pour continuer.</p>
        </section>
      ) : null}

      {step === 'record' && language && atEnd ? (
        <section className="card stack">
          <h1>Merci</h1>
          <p>
            {plural(sentCount, 'phrase envoyée', 'phrases envoyées')} sur {total}. L’équipe les écoute avant de
            les utiliser.
          </p>
          {missingCount > 0 ? (
            <p className="note">
              Il reste {plural(missingCount, 'phrase sans envoi', 'phrases sans envoi')}.
            </p>
          ) : null}
          {draft.speakerCode ? (
            <p>
              Votre code locuteur : <strong>{draft.speakerCode}</strong>. Gardez-le pour demander une suppression,
              ou pour continuer plus tard.
            </p>
          ) : null}
          {firstMissing >= 0 ? (
            <button type="button" className="btn primary" onClick={() => move(firstMissing)}>
              Aller à une phrase sans envoi
            </button>
          ) : null}
          <button type="button" className="btn secondary" onClick={() => move(order.length - 1)}>
            Revenir à la dernière phrase
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setDraft((currentDraft) => ({ ...currentDraft, language: '' }));
              setStep('profile');
            }}
          >
            Enregistrer une autre langue
          </button>
          <button type="button" className="btn quiet" onClick={() => setStep('home')}>
            Retour à l’accueil
          </button>
        </section>
      ) : null}
    </div>
  );
}
