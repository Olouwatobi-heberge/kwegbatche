// src/ml/asr.client.js
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const dataset = require('../i18n/utterances.dataset.json');
const { startTimer } = require('../observability/latency');

const ROTATION = ['consulter_solde', 'preparer_transfert', 'comprendre_frais'];

const SCENARIOS = {
  consulter_solde: 'consulter_solde',
  solde: 'consulter_solde',
  preparer_transfert: 'preparer_transfert',
  transfert: 'preparer_transfert',
  comprendre_frais: 'comprendre_frais',
  frais: 'comprendre_frais',
  confirmer: 'confirmer',
  confirm: 'confirmer',
  annuler: 'annuler',
  cancel: 'annuler',
};

// Phrases déjà utilisées par le mock : 5 000 vers Koffi.
// Le dataset n'a pas cette paire exacte (5 000 va à Amina, Koffi reçoit 10 000).
const MOCK_TRANSFER = {
  fr: 'Envoie cinq mille francs à Koffi',
  fon: 'Sɛ caki atɔɔn nǔ Koffi',
  yo: 'Fi ẹgbẹrun marun ranṣẹ si Koffi',
};

function langField(lang) {
  const key = String(lang || 'fon').toLowerCase();
  if (key === 'yo' || key === 'yor' || key === 'yoruba') return 'yo';
  if (key === 'fr' || key === 'fon') return key;
  return 'fr';
}

function canonicalScenario(value) {
  return SCENARIOS[String(value || '').trim().toLowerCase()] || '';
}

function resolveDemoScenario({ scenario, sessionState, rotationStep = 0 } = {}) {
  const chosen = canonicalScenario(scenario);
  const step = Number.isFinite(Number(rotationStep)) ? Number(rotationStep) : 0;
  if (chosen) return { scenario: chosen, nextStep: step };
  if (sessionState === 'AWAITING_TRANSFER_CONFIRMATION') {
    return { scenario: 'confirmer', nextStep: step };
  }
  const index = ((step % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return { scenario: ROTATION[index], nextStep: step + 1 };
}

function datasetPhrase(intent, field) {
  const rows = dataset.filter((item) => item.intent === intent);
  const own = rows.find((item) => item[field] && String(item[field]).trim());
  if (own) return String(own[field]).trim();
  const fallback = rows.find((item) => item.fr && String(item.fr).trim());
  return fallback ? String(fallback.fr).trim() : '';
}

function mockTranscriptFor(lang, scenario) {
  const field = langField(lang);
  const intent = canonicalScenario(scenario) || 'consulter_solde';
  if (intent === 'preparer_transfert') return MOCK_TRANSFER[field] || MOCK_TRANSFER.fr;
  return datasetPhrase(intent, field);
}

/**
 * Transcrit un buffer audio en texte.
 * @param {Buffer} audioBuffer Buffer binaire du fichier audio
 * @param {string} mimeType Type MIME de l'audio
 * @param {string} lang Langue cible ('fon' | 'yor' | 'fr')
 * @param {{ scenario?: string, sessionState?: string, rotationStep?: number }} [options]
 * @returns {Promise<{ text: string, lang: string, confidence: number, durationMs: number, isMock?: boolean, scenario?: string, nextStep?: number }>}
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/wav', lang = 'fon', options = {}) {
  const timer = startTimer('asr');
  const asrUrl = config.mlServices?.asrUrl || 'http://127.0.0.1:8000/asr';
  const timeoutMs = config.timeouts?.asrMs || 6000;

  try {
    // Mode secours : on ne contacte pas le service ASR, on rejoue le cas scripté.
    if (options.forceMock) {
      throw new Error('mode secours demandé');
    }
    const formData = new FormData();
    formData.append('audio', audioBuffer, {
      filename: `audio_${Date.now()}.wav`,
      contentType: mimeType
    });
    formData.append('lang', lang);

    const response = await axios.post(asrUrl, formData, {
      headers: formData.getHeaders(),
      timeout: timeoutMs
    });

    const latency = timer.end();
    return {
      text: response.data.text || '',
      lang: response.data.lang || lang,
      confidence: response.data.confidence || 0.95,
      durationMs: latency
    };
  } catch (error) {
    const latency = timer.end();
    const resolved = resolveDemoScenario(options);
    const text = mockTranscriptFor(lang, resolved.scenario);
    console.warn(
      `[ASR] service injoignable (${asrUrl}) : ${error.message} -> transcription FACTICE (${resolved.scenario})`
    );

    return {
      text,
      lang,
      confidence: 0.88,
      durationMs: latency,
      isMock: true,
      scenario: resolved.scenario,
      nextStep: resolved.nextStep
    };
  }
}

/**
 * Traduction française d'une phrase de démo (fon ou yoruba), pour sous-titrer
 * l'écran devant le jury. Renvoie '' si la phrase n'est pas connue.
 */
function frenchFor(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  for (const key of Object.keys(MOCK_TRANSFER)) {
    if (MOCK_TRANSFER[key] === clean) return MOCK_TRANSFER.fr;
  }
  const row = dataset.find(
    (item) =>
      (item.fon && String(item.fon).trim() === clean) ||
      (item.yo && String(item.yo).trim() === clean) ||
      (item.fr && String(item.fr).trim() === clean)
  );
  return row && row.fr ? String(row.fr).trim() : '';
}

module.exports = {
  transcribeAudio,
  frenchFor,
  mockTranscriptFor,
  resolveDemoScenario,
  canonicalScenario,
};
