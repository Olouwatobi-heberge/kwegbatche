'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_LABELS } from '@/lib/labels';
import { promptFor } from '@/lib/prompt';
import type { Language, Phrase } from '@/lib/types';

const STORAGE_KEY = 'kgb-collect-v1';
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
  { id: 'non_dit', label: 'Je ne précise pas' },
];

const AGES = [
  { id: '18-25', label: '18 à 25 ans' },
  { id: '26-35', label: '26 à 35 ans' },
  { id: '36-50', label: '36 à 50 ans' },
  { id: '51+', label: '51 ans et plus' },
];

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
    if (draft.gender === 'autre') draft.gender = '';
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

function flatWave(height = 0.2): number[] {
  return Array.from({ length: WAVE_BARS }, () => height);
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

function chooseMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [levels, setLevels] = useState<number[]>(() => flatWave());
  const [reduceMotion, setReduceMotion] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const waveRaf = useRef<number | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(0);
  const honeypotRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const phraseById = useMemo(() => new Map(phrases.map((phrase) => [phrase.id, phrase])), [phrases]);
  const ids = useMemo(() => phrases.map((phrase) => phrase.id), [phrases]);

  useEffect(() => {
    const saved = loadDraft();
    if (saved) setDraft(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated]);

  useEffect(() => {
    if (!blob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      if (waveRaf.current !== null) cancelAnimationFrame(waveRaf.current);
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
    setBlob(null);
    setPhase('idle');
    setElapsed(0);
    setDurationMs(0);
    setLevels(flatWave());
    setError('');
    setInfo('');
  }, [current?.id]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopAnalyser() {
    if (waveRaf.current !== null) {
      cancelAnimationFrame(waveRaf.current);
      waveRaf.current = null;
    }
    const context = audioCtxRef.current;
    audioCtxRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }

  function startAnalyser(stream: MediaStream) {
    stopAnalyser();
    if (reduceMotion || typeof AudioContext === 'undefined') return;
    const context = new AudioContext();
    audioCtxRef.current = context;
    void context.resume();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / WAVE_BARS));
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const next = [];
      for (let i = 0; i < WAVE_BARS; i += 1) {
        let sum = 0;
        for (let j = 0; j < step; j += 1) sum += data[i * step + j] ?? 0;
        next.push(Math.min(1, sum / step / 220));
      }
      setLevels(next);
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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Cet appareil ne peut pas enregistrer ici. Ouvrez Chrome ou Safari, ou importez un audio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startAnalyser(stream);
      const mime = chooseMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'audio/webm';
        const ms = Date.now() - startedRef.current;
        stopAnalyser();
        stopStream();
        clearTimer();
        setDurationMs(ms);
        setBlob(new Blob(chunksRef.current, { type }));
        setPhase('review');
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
          clearTimer();
          setInfo('Durée maximum atteinte.');
        }
      }, 200);
    } catch {
      stopAnalyser();
      stopStream();
      setPhase((currentPhase) => (currentPhase === 'recording' ? 'idle' : currentPhase));
      setError(
        "Le micro ne s'ouvre pas. Autorisez-le, ou ouvrez la page dans Chrome ou Safari. Dans WhatsApp : menu, puis Ouvrir dans le navigateur.",
      );
    }
  }

  function stopRecording() {
    const rec = recRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    clearTimer();
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
    setBlob(null);
    setLevels(flatWave());
    setPhase('idle');
    setElapsed(0);
    setDurationMs(0);
    setInfo('');
    setError('');
  }

  function replay() {
    const player = audioRef.current;
    if (!player) return;
    player.currentTime = 0;
    void player.play().catch(() => setError('Lecture impossible. Réessayez.'));
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
  const shownMs = phase === 'recording' ? elapsed : durationMs;
  const waveProgress = Math.min(1, Math.max(0, shownMs / CLIENT_MAX_MS));

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
            <div className="choices split">
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
            <div className="wave" aria-hidden="true">
              {levels.map((level, index) => (
                <span
                  key={index}
                  data-on={index / levels.length < waveProgress ? '1' : '0'}
                  style={{ ['--h' as string]: String(reduceMotion ? 0.35 : level) }}
                />
              ))}
            </div>
            <div className="deck">
              <button
                type="button"
                className="round"
                aria-label="Arrêter"
                disabled={phase !== 'recording'}
                onClick={stopRecording}
              >
                <StopIcon />
              </button>
              <button
                type="button"
                className="mic"
                data-on={phase === 'recording' ? '1' : '0'}
                aria-label={phase === 'recording' ? 'Enregistrement en cours' : 'Enregistrer'}
                disabled={phase === 'sending' || phase === 'recording'}
                onClick={() => void startRecording()}
              >
                <MicIcon />
              </button>
              <button
                type="button"
                className="round"
                aria-label="Recommencer"
                disabled={phase !== 'review'}
                onClick={rerecord}
              >
                <RedoIcon />
              </button>
              <p className="timer">
                {clock(phase === 'recording' ? elapsed : durationMs)} / 00:15
              </p>
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
            {audioUrl ? <audio ref={audioRef} className="clip" src={audioUrl} playsInline preload="auto" /> : null}
            {phase === 'review' || phase === 'sending' ? (
              <div className="nav-row">
                <button type="button" className="btn replay" disabled={!audioUrl || phase === 'sending'} onClick={replay}>
                  Réécouter
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
