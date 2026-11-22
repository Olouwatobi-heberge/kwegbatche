'use client';

import { useMemo, useState } from 'react';
import { intentLabel, LANGUAGE_LABELS } from '@/lib/labels';
import type { Language, Recording, RecordingStatus, Stats } from '@/lib/types';
import { LANGUAGES } from '@/lib/types';

const CLIENT = { 'X-Kwegbatche-Client': 'web' };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatSeconds(ms: number): string {
  const value = Math.round(ms / 100) / 10;
  return `${String(value).replace('.', ',')} s`;
}

function emptyStats(): Stats {
  return {
    total: 0,
    byLanguage: {
      fon: { pending: 0, keep: 0, reject: 0, total: 0 },
      yoruba: { pending: 0, keep: 0, reject: 0, total: 0 },
      fr: { pending: 0, keep: 0, reject: 0, total: 0 },
    },
    bySpeaker: [],
  };
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState('');
  const [status, setStatus] = useState('pending');
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [pendingId, setPendingId] = useState('');

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (language) params.set('language', language);
    const query = params.toString();
    return query ? `&${query}` : '';
  }, [language]);

  async function load(nextLanguage = language, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextLanguage) params.set('language', nextLanguage);
    if (nextStatus) params.set('status', nextStatus);
    const response = await fetch(`/api/admin/recordings?${params.toString()}`, { headers: CLIENT });
    if (response.status === 401) {
      setAuthed(false);
      setError('Session terminée. Entrez le code à nouveau.');
      return;
    }
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      recordings?: Recording[];
      stats?: Stats;
    };
    if (!response.ok) {
      setError(data.error || 'Lecture impossible.');
      return;
    }
    setRecordings(data.recordings ?? []);
    setStats(data.stats ?? emptyStats());
    setError('');
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...CLIENT },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || 'Code incorrect.');
        return;
      }
      setAuthed(true);
      setCode('');
      await load();
    } catch {
      setError('Pas de réseau.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST', headers: CLIENT });
    setAuthed(false);
    setRecordings([]);
  }

  async function mark(rec: Recording, next: RecordingStatus) {
    if (pendingId) return;
    setPendingId(rec.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/recordings/${rec.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...CLIENT },
        body: JSON.stringify({ status: next }),
      });
      if (response.status === 401) {
        setAuthed(false);
        setError('Session terminée. Entrez le code à nouveau.');
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || 'Mise à jour impossible.');
        return;
      }
      await load();
    } catch {
      setError('Pas de réseau.');
    } finally {
      setPendingId('');
    }
  }

  function onPlay(event: React.SyntheticEvent<HTMLAudioElement>) {
    document.querySelectorAll('audio').forEach((element) => {
      if (element !== event.currentTarget) element.pause();
    });
  }

  if (!authed) {
    return (
      <section className="card stack" style={{ maxWidth: '28rem' }}>
        <h1>Validation</h1>
        <p>Réservé à l’équipe. Les contributeurs n’ont pas besoin de ce code.</p>
        <form className="stack" onSubmit={(event) => void login(event)}>
          <label className="field">
            Code équipe
            <input
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn primary" disabled={busy || code.trim().length === 0}>
            Entrer
          </button>
        </form>
        <a className="footer-link" href="/">
          Retour à la collecte
        </a>
      </section>
    );
  }

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>Validation</h1>
        <div className="btn-row tight">
          <button type="button" className="btn secondary" onClick={() => void load()}>
            Actualiser
          </button>
          <button type="button" className="btn secondary" onClick={() => void logout()}>
            Quitter
          </button>
        </div>
      </div>

      <section className="stats">
        {LANGUAGES.map((lang) => {
          const bucket = stats.byLanguage[lang];
          return (
            <article className="stat" key={lang}>
              <h2>{LANGUAGE_LABELS[lang]}</h2>
              <p>{plural(bucket.total, 'piste', 'pistes')}</p>
              <p className="meta">
                {plural(bucket.pending, 'à écouter', 'à écouter')}, {plural(bucket.keep, 'gardée', 'gardées')},{' '}
                {plural(bucket.reject, 'rejetée', 'rejetées')}
              </p>
            </article>
          );
        })}
      </section>

      <section className="stack">
        <h2>Par locuteur</h2>
        {stats.bySpeaker.length === 0 ? (
          <p className="meta">Aucun enregistrement pour le moment.</p>
        ) : (
          <div className="speaker-list">
            {stats.bySpeaker.slice(0, 40).map((speaker) => (
              <article className="speaker" key={speaker.speakerCode}>
                <p>
                  <strong>{speaker.speakerCode}</strong>
                </p>
                <p className="meta">
                  {plural(speaker.total, 'piste', 'pistes')}, {plural(speaker.keep, 'gardée', 'gardées')},{' '}
                  {speaker.languages.map((lang) => LANGUAGE_LABELS[lang as Language] ?? lang).join(', ')}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="field">
          Langue
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="">Toutes</option>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Statut
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="pending">À écouter</option>
            <option value="keep">Gardées</option>
            <option value="reject">Rejetées</option>
            <option value="">Toutes</option>
          </select>
        </label>
        <button type="submit" className="btn primary">
          Filtrer
        </button>
      </form>

      <section className="stack">
        <h2>Exporter les pistes gardées</h2>
        <p className="meta">
          L’export ignore les pistes en attente et les pistes rejetées.
          {language ? ` Langue : ${LANGUAGE_LABELS[language as Language]}.` : ' Toutes les langues.'}
        </p>
        <div className="btn-row">
          <a className="btn secondary" href={`/api/admin/export?format=csv${exportQuery}`}>
            Télécharger le CSV
          </a>
          <a className="btn secondary" href={`/api/admin/export?format=jsonl${exportQuery}`}>
            Télécharger le JSONL
          </a>
          <a className="btn secondary" href={`/api/admin/export?format=zip${exportQuery}`}>
            Télécharger le ZIP
          </a>
        </div>
      </section>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rec-list">
        {recordings.length === 0 ? <p className="meta">Aucune piste pour ce filtre.</p> : null}
        {recordings.map((rec) => (
          <article className="rec-card" key={rec.id}>
            <div>
              <p className="sentence">{rec.sentence}</p>
              <p className="meta">
                {LANGUAGE_LABELS[rec.language]}, {intentLabel(rec.intent)}, {rec.speakerCode},{' '}
                {formatSeconds(rec.durationMs)}, {formatWhen(rec.createdAt)}
              </p>
              {rec.fallbackFr ? <p className="badge">Dit d’après le français</p> : null}
              {rec.gender || rec.ageRange ? (
                <p className="meta">{[rec.gender, rec.ageRange].filter(Boolean).join(', ')}</p>
              ) : null}
            </div>
            <div className="stack">
              <audio
                controls
                playsInline
                preload="none"
                src={`/api/admin/audio/${rec.id}`}
                onPlay={onPlay}
              />
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  disabled={pendingId === rec.id || rec.status === 'keep'}
                  onClick={() => void mark(rec, 'keep')}
                >
                  Garder
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={pendingId === rec.id || rec.status === 'reject'}
                  onClick={() => void mark(rec, 'reject')}
                >
                  Rejeter
                </button>
              </div>
              {rec.status !== 'pending' ? (
                <button
                  type="button"
                  className="btn quiet"
                  disabled={pendingId === rec.id}
                  onClick={() => void mark(rec, 'pending')}
                >
                  Remettre en attente
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
