export default function NotFound() {
  return (
    <main id="contenu" className="shell">
      <section className="card stack">
        <h1>Page introuvable</h1>
        <p>Ce lien ne correspond à aucune page.</p>
        <a className="btn primary" href="/">
          Retour à l’accueil
        </a>
      </section>
    </main>
  );
}
