(() => {
  /* ---------- État de Session ---------- */
  let sessionId = sessionStorage.getItem("kwegbatche_session_id") || null;
  let currentLang = "fr";
  let activePendingKey = null;

  /* ---------- Éléments DOM ---------- */
  const outJson = document.getElementById("response-json");
  const latBadge = document.getElementById("latency-badge");
  const latContainer = document.getElementById("latency-breakdown");
  const visualCard = document.getElementById("visual-card");
  const replyAudio = document.getElementById("reply-audio-player");

  const elBalance = document.getElementById("context-balance");
  const elState = document.getElementById("context-state");
  const elKey = document.getElementById("context-key");
  const elLangBadge = document.getElementById("sim-lang-badge");

  const btnConfirm = document.getElementById("btn-confirm-op");
  const btnCancel = document.getElementById("btn-cancel-op");
  const btnDouble = document.getElementById("btn-idempotency-test");

  /* ---------- Initialisation de la Session (EF-01) ---------- */
  async function initSession() {
    if (sessionId) {
      updateWalletSummary();
      return;
    }
    try {
      const res = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: currentLang }),
      });
      const data = await res.json();
      if (data.session_id) {
        sessionId = data.session_id;
        sessionStorage.setItem("kwegbatche_session_id", sessionId);
      }
    } catch (e) {
      console.error("Erreur création session:", e);
    }
    updateWalletSummary();
  }

  /* ---------- Appels API Centralisés ---------- */
  async function apiCall(endpoint, options = {}) {
    const t0 = performance.now();
    const headers = {
      Accept: "application/json",
      ...(sessionId ? { "X-Session-Id": sessionId } : {}),
      ...(options.headers || {}),
    };

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const res = await fetch(endpoint, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      const totalMs = Math.round(performance.now() - t0);

      renderResponse(data, totalMs);
      return data;
    } catch (err) {
      const totalMs = Math.round(performance.now() - t0);
      renderResponse({ error: { message: String(err) } }, totalMs);
    }
  }

  /* ---------- Mise à jour Solde Contextuel ---------- */
  async function updateWalletSummary() {
    if (!sessionId) return;
    const res = await fetch("/api/v1/wallet/summary", {
      headers: { "X-Session-Id": sessionId },
    });
    if (res.ok) {
      const wallet = await res.json();
      if (wallet.balance !== undefined) {
        elBalance.textContent = `${wallet.balance.toLocaleString()} ${wallet.currency}`;
      }
    }
  }

  /* ---------- Rendu Visuel & Inspecteur JSON ---------- */
  function renderResponse(data, totalMs) {
    // 1. Affichage JSON
    outJson.textContent = JSON.stringify(data, null, 2);

    // 2. Latence décomposée (§6.1)
    if (data.latency_ms) {
      const l = data.latency_ms;
      latContainer.innerHTML = `
        <span class="muted small">ASR: ${l.asr_ms || 0}ms | NLU: ${l.nlu_ms || 0}ms | Back: ${l.backend_ms || 0}ms | TTS: ${l.tts_ms || 0}ms</span>
        <span class="latency-badge ${getLatencyClass(l.total_ms || totalMs)}">${l.total_ms || totalMs} ms</span>
      `;
    } else {
      latContainer.innerHTML = `<span class="latency-badge ${getLatencyClass(totalMs)}">${totalMs} ms</span>`;
    }

    // 3. Mise à jour de l'état contextuel
    if (data.state) {
      elState.textContent = data.state;
      elState.className = `state-badge state-${data.state.toLowerCase()}`;
    }

    if (data.operation?.idempotency_key) {
      activePendingKey = data.operation.idempotency_key;
      elKey.textContent = activePendingKey.slice(0, 8) + "...";
      btnConfirm.disabled = false;
      btnCancel.disabled = false;
      btnDouble.disabled = false;
    } else if (data.state === "IDLE") {
      activePendingKey = null;
      elKey.textContent = "Aucune";
      btnConfirm.disabled = true;
      btnCancel.disabled = true;
      btnDouble.disabled = true;
      updateWalletSummary();
    }

    // 4. Lecture audio TTS automatique si présent
    if (data.reply?.audio_url) {
      replyAudio.src = data.reply.audio_url;
      replyAudio.style.display = "block";
      replyAudio.play().catch(() => {});
    } else {
      replyAudio.style.display = "none";
    }

    // 5. Rendu de la carte mobile (EF-10, ENF-06)
    if (data.visual) {
      renderMobileCard(data.visual, data.reply?.text, data.alerts);
    }
  }

  function getLatencyClass(ms) {
    return ms < 1500 ? "fast" : ms < 5000 ? "mid" : "slow";
  }

  /* ---------- Rendu de l'Écran Mobile Simulée ---------- */
  function renderMobileCard(visual, replyText, alerts = []) {
    let alertHtml = "";
    if (alerts && alerts.length > 0) {
      alertHtml = alerts
        .map(
          (a) => `
        <div class="card-alert alert-${a.severity}">
          🚨 <strong>${a.rule}</strong> : ${a.message_key}
        </div>
      `,
        )
        .join("");
    }

    let bodyContent = "";
    switch (visual.type) {
      case "transfer_recap":
        bodyContent = `
          <div class="card-title">Confirmer le transfert</div>
          <div class="card-headline text-warning">${visual.headline || ""}</div>
          <p class="small muted">Envoyé à <strong>${visual.recipient || ""}</strong> (Frais: ${visual.fee || 0} F)</p>
          <div class="card-actions">
            <button class="btn btn-success small" onclick="window.triggerConfirm()">✅ OUI</button>
            <button class="btn btn-danger small" onclick="window.triggerCancel()">❌ NON</button>
          </div>
        `;
        break;

      case "transfer_receipt":
        bodyContent = `
          <div class="card-title text-success">✅ Transfert Réussi</div>
          <div class="card-headline text-success">${visual.headline || ""}</div>
          <p class="small muted">Opération exécutée avec succès.</p>
        `;
        break;

      case "transfer_cancelled":
        bodyContent = `
          <div class="card-title text-danger">❌ Opération Annulée</div>
          <div class="card-headline text-danger">${visual.headline || ""}</div>
          <p class="small muted">Aucun montant n'a été débité.</p>
        `;
        break;

      case "balance":
      case "budget":
      case "fees":
        bodyContent = `
          <div class="card-title">${visual.type.toUpperCase()}</div>
          <div class="card-headline text-primary">${visual.headline || ""}</div>
          <p class="small muted">${replyText || ""}</p>
        `;
        break;

      default:
        bodyContent = `
          <div class="card-title">Assistant</div>
          <p class="small">${replyText || "Réponse reçue"}</p>
        `;
    }

    visualCard.innerHTML = alertHtml + bodyContent;
  }

  /* ---------- Gestion des Onglets & Langue ---------- */
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      document
        .querySelectorAll(".lang-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentLang = btn.dataset.lang;
      elLangBadge.textContent = currentLang.toUpperCase();

      if (sessionId) {
        await apiCall(`/api/v1/sessions/${sessionId}/language`, {
          method: "PATCH",
          body: JSON.stringify({ language: currentLang }),
        });
      }
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".panel")
        .forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document
        .querySelector(`.panel[data-panel="${tab.dataset.tab}"]`)
        .classList.add("active");
    });
  });

  /* ---------- Handlers des Actions de Démo ---------- */
  window.triggerConfirm = () => calls["transfer-confirm"]();
  window.triggerCancel = () => calls["transfer-cancel"]();

  const calls = {
    async fees() {
      const text = document.getElementById("fees-text").value;
      // Simulation d'un tour vocal par texte
      await apiCall(`/api/v1/wallet/fees?amount=${encodeURIComponent(text)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
    },

    async balance() {
      await apiCall("/api/v1/wallet/summary", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
    },

    async budget() {
      await apiCall("/api/v1/wallet/budget-week", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
    },

    async "transfer-prep"() {
      const recipient = document.getElementById("tr-dest").value;
      const amount = Number(document.getElementById("tr-amount").value);
      await apiCall("/api/v1/dialog/turns", {
        method: "POST",
        body: JSON.stringify({
          simulated_intent: "preparer_transfert",
          entities: { recipient_name: recipient, amount },
        }),
      });
    },

    async "transfer-confirm"() {
      if (!activePendingKey) return;
      await apiCall("/api/v1/dialog/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "confirm",
          idempotency_key: activePendingKey,
        }),
      });
    },

    async "transfer-cancel"() {
      if (!activePendingKey) return;
      await apiCall("/api/v1/dialog/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "cancel",
          idempotency_key: activePendingKey,
        }),
      });
    },

    async "transfer-double-click"() {
      if (!activePendingKey) return;
      // Déclenche DEUX requêtes simultanées pour prouver l'idempotence SQL (EF-21)
      const p1 = apiCall("/api/v1/dialog/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "confirm",
          idempotency_key: activePendingKey,
        }),
      });
      const p2 = apiCall("/api/v1/dialog/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "confirm",
          idempotency_key: activePendingKey,
        }),
      });
      await Promise.all([p1, p2]);
    },

    async tts() {
      const text = document.getElementById("tts-text").value;
      const audio = document.getElementById("tts-out");
      const data = await apiCall(`/api/v1/audio/generate`, {
        method: "POST",
        body: JSON.stringify({ text, lang: currentLang }),
      });
      if (data?.audio_url) {
        audio.src = data.audio_url;
        audio.style.display = "block";
        audio.play().catch(() => {});
      }
    },
  };

  document.querySelectorAll("[data-call]").forEach((btn) => {
    btn.addEventListener("click", () => calls[btn.dataset.call]?.());
  });

  // Boutons Anti-Arnaque
  document.querySelectorAll("[data-ar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const rule = btn.dataset.ar;
      await apiCall("/api/v1/dialog/turns", {
        method: "POST",
        body: JSON.stringify({ simulated_antifraud_trigger: rule }),
      });
    });
  });

  // Reset BDD (EF-15)
  document
    .getElementById("btn-reset-demo")
    .addEventListener("click", async () => {
      if (confirm("Réinitialiser le portefeuille fictif ?")) {
        await apiCall("/api/v1/demo/reset", { method: "POST" });
        updateWalletSummary();
      }
    });

  /* ---------- Capture Audio Micro (ASR Pipeline) ---------- */
  const recStart = document.getElementById("rec-start");
  const recStop = document.getElementById("rec-stop");
  const preview = document.getElementById("asr-preview");
  let recorder,
    chunks = [];

  recStart.addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        preview.src = URL.createObjectURL(blob);
        preview.style.display = "block";

        const form = new FormData();
        form.append("audio", blob, "recording.webm");

        await apiCall("/api/v1/dialog/turns", {
          method: "POST",
          body: form,
        });
      };
      recorder.start();
      recStart.disabled = true;
      recStop.disabled = false;
    } catch (e) {
      alert("Micro inaccessible : " + e.message);
    }
  });

  recStop.addEventListener("click", () => {
    recorder?.stop();
    recStart.disabled = false;
    recStop.disabled = true;
  });

  /* ---------- Envoi Fichier Audio ---------- */
  document.getElementById("asr-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append("audio", file);
    await apiCall("/api/v1/dialog/turns", {
      method: "POST",
      body: form,
    });
  });

  // Lancement
  initSession();
})();
