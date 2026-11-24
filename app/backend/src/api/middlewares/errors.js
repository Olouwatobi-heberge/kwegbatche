const logger = require('../../observability/logger');

module.exports = function errorHandler(err, req, res, next) {
  const traceId = req.traceId || 'unknown';
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const messageKey = err.messageKey || 'error.internal';

  logger.error(err.message || 'Erreur interne du serveur', {
    trace_id: traceId,
    code: errorCode,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message_key: messageKey,
      message: err.message || 'Une erreur interne s est produite.',
      trace_id: traceId
    }
  });
};