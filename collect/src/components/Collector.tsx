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
  { id: 'autre', label: 'Autre' },
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
    return { ...emptyDraft(), ...parsed };
  } catch {
    return null;
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function clock(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
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

  const streamRef = useRef<MediaStream | null>(null);
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
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const rec = recRef.current;
      if (rec && rec.state !== 'inactive') rec.stop();
    };
  }, []);

  const language = draft.language;
  const order = language ? draft.order[language] ?? [] : [];
  const sentIds = language ? draft.sent[language] ?? [] : [];
  const skippedIds = language ? draft.skipped[language] ?? [] : [];
  const sentSet = useMemo(() => new Set(sentIds), [sentIds]);
  const skippedSet = useMemo(() => new Set(skippedIds), [skippedIds]);
  const current = order
    .map((id) => phraseById.get(id))
    .find((phrase) => phrase && !sentSet.has(phrase.id) && !skippedSet.has(phrase.id));
  const sentTotal = (['fon', 'yoruba', 'fr'] as const).reduce(
    (sum, lang) => sum + (draft.sent[lang]?.length ?? 0),
    0,
  );

  useEffect(() => {
    setBlob(null);
    setPhase('idle');
    setElapsed(0);
    setDurationMs(0);
    setError('');
    setInfo('');
  }, [current?.id]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
    setDraft((currentDraft) => ({
      ...currentDraft,
      order: { ...currentDraft.order, [lang]: ensureOrder(ids, currentDraft.order[lang]) },
    }));
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
      const mime = chooseMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'audio/webm';
        const ms = Date.now() - startedRef.current;
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
      stopStream();
      setPhase('idle');
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
    setBlob(null);
    setPhase('idle');
    setElapsed(0);
    setDurationMs(0);
    setInfo('');
    setError('');
  }

  function skip() {
    if (!current || !language) return;
    const phraseId = current.id;
    setDraft((currentDraft) => ({
      ...currentDraft,
      skipped: {
        ...currentDraft.skipped,
        [language]: [...(currentDraft.skipped[language] ?? []), phraseId],
      },
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
      setDraft((currentDraft) => ({
        ...currentDraft,
        speakerCode:
          typeof data.speakerCode === 'string' && data.speakerCode
            ? data.speakerCode
            : currentDraft.speakerCode,
        sent: {
          ...currentDraft.sent,
          [language]: [...(currentDraft.sent[language] ?? []), phraseId],
        },
      }));
    } catch {
      setError('Pas de réseau. Réessayez.');
      setPhase('review');
    }
  }

  const total = phrases.length;
  const sentCount = sentIds.length;
  const prompt = current && language ? promptFor(current, language) : null;

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
          <h1>
            Phrase {Math.min(total, sentCount + skippedIds.length + 1)} sur {total}
          </h1>
          <p className="meta">{plural(sentCount, 'envoyée', 'envoyées')}</p>
          <div
            className="bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={sentCount}
            aria-label="Phrases envoyées"
          >
            <span style={{ width: `${total ? (sentCount / total) * 100 : 0}%` }} />
          </div>
          <p className="note">{prompt.hint}</p>
          <p className="sentence">{prompt.text}</p>
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
            {phase !== 'review' && phase !== 'sending' ? (
              <div className="stack">
                <button
                  type="button"
                  className="btn record-wide"
                  data-on={phase === 'recording' ? '1' : '0'}
                  onClick={() => (phase === 'recording' ? stopRecording() : void startRecording())}
                >
                  <span className="mark" aria-hidden="true" />
                  {phase === 'recording' ? 'Arrêter' : 'Enregistrer'}
                </button>
                <p className="timer">
                  {clock(phase === 'recording' ? elapsed : 0)} / 0:15
                </p>
              </div>
            ) : null}
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
              <>
                <p className="help">Écoutez avant d’envoyer.</p>
                {audioUrl ? (
                  <audio ref={audioRef} src={audioUrl} controls playsInline preload="auto" />
                ) : null}
                <button type="button" className="btn secondary" onClick={() => void audioRef.current?.play()}>
                  Écouter
                </button>
                <button type="submit" className="btn primary" disabled={phase === 'sending'}>
                  {phase === 'sending' ? 'Envoi en cours' : 'Envoyer'}
                </button>
                <button type="button" className="btn secondary" disabled={phase === 'sending'} onClick={rerecord}>
                  Recommencer
                </button>
              </>
            ) : null}
            <div aria-live="polite">
              {error ? (
                <p className="alert" role="alert">
                  {error}
                </p>
              ) : null}
              {info ? <p className="note">{info}</p> : null}
            </div>
            <button type="button" className="btn quiet" disabled={phase === 'recording' || phase === 'sending'} onClick={skip}>
              Passer
            </button>
          </form>
          <p className="help">Vous pouvez fermer la page. Rouvrez le même lien sur ce téléphone pour continuer.</p>
        </section>
      ) : null}

      {step === 'record' && language && !current ? (
        <section className="card stack">
          <h1>{skippedIds.length > 0 ? 'Phrases passées' : 'Merci'}</h1>
          {skippedIds.length > 0 ? (
            <>
              <p>
                Il reste {plural(skippedIds.length, 'phrase passée', 'phrases passées')}. Vous pouvez les reprendre.
              </p>
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    skipped: { ...currentDraft.skipped, [language]: [] },
                  }))
                }
              >
                Reprendre les phrases passées
              </button>
            </>
          ) : (
            <>
              <p>Vos phrases sont envoyées. L’équipe les écoute avant de les utiliser.</p>
              {draft.speakerCode ? (
                <p>
                  Votre code locuteur : <strong>{draft.speakerCode}</strong>. Gardez-le pour demander une
                  suppression, ou pour continuer plus tard.
                </p>
              ) : null}
            </>
          )}
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
