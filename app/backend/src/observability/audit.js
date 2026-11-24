// src/observability/audit.js
const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Masque les chiffres du milieu d'un numéro de téléphone (ENF-13).
 * Exemples :
 * - "+229 97 11 22 33" -> "+229 97 **** 33"
 * - "+22997112233"     -> "+229 97 **** 33"
 * - "97112233"         -> "97 **** 33"
 */
function maskPhoneNumber(phone) {
  if (typeof phone !== 'string') return phone;
  return phone.replace(/(\+?\d{2,4}[\s.-]?\d{2})[\s\d.-]+(\d{2})$/, '$1 **** $2');
}

/**
 * Enregistre un événement auditable en base SQLite avec anonymisation stricte.
 */
function recordAudit({ action, userId = 'usr_mama_rosine', details = {}, traceId = null }) {
  try {
    const id = `aud_${uuidv4().slice(0, 12)}`;
    const now = Date.now();

    // Sanitisation ENF-13 stricte
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.pin;
    delete sanitizedDetails.password;
    delete sanitizedDetails.secret;

    if (sanitizedDetails.phone) {
      sanitizedDetails.phone = maskPhoneNumber(sanitizedDetails.phone);
    }

    const detailsJson = JSON.stringify(sanitizedDetails);

    db.prepare(`
      INSERT INTO audit_log (id, action, user_id, details, trace_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, action, userId, detailsJson, traceId, now);

    logger.info(`AUDIT: ${action}`, {
      auditId: id,
      action,
      userId,
      traceId
    });

    return id;
  } catch (error) {
    logger.error('Échec d\'enregistrement de l\'audit log', { error: error.message, action, traceId });
    return null;
  }
}

module.exports = { recordAudit, maskPhoneNumber };