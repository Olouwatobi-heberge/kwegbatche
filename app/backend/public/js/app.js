/**
 * KwèGbaTché — Contrôleur Frontend Mobile
 * Session Unifiée, Jauge Budget Fiable & Confirmation Sécurisée
 */

(function () {
  'use strict';

  // 1. Session persistante et unique
  let sessionId = sessionStorage.getItem('kwegbatche_session_id') || localStorage.getItem('kwegbatche_session_id');
  if (!sessionId) {
    sessionId = `sess_user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }
  sessionStorage.setItem('kwegbatche_session_id', sessionId);
  localStorage.setItem('kwegbatche_session_id', sessionId);

  let currentLang = 'fon';
  let activePendingKey = null;
  let isRecording = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let speechRecognition = null;
  let lastAudioElement = null;
  let isProcessing = false;

  // Éléments DOM
  const langSelect = document.getElementById('langSelect');
  const engineBadge = document.getElementById('engineBadge');
  const engineBadgeText = document.getElementById('engineBadgeText');
  const balanceValue = document.getElementById('balanceValue');
  const budgetRemainingValue = document.getElementById('budgetRemainingValue');
  const budgetProgress = document.getElementById('budgetProgress');
  const conversationFeed = document.getElementById('conversationFeed');
  const confirmationCard = document.getElementById('confirmationCard');
  const confDetailsText = document.getElementById('confDetailsText');
  const fraudAlertBox = document.getElementById('fraudAlertBox');
  const fraudAlertText = document.getElementById('fraudAlertText');
  const btnConfirmTransfer = document.getElementById('btnConfirmTransfer');
  const btnCancelTransfer = document.getElementById('btnCancelTransfer');
  const liveTranscript = document.getElementById('liveTranscript');
  const mainMicBtn = document.getElementById('mainMicBtn');
  const micStatusLabel = document.getElementById('micStatusLabel');
  const micIcon = document.getElementById('micIcon');
  const micSpinner = document.getElementById('micSpinner');
  const sessionTag = document.getElementById('sessionTag');
  const latencyTag = document.getElementById('latencyTag');
  const toggleBalanceBtn = document.getElementById('toggleBalanceBtn');

  if (sessionTag) sessionTag.textContent = sessionId.slice(0, 11) + '...';

  // 2. Reconnaissance Vocale Navigateur (Web Speech API)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;

    speechRecognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      if (liveTranscript) liveTranscript.textContent = transcript;
    };
  }

  // 3. Client HTTP Centralisé (avec session systématique)
  async function apiCall(endpoint, options = {}) {
    const t0 = performance.now();
    const isFormData = options.body instanceof FormData;

    const headers = {
      Accept: 'application/json',
      'X-Session-Id': sessionId,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(endpoint, { ...options, headers });
      const totalMs = Math.round(performance.now() - t0);
      if (latencyTag) latencyTag.textContent = `${totalMs} ms`;

      const data = await res.json().catch(() => ({}));
      data._totalMs = totalMs;
      data._httpStatus = res.status;
      return data;
    } catch (err) {
      console.error('Erreur API:', err);
      return { error: { message: String(err) } };
    }
  }

  // 4. Actualisation Solde & Jauge Budget
  async function refreshWallet() {
    try {
      const data = await apiCall('/api/v1/wallet/summary', { method: 'GET' });
      const wallet = data.wallet || data;

      if (wallet && wallet.balance !== undefined) {
        if (balanceValue) balanceValue.textContent = Number(wallet.balance).toLocaleString('fr-FR');

        const b = wallet.budget || {};
        const limit = Number(b.limit || wallet.budgetLimit || 60000);
        const spent = Number(b.spent || wallet.budgetSpent || 0);
        const remaining = b.remaining !== undefined ? Number(b.remaining) : Math.max(0, limit - spent);

        if (budgetRemainingValue) {
          budgetRemainingValue.textContent = `${remaining.toLocaleString('fr-FR')} XOF`;
        }

        if (budgetProgress && limit > 0) {
          const pct = Math.min(100, Math.max(0, Math.round((spent / limit) * 100)));
          budgetProgress.style.width = `${pct}%`;
        }
      }
    } catch (e) {
      console.warn('Sync solde impossible:', e);
    }
  }

  // 5. Envoi Dialogue
  async function sendDialogTurn(payload, userText) {
    if (isProcessing) return;
    isProcessing = true;

    appendUserMessage(userText || payload.text);
    if (liveTranscript) liveTranscript.textContent = userText || payload.text;
    setLoadingState(true);

    const bodyData = {
      sessionId: sessionId,
      lang: currentLang,
      language: currentLang,
      confidence: 0.98,
      ...payload
    };

    const data = await apiCall('/api/v1/dialog/turns', {
      method: 'POST',
      body: JSON.stringify(bodyData)
    });

    setLoadingState(false);
    isProcessing = false;
    handleDialogResponse(data);
  }

  // 6. Gestion du Micro
  if (mainMicBtn) {
    mainMicBtn.addEventListener('click', () => {
      if (!isRecording) startRecording();
      else stopRecording();
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const spoken = liveTranscript.textContent.trim();
        processAudio(audioBlob, spoken);
      };

      mediaRecorder.start();
      isRecording = true;

      if (speechRecognition) {
        speechRecognition.lang = currentLang === 'yor' ? 'yo-NG' : 'fr-FR';
        try { speechRecognition.start(); } catch (e) {}
      }

      mainMicBtn.classList.add('recording');
      if (micStatusLabel) micStatusLabel.textContent = "Écoute en cours... Réappuyez pour envoyer";
      if (liveTranscript) liveTranscript.innerHTML = '<span class="transcript-placeholder">Parlez maintenant...</span>';

    } catch (err) {
      alert("Microphone inaccessible. Veuillez autoriser le micro ou utiliser HTTPS.");
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }

    if (speechRecognition) {
      try { speechRecognition.stop(); } catch (e) {}
    }

    mainMicBtn.classList.remove('recording');
    setLoadingState(true);
    if (micStatusLabel) micStatusLabel.textContent = "Traitement en cours...";
  }

  async function processAudio(blob, spokenText) {
    const cleanSpoken = (spokenText && !spokenText.includes('Parlez maintenant')) ? spokenText : '';

    // Si on est en attente de confirmation et que l'utilisateur a dit "Oui" / "Non"
    const lower = cleanSpoken.toLowerCase();
    if (activePendingKey && (lower.includes('oui') || lower.includes('en') || lower.includes('bẹ́ẹ̀ni') || lower.includes('ok'))) {
      executeConfirmation();
      return;
    }

    const form = new FormData();
    if (blob && blob.size > 0) form.append('audio', blob, 'recording.wav');
    form.append('lang', currentLang);
    form.append('sessionId', sessionId);
    if (cleanSpoken) form.append('text', cleanSpoken);

    const data = await apiCall('/api/v1/audio/pipeline', { method: 'POST', body: form });

    setLoadingState(false);
    if (micStatusLabel) micStatusLabel.textContent = "Appuyer pour parler";

    const userHeard = data.transcript || cleanSpoken || "Message vocal";
    appendUserMessage(userHeard);

    handleDialogResponse(data);
  }

  function setLoadingState(loading) {
    if (loading) {
      if (micIcon) micIcon.classList.add('hidden');
      if (micSpinner) micSpinner.classList.remove('hidden');
    } else {
      if (micIcon) micIcon.classList.remove('hidden');
      if (micSpinner) micSpinner.classList.add('hidden');
    }
  }

  // 7. Traitement des Réponses & Machine d'État
  function handleDialogResponse(data) {
    // Mode Secours par défaut (tant que GPU non branché)
    if (engineBadge) {
      engineBadge.className = 'badge badge-secours';
      engineBadgeText.textContent = 'Mode Secours (Mock)';
    }

    const botMsg = data.replyMessage || data.message || data.result?.turn?.message || data.explanation || "Opération terminée.";
    appendBotMessage(botMsg);
    speak(botMsg, currentLang);

    const state = data.state || data.nextState || data.dialogState || data.result?.turn?.nextState || "IDLE";
    const op = data.preparedOperation || data.operation || data.pendingTransfer || data.result?.turn?.preparedOperation;
    const warnings = data.warnings || data.alerts || data.result?.turn?.warnings || [];

    // Clé d'idempotence
    const key = data.idempotencyKey || op?.idempotencyKey || op?.idempotency_key;
    if (key) activePendingKey = key;

    // Décision stricte d'affichage
    const isWaiting = (state === 'AWAITING_TRANSFER_CONFIRMATION' || data.needsConfirmation === true);
    const isCompleted = (state === 'COMPLETED' || state === 'IDLE' || state === 'CANCELLED' || op?.status === 'COMPLETED');

    if (isWaiting && !isCompleted) {
      showConfirmationUI(op, warnings);
    } else {
      hideConfirmationUI();
      activePendingKey = null;
      refreshWallet();
    }
  }

  function showConfirmationUI(op, warnings) {
    const amt = op?.amount ? Number(op.amount).toLocaleString('fr-FR') + ' XOF' : '2 000 XOF';
    const rec = op?.recipient?.name || op?.recipient || 'Amina';

    if (confDetailsText) {
      confDetailsText.textContent = `Voulez-vous transférer ${amt} à ${rec} ?`;
    }

    if (warnings && warnings.length > 0) {
      const w = warnings[0];
      const text = w.rule ? `[${w.rule}] ${w.messageKey || w.code || ''}` : JSON.stringify(w);
      if (fraudAlertBox) {
        fraudAlertBox.classList.remove('hidden');
        fraudAlertBox.style.display = 'flex';
      }
      if (fraudAlertText) fraudAlertText.textContent = `🚨 Sécurité : ${text}`;
    } else {
      if (fraudAlertBox) {
        fraudAlertBox.classList.add('hidden');
        fraudAlertBox.style.display = 'none';
      }
    }

    if (confirmationCard) {
      confirmationCard.classList.remove('hidden');
      confirmationCard.style.display = 'block';
    }
  }

  function hideConfirmationUI() {
    if (confirmationCard) {
      confirmationCard.classList.add('hidden');
      confirmationCard.style.display = 'none';
    }
    if (fraudAlertBox) {
      fraudAlertBox.classList.add('hidden');
      fraudAlertBox.style.display = 'none';
    }
  }

  // 8. Exécution Sûre de la Confirmation
  async function executeConfirmation() {
    setLoadingState(true);
    hideConfirmationUI(); // Fermeture instantanée

    let data = null;

    // Tentative 1 : /dialog/confirm
    if (activePendingKey) {
      data = await apiCall('/api/v1/dialog/confirm', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: activePendingKey, sessionId })
      });
    }

    // Tentative 2 : /dialog/turns avec intent 'confirmer'
    if (!data || data.error || (data._httpStatus && data._httpStatus >= 400)) {
      const yesWord = currentLang === 'fon' ? 'En' : (currentLang === 'yor' ? 'Bẹ́ẹ̀ni' : 'Oui');
      data = await apiCall('/api/v1/dialog/turns', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          text: yesWord,
          intent: 'confirmer',
          confidence: 0.99,
          lang: currentLang
        })
      });
    }

    setLoadingState(false);
    activePendingKey = null;
    handleDialogResponse(data);
    await refreshWallet();
  }

  async function executeCancel() {
    setLoadingState(true);
    hideConfirmationUI();

    let data = null;
    if (activePendingKey) {
      data = await apiCall('/api/v1/dialog/cancel', {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: activePendingKey, sessionId })
      });
    }

    if (!data || data.error || (data._httpStatus && data._httpStatus >= 400)) {
      const noWord = currentLang === 'fon' ? 'Eo' : (currentLang === 'yor' ? 'Rárá' : 'Non');
      data = await apiCall('/api/v1/dialog/turns', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          text: noWord,
          intent: 'annuler',
          confidence: 0.99,
          lang: currentLang
        })
      });
    }

    setLoadingState(false);
    activePendingKey = null;
    handleDialogResponse(data);
    await refreshWallet();
  }

  if (btnConfirmTransfer) btnConfirmTransfer.addEventListener('click', executeConfirmation);
  if (btnCancelTransfer) btnCancelTransfer.addEventListener('click', executeCancel);

  // 9. Synthèse Vocale Web Speech
  function speak(text, lang) {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();

    const clean = text.replace(/[ɖƉ]/g, 'd').replace(/[ɔƆ]/g, 'o').replace(/[ɛƐ]/g, 'e').replace(/[ǔū]/g, 'u').replace(/[ṣ]/g, 'sh');
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 0.95;
    u.lang = lang === 'yor' ? 'yo-NG' : 'fr-FR';
    window.speechSynthesis.speak(u);
  }

  function appendUserMessage(txt) {
    const b = document.createElement('div');
    b.className = 'msg-bubble msg-user';
    b.innerHTML = `<div class="bubble-avatar">👤</div><div class="bubble-content"><p>${escapeHtml(txt)}</p><span class="msg-time">À l'instant</span></div>`;
    conversationFeed.appendChild(b);
    conversationFeed.scrollTop = conversationFeed.scrollHeight;
  }

  function appendBotMessage(txt) {
    const b = document.createElement('div');
    b.className = 'msg-bubble msg-bot';
    b.innerHTML = `<div class="bubble-avatar">🤖</div><div class="bubble-content"><p>${escapeHtml(txt)}</p><span class="msg-time">À l'instant</span></div>`;
    conversationFeed.appendChild(b);
    conversationFeed.scrollTop = conversationFeed.scrollHeight;
  }

  // 10. Actions Rapides
  const ACTIONS = {
    solde: () => sendDialogTurn({ intent: "consulter_solde", text: currentLang === 'fon' ? "Nabi wɛ ɖo gban che mɛ?" : "Quel est mon solde ?" }),
    budget: () => sendDialogTurn({ intent: "consulter_budget", text: currentLang === 'fon' ? "Ehe wɛ nyi budget che nǔ sun ehe" : "Combien puis-je encore dépenser ce mois-ci ?" }),
    transfert: () => sendDialogTurn({ intent: "transferer", slots: { recipient: "Amina", amount: 2000 }, text: currentLang === 'fon' ? "Sɛ caki wé nǔ Amina" : "Envoie 2 000 à Amina" }),
    urgence: async () => {
      appendUserMessage("Envoie d'urgence 15 000 à Koffi très vite !");
      setLoadingState(true);
      const data = await apiCall('/api/v1/demo/scenario', { method: 'POST', body: JSON.stringify({ scenarioId: 'AR_04_URGENCY', lang: currentLang, sessionId }) });
      setLoadingState(false);
      handleDialogResponse(data);
    },
    inconnu: async () => {
      appendUserMessage("Envoie 20 000 au numéro inconnu 97000000");
      setLoadingState(true);
      const data = await apiCall('/api/v1/demo/scenario', { method: 'POST', body: JSON.stringify({ scenarioId: 'AR_01_NEW_CONTACT', lang: currentLang, sessionId }) });
      setLoadingState(false);
      handleDialogResponse(data);
    },
    depassement: async () => {
      appendUserMessage("Envoie 100 000 à Moussa");
      setLoadingState(true);
      const data = await apiCall('/api/v1/demo/scenario', { method: 'POST', body: JSON.stringify({ scenarioId: 'AR_03_INSUFFICIENT_BALANCE', lang: currentLang, sessionId }) });
      setLoadingState(false);
      handleDialogResponse(data);
    }
  };

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const k = chip.getAttribute('data-scenario');
      if (ACTIONS[k]) ACTIONS[k]();
    });
  });

  if (langSelect) {
    langSelect.addEventListener('change', (e) => { currentLang = e.target.value; });
  }

  if (toggleBalanceBtn) {
    let hidden = false;
    toggleBalanceBtn.addEventListener('click', () => {
      hidden = !hidden;
      balanceValue.textContent = hidden ? '••••••' : Number(balanceValue.textContent.replace(/\s/g,'')).toLocaleString('fr-FR');
      toggleBalanceBtn.textContent = hidden ? '🙈' : '👁️';
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Démarrage
  refreshWallet();

})();