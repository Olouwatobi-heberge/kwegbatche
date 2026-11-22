// public/js/demo.js
(() => {
  /* ---------- État de Session & Contexte ---------- */
  let sessionId = sessionStorage.getItem("kwegbatche_session_id") || `sess_demo_${Date.now()}`;
  sessionStorage.setItem("kwegbatche_session_id", sessionId);

  let currentLang = "fon";
  let activePendingKey = null;

  /* ---------- Éléments DOM Principaux ---------- */
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

  /* ---------- Initialisation de la Session & Solde ---------- */
  async function initSession() {
    if (elLangBadge) elLangBadge.textContent = currentLang.toUpperCase();
    await updateWalletSummary();
  }

  /* ---------- Client HTTP Centralisé (avec X-Session-Id & TraceId) ---------- */
  async function apiCall(endpoint, options = {}) {
    const t0 = performance.now();
    const isFormData = options.body instanceof FormData;

    const headers = {
      Accept: "application/json",
      "X-Session-Id": sessionId,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(endpoint, { ...options, headers });
      const totalMs = Math.round(performance.now() - t0);

      // Traitement spécial si retour binaire audio (TTS)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("audio/")) {
        const blob = await res.blob();
        return { isAudioBlob: true, blob, totalMs };
      }

      const data = await res.json().catch(() => ({}));
      renderResponse(data, totalMs, res.status);
      return data;
    } catch (err) {
      const totalMs = Math.round(performance.now() - t0);
      renderResponse({ error: { message: String(err) } }, totalMs, 500);
    }
  }

  /* ---------- Mise à jour du Solde Contextuel (Mama Rosine) ---------- */
  async function updateWalletSummary() {
    try {
      const res = await fetch("/api/v1/wallet/summary", {
        headers: { "X-Session-Id": sessionId }
      });
      if (res.ok) {
        const wallet = await res.json();
        if (elBalance && wallet.balance !== undefined) {
          elBalance.textContent = `${wallet.balance.toLocaleString()} ${wallet.currency || "XOF"}`;
        }
      }
    } catch (e) {
      console.warn("Échec actualisation solde:", e.message);
    }
  }

  /* ---------- Rendu Visuel, Inspecteur JSON & Latences ---------- */
  function renderResponse(data, totalMs, httpStatus = 200) {
    // 1. Affichage JSON structuré dans l'inspecteur
    if (outJson) {
      outJson.textContent = JSON.stringify(data, null, 2);
    }

    // 2. Décomposition de la Latence (ENF-01 / §6.1)
    if (latContainer) {
      const l = data.latencies || data.latency_ms || {};
      const asr = l.asrMs || l.asr_ms || 0;
      const nlu = l.nluMs || l.nlu_ms || 0;
      const tts = l.ttsMs || l.tts_ms || 0;
      const isBudgetOk = totalMs <= 5000;

      latContainer.innerHTML = `
        <span class="muted small">ASR: ${asr}ms | NLU: ${nlu}ms | TTS: ${tts}ms</span>
        <span class="latency-badge ${getLatencyClass(totalMs)}">${totalMs} ms</span>
      `;
    }

    // 3. Mise à jour du badge d'état conversationnel
    const state = data.state || data.nextState || data.dialogState || (data.result?.turn?.nextState) || "IDLE";
    if (elState) {
      elState.textContent = state;
      elState.className = `state-badge state-${state.toLowerCase()}`;
    }

    // 4. Gestion de la clé d'idempotence et des boutons d'action
    const op = data.preparedOperation || data.operation || data.result?.turn?.preparedOperation;
    if (op?.idempotencyKey || op?.idempotency_key) {
      activePendingKey = op.idempotencyKey || op.idempotency_key;
      if (elKey) elKey.textContent = activePendingKey.slice(0, 8) + "...";
      if (btnConfirm) btnConfirm.disabled = false;
      if (btnCancel) btnCancel.disabled = false;
      if (btnDouble) btnDouble.disabled = false;
    } else if (state === "IDLE" || state === "COMPLETED") {
      activePendingKey = null;
      if (elKey) elKey.textContent = "Aucune";
      if (btnConfirm) btnConfirm.disabled = true;
      if (btnCancel) btnCancel.disabled = true;
      if (btnDouble) btnDouble.disabled = true;
      updateWalletSummary();
    }

    // 5. Lecture Vocale Automatique (TTS)
    const replyMsg = data.message || data.replyMessage || data.result?.turn?.message;
    if (replyMsg && replyAudio) {
      synthesizeAndPlay(replyMsg, currentLang, replyAudio);
    }

    // 6. Rendu de la Carte Mobile Virtuelle
    const warnings = data.warnings || data.alerts || data.result?.turn?.warnings || [];
    renderMobileCard({
      state,
      message: replyMsg || data.explanation || "Action exécutée.",
      operation: op,
      warnings,
      explanation: data.result?.explanation || null
    });
  }

  function getLatencyClass(ms) {
    return ms < 1500 ? "fast" : ms <= 5000 ? "mid" : "slow";
  }

  /* ---------- Synthèse Vocale et Lecture Audio ---------- */
  async function synthesizeAndPlay(text, lang, audioElement) {
    if (!text || !audioElement) return;
    try {
      const res = await fetch("/api/v1/audio/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang })
      });
      if (res.ok) {
        const blob = await res.blob();
        audioElement.src = URL.createObjectURL(blob);
        audioElement.style.display = "block";
        audioElement.play().catch(() => {}); // Évite l'erreur autoplay bloqué
      }
    } catch (e) {
      console.warn("TTS non joué:", e.message);
    }
  }

  /* ---------- Rendu de l'Écran Mobile Simulé (EF-10, ENF-06) ---------- */
  function renderMobileCard({ state, message, operation, warnings = [], explanation = null }) {
    if (!visualCard) return;

    // A. Alertes Anti-Fraude (AR-01 à AR-05)
    let alertHtml = "";
    if (warnings.length > 0) {
      alertHtml = warnings.map(w => `
        <div class="card-alert alert-${w.severity || 'warning'}">
          🛡️ <strong>${w.rule}</strong> : ${w.code || w.messageKey}
        </div>
      `).join("");
    }

    // B. Corps du message
    let bodyContent = "";

    if (state === "AWAITING_TRANSFER_CONFIRMATION" || operation) {
      const amt = operation?.amount || 0;
      const rec = operation?.recipient?.name || operation?.recipient_name || "Destinataire";
      const fee = operation?.fee || 0;

      bodyContent = `
        <div class="card-title text-warning">⚠️ Confirmer le transfert</div>
        <div class="card-headline text-warning">${amt.toLocaleString()} XOF</div>
        <p class="small muted">Destinataire : <strong>${rec}</strong> (Frais : ${fee} F)</p>
        <p class="small">${message}</p>
        <div class="card-actions mt-2">
          <button class="btn btn-success small" onclick="window.triggerConfirm()">✅ OUI, ENVOYER</button>
          <button class="btn btn-danger small" onclick="window.triggerCancel()">❌ ANNULER</button>
        </div>
      `;
    } else if (state === "COMPLETED") {
      bodyContent = `
        <div class="card-title text-success">✅ Transfert Réussi</div>
        <p class="small text-success">${message}</p>
        <p class="small muted">Votre solde a été mis à jour.</p>
      `;
    } else if (state === "CANCELLED") {
      bodyContent = `
        <div class="card-title text-danger">❌ Opération Annulée</div>
        <p class="small muted">${message}</p>
      `;
    } else {
      bodyContent = `
        <div class="card-title">KwèGbaTché Voice</div>
        <p class="small">${message}</p>
        ${explanation ? `<div class="card-explanation small muted">💡 ${explanation}</div>` : ""}
      `;
    }

    visualCard.innerHTML = alertHtml + bodyContent;
  }

  /* ---------- Gestion des Onglets & Sélecteur de Langue ---------- */
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentLang = btn.dataset.lang || "fon";
      if (elLangBadge) elLangBadge.textContent = currentLang.toUpperCase();
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const targetPanel = document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`);
      if (targetPanel) targetPanel.classList.add("active");
    });
  });

  /* ---------- Déclencheurs Globaux d'Actions ---------- */
  window.triggerConfirm = () => calls["transfer-confirm"]();
  window.triggerCancel = () => calls["transfer-cancel"]();

  /* ---------- Table de Routage des Appels Démo ---------- */
  const calls = {
    // 1. Calculateur de Frais (EF-12)
    async fees() {
      const raw = document.getElementById("fees-text")?.value || "5000";
      const amount = parseInt(raw.replace(/\D/g, ""), 10) || 5000;
      await apiCall(`/api/v1/wallet/fees?amount=${amount}`, { method: "GET" });
    },

    // 2. Solde & Budget
    async balance() {
      await apiCall("/api/v1/dialog/turns", {
        method: "POST",
        body: JSON.stringify({
          intent: "consulter_solde",
          confidence: 0.98,
          lang: currentLang
        })
      });
    },

    async budget() {
      await apiCall("/api/v1/wallet/summary", { method: "GET" });
    },

    // 3. Préparation Transfert (O4 / CA-2)
    async "transfer-prep"() {
      const recipient = document.getElementById("tr-dest")?.value || "Koffi";
      const amount = Number(document.getElementById("tr-amount")?.value) || 5000;

      await apiCall("/api/v1/dialog/turns", {
        method: "POST",
        body: JSON.stringify({
          intent: "transferer",
          confidence: 0.95,
          slots: { recipient, amount },
          lang: currentLang
        })
      });
    },

    // 4. Confirmation explicite
    async "transfer-confirm"() {
      await apiCall("/api/v1/dialog/confirm", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: activePendingKey })
      });
    },

    // 5. Annulation explicite
    async "transfer-cancel"() {
      await apiCall("/api/v1/dialog/cancel", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: activePendingKey })
      });
    },

    // 6. Crash-Test Double Clic Simultané (EF-21 Idempotence)
    async "transfer-double-click"() {
      if (!activePendingKey) {
        // Si aucune clé en cours, on prépare d'abord un transfert rapide
        await calls["transfer-prep"]();
      }

      if (activePendingKey) {
        // Envoi de DEUX requêtes strictement simultanées avec la même clé
        const req1 = apiCall("/api/v1/dialog/confirm", {
          method: "POST",
          body: JSON.stringify({ idempotencyKey: activePendingKey })
        });
        const req2 = apiCall("/api/v1/dialog/confirm", {
          method: "POST",
          body: JSON.stringify({ idempotencyKey: activePendingKey })
        });

        await Promise.all([req1, req2]);
      }
    },

    // 7. Test Synthèse Vocale (TTS)
    async tts() {
      const text = document.getElementById("tts-text")?.value || "Akwé tché gankpwe afɔtɔn";
      const audioOut = document.getElementById("tts-out");
      if (audioOut) {
        await synthesizeAndPlay(text, currentLang, audioOut);
      }
    }
  };

  document.querySelectorAll("[data-call]").forEach((btn) => {
    btn.addEventListener("click", () => calls[btn.dataset.call]?.());
  });

  /* ---------- Boutons Anti-Fraude (AR-01 à AR-05) ---------- */
  const arScenarioMap = {
    "AR-01": "AR_01_NEW_CONTACT",
    "AR-02": "AR_02_HIGH_AMOUNT",
    "AR-03": "AR_03_INSUFFICIENT_BALANCE",
    "AR-04": "AR_04_URGENCY",
    "AR-05": "AR_05_PIN_REQUEST"
  };

  document.querySelectorAll("[data-ar]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ruleKey = btn.dataset.ar;
      const scenarioId = arScenarioMap[ruleKey] || ruleKey;

      await apiCall("/api/v1/demo/scenario", {
        method: "POST",
        body: JSON.stringify({ scenarioId, lang: currentLang })
      });
    });
  });

  /* ---------- Réinitialisation Usine de la Base SQLite ---------- */
  const resetBtn = document.getElementById("btn-reset-demo");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("Réinitialiser le portefeuille fictif de Mama Rosine (42 500 XOF) ?")) {
        await apiCall("/api/v1/demo/reset", { method: "POST" });
        await updateWalletSummary();
      }
    });
  }

  /* ---------- Capture Audio Microphone (Pipeline ASR -> NLU -> TTS) ---------- */
  const recStart = document.getElementById("rec-start");
  const recStop = document.getElementById("rec-stop");
  const preview = document.getElementById("asr-preview");
  let recorder = null;
  let chunks = [];

  if (recStart && recStop) {
    recStart.addEventListener("click", async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        chunks = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: "audio/wav" });
          if (preview) {
            preview.src = URL.createObjectURL(blob);
            preview.style.display = "block";
          }

          const form = new FormData();
          form.append("audio", blob, "recording.wav");
          form.append("lang", currentLang);

          await apiCall("/api/v1/audio/pipeline", {
            method: "POST",
            body: form
          });
        };

        recorder.start();
        recStart.disabled = true;
        recStop.disabled = false;
      } catch (e) {
        alert("Microphone inaccessible : " + e.message);
      }
    });

    recStop.addEventListener("click", () => {
      recorder?.stop();
      recStart.disabled = false;
      recStop.disabled = true;
    });
  }

  /* ---------- Envoi Fichier Audio Pré-enregistré ---------- */
  const asrFileInput = document.getElementById("asr-file");
  if (asrFileInput) {
    asrFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const form = new FormData();
      form.append("audio", file);
      form.append("lang", currentLang);

      await apiCall("/api/v1/audio/pipeline", {
        method: "POST",
        body: form
      });
    });
  }

  /* ---------- Démarrage Initial ---------- */
  initSession();
})();