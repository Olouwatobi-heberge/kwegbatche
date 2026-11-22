(function () {
  const grid = document.getElementById('services-grid');
  const globalPill = document.getElementById('global-status');
  if (!grid || !globalPill) return;

  async function refresh() {
    try {
      const res = await fetch('/api/v1/health', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json();

      // Reconstruit les cartes
      grid.innerHTML = Object.entries(data.services || {})
        .map(([name, status]) => `
          <div class="service-card">
            <div class="service-name">${name.toUpperCase()}</div>
            <span class="status-pill ${status === 'up' ? 'up' : 'down'}">
              <span class="status-dot"></span> ${status}
            </span>
          </div>
        `).join('');

      // Statut global
      const allUp = Object.values(data.services || {}).every(s => s === 'up');
      globalPill.className = 'status-pill ' + (allUp ? 'up' : 'down');
      globalPill.innerHTML = `<span class="status-dot"></span> ${allUp ? 'opérationnel' : 'dégradé'}`;
    } catch {
      globalPill.className = 'status-pill down';
      globalPill.innerHTML = `<span class="status-dot"></span> hors ligne`;
    }
  }

  refresh();
  setInterval(refresh, 10_000);
})();