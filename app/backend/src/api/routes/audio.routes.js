// src/api/routes/audio.routes.js
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const audioCtrl = require('../controllers/audio.controller');

// Transcription pure (Audio -> Texte)
router.post('/audio/transcribe', upload.single('audio'), audioCtrl.transcribe);

// Synthèse vocale pure (Texte -> Audio WAV)
router.post('/audio/synthesize', audioCtrl.synthesize);

// Pipeline Vocal complet de bout en bout (Audio -> ASR -> Machine -> Réponse)
router.post('/audio/pipeline', upload.single('audio'), audioCtrl.pipeline);

module.exports = router;