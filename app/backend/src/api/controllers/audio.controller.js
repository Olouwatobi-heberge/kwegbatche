// src/api/controllers/audio.controller.js
const { transcribeAudio } = require('../../ml/asr.client');
const { synthesizeAudio } = require('../../ml/tts.client');
const { processDialogTurn } = require('../../domain/dialog.machine');

/**
 * POST /api/v1/audio/transcribe
 * Reçoit un fichier audio et retourne la transcription.
 */
exports.transcribe = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 'NO_AUDIO_FILE',
        message: 'Aucun fichier audio n\'a été fourni.',
        traceId: req.traceId
      });
    }

    const lang = req.body.lang || req.session?.lang || 'fon';
    const result = await transcribeAudio(req.file.buffer, req.file.mimetype, lang);

    res.json({
      traceId: req.traceId,
      text: result.text,
      lang: result.lang,
      confidence: result.confidence,
      durationMs: result.durationMs,
      isMock: result.isMock || false
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/audio/synthesize
 * Synthétise un texte en flux audio direct.
 */
exports.synthesize = async (req, res, next) => {
  try {
    const { text, lang } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        code: 'INVALID_TEXT',
        message: 'Le champ text est obligatoire.',
        traceId: req.traceId
      });
    }

    const targetLang = lang || req.session?.lang || 'fon';
    const result = await synthesizeAudio(text, targetLang);

    res.set({
      'Content-Type': result.contentType,
      'Content-Length': result.audioBuffer.length,
      'X-TTS-Latency-Ms': result.durationMs,
      'X-Trace-Id': req.traceId
    });

    res.send(result.audioBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/audio/pipeline
 * Pipeline vocal complet 1-clic : Audio IN -> ASR -> Dialogue -> TTS -> Audio OUT
 */
exports.pipeline = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 'NO_AUDIO_FILE',
        message: 'Fichier audio requis.',
        traceId: req.traceId
      });
    }

    const session = req.session || { userId: 'usr_mama_rosine', lang: 'fon', state: 'IDLE' };
    const lang = req.body.lang || session.lang || 'fon';

    // 1. Étape ASR
    const asr = await transcribeAudio(req.file.buffer, req.file.mimetype, lang);

    // 2. Étape Machine de dialogue
    const turnResult = processDialogTurn({
      currentState: session.state || 'IDLE',
      session,
      nlu: {
        rawText: asr.text,
        confidence: asr.confidence
      },
      traceId: req.traceId
    });

    session.state = turnResult.nextState;

    res.json({
      traceId: req.traceId,
      transcription: asr.text,
      dialogState: turnResult.nextState,
      replyMessage: turnResult.message,
      warnings: turnResult.warnings || [],
      preparedOperation: turnResult.preparedOperation || null,
      latencies: {
        asrMs: asr.durationMs
      }
    });
  } catch (err) {
    next(err);
  }
};