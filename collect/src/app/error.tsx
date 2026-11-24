'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="contenu" className="shell">
      <section className="card stack">
        <h1>Un problème est survenu</h1>
        <p>Rechargez la page. Si cela continue, réessayez dans quelques minutes.</p>
        <button type="button" className="btn primary" onClick={() => reset()}>
          Réessayer
        </button>
      </section>
    </main>
  );
}
