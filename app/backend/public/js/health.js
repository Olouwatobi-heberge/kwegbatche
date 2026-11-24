(function () {
  let countdown = 10;
  const timerEl = document.getElementById('refresh-timer');

  // Compteur visuel
  setInterval(() => {
    countdown--;
    if (countdown <= 0) countdown = 10;
    if (timerEl) timerEl.textContent = `${countdown}s`;
  }, 1000);

  // Requête asynchrone toutes les 10 secondes
  async function refreshHealth() {
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) return;
      const data = await res.json();

      const grid = document.getElementById('services-grid');
      const globalBadge = document.getElementById('global-status');

      if (globalBadge) {
        const isAllUp = data.status === 'ok' || data.status === 'UP';
        globalBadge.className = `status-badge ${isAllUp ? 'up' : 'down'}`;
        globalBadge.innerHTML = `
          <span class="status-dot"></span>
          <span class="status-label">${isAllUp ? 'Système Opérationnel' : 'Dégradé'}</span>
        `;
      }

      if (grid && data.services) {
        const serviceDetails = {
          asr: { label: 'ASR (Reconnaissance Vocale)', desc: 'Whisper / MMS fine-tuné (Fon / Yor / Fr)' },
          nlu: { label: 'NLU (Compréhension)', desc: 'Classifieur d\'intentions & extraction d\'entités' },
          tts: { label: 'TTS (Synthèse Vocale)', desc: 'VITS / MMS-TTS voix naturelles' },
          database: { label: 'Base de Données SQLite', desc: 'Transactions atomiques WAL & Idempotence EF-21' }
        };

        grid.innerHTML = Object.entries(data.services).map(([name, status]) => {
          const isUp = String(status).toLowerCase() === 'up' || status === 'ok';
          const meta = serviceDetails[name.toLowerCase()] || { label: name.toUpperCase(), desc: 'Composant système' };
          return `
            <div class="service-card ${isUp ? 'status-ok' : 'status-err'}">
              <div class="service-card-header">
                <div class="service-meta">
                  <span class="service-name">${meta.label}</span>
                  <span class="service-desc">${meta.desc}</span>
                </div>
                <span class="status-pill ${isUp ? 'up' : 'down'}">
                  <span class="status-dot"></span> ${isUp ? 'UP' : 'DOWN'}
                </span>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('Erreur rafraîchissement santé:', err);
    }
  }

  setInterval(refreshHealth, 10000);
})();