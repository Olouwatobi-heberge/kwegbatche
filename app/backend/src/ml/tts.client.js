// src/ml/tts.client.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { startTimer } = require('../observability/latency');

// Génère un en-tête WAV 16-bit PCM minimaliste (0.5s de silence) pour éviter les erreurs 404
function generateSilentWav() {
  const sampleRate = 16000;
  const numSamples = sampleRate * 0.5;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  return buffer;
}

/**
 * Synthétise un texte en audio.
 * @param {string} text Texte à oraliser
 * @param {string} lang Langue ('fon' | 'yor' | 'fr')
 * @returns {Promise<{ audioBuffer: Buffer, contentType: string, durationMs: number }>}
 */
async function synthesizeAudio(text, lang = 'fon') {
  const timer = startTimer('tts');
  const ttsUrl = config.ml?.ttsUrl || 'http://127.0.0.1:8000/tts';
  const timeoutMs = config.timeouts?.tts || 4000;

  try {
    const response = await axios.post(
      ttsUrl,
      { text, lang },
      { responseType: 'arraybuffer', timeout: timeoutMs }
    );

    const latency = timer.end();
    return {
      audioBuffer: Buffer.from(response.data),
      contentType: 'audio/wav',
      durationMs: latency
    };
  } catch (error) {
    const latency = timer.end();
    // Repli de secours : génère un buffer audio WAV propre
    return {
      audioBuffer: generateSilentWav(),
      contentType: 'audio/wav',
      durationMs: latency,
      isMock: true
    };
  }
}

module.exports = { synthesizeAudio };