// src/api/middlewares/upload.js
const multer = require('multer');

// Stockage en mémoire RAM pour transmission directe vers le moteur ASR
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp3',
    'audio/m4a',
    'audio/x-m4a',
    'application/octet-stream' // Cas où le navigateur n'envoie pas le bon Content-Type
  ];

  if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(wav|ogg|webm|mp3|m4a)$/i)) {
    cb(null, true);
  } else {
    cb(new Error(`Format audio non supporté: ${file.mimetype}. Formats acceptés : .wav, .ogg, .webm, .mp3`), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Mo maximum
  },
  fileFilter
});

module.exports = upload;