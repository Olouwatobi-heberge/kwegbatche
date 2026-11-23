// src/ml/asr.client.js
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const { startTimer } = require('../observability/latency');

/**
 * Transcrit un buffer audio en texte.
 * @param {Buffer} audioBuffer Buffer binaire du fichier audio
 * @param {string} mimeType Type MIME de l'audio
 * @param {string} lang Langue cible ('fon' | 'yor' | 'fr')
 * @returns {Promise<{ text: string, lang: string, confidence: number, durationMs: number }>}
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/wav', lang = 'fon') {
  const timer = startTimer('asr');
  const asrUrl = config.mlServices?.asrUrl || 'http://127.0.0.1:8000/asr';
  const timeoutMs = config.timeouts?.asrMs || 6000;

  try {
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
    console.warn(`[ASR] service injoignable (${asrUrl}) : ${error.message} -> transcription FACTICE`);

    // Repli de secours (Fallback Mock) pour que la démo ne plante jamais sans GPU
    const mockTranscripts = {
      fon: 'Sɛ gankpwe afɔtɔn nǔ Koffi',
      yor: 'Fi ẹgbẹrun marun ranṣẹ si Koffi',
      fr: 'Envoie cinq mille francs à Koffi'
    };

    return {
      text: mockTranscripts[lang] || mockTranscripts.fr,
      lang,
      confidence: 0.88,
      durationMs: latency,
      isMock: true
    };
  }
}

module.exports = { transcribeAudio };