// src/observability/logger.js

function formatLog(level, message, meta = {}) {
  const cleanMeta = { ...meta };

  // Protection ENF-13 stricte
  delete cleanMeta.pin;
  delete cleanMeta.password;
  delete cleanMeta.rawAudio;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...cleanMeta
  };

  return JSON.stringify(logEntry);
}

module.exports = {
  info: (msg, meta) => console.log(formatLog('INFO', msg, meta)),
  warn: (msg, meta) => console.warn(formatLog('WARN', msg, meta)),
  error: (msg, meta) => console.error(formatLog('ERROR', msg, meta)),
  debug: (msg, meta) => {
    if (process.env.DEBUG === 'true') {
      console.debug(formatLog('DEBUG', msg, meta));
    }
  }
};