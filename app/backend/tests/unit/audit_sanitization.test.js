// tests/unit/audit_sanitization.test.js
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const db = require('../../src/db/connection');
const { recordAudit } = require('../../src/observability/audit');

describe('🕵️ [ENF-13] Confidentialité des Données & Sanitisation des Logs', () => {

  test('Les codes secrets et mots de passe sont bannis des logs d\'audit', () => {
    const auditId = recordAudit({
      action: 'SUSPICIOUS_ATTEMPT',
      userId: 'usr_mama_rosine',
      details: {
        amount: 2000,
        pin: '1234',
        password: 'MonSecretSuperPrive',
        phone: '+229 97 11 22 33'
      },
      traceId: 'tr_sanitization_01'
    });

    assert.ok(auditId, 'L\'audit doit être consigné');

    const entry = db.prepare('SELECT details FROM audit_log WHERE id = ?').get(auditId);
    assert.ok(entry, 'La ligne d\'audit doit exister en base');

    const savedDetails = JSON.parse(entry.details);
    assert.equal(savedDetails.pin, undefined, 'Le champ PIN doit être supprimé');
    assert.equal(savedDetails.password, undefined, 'Le mot de passe doit être supprimé');
    assert.ok(savedDetails.phone.includes('****'), 'Le numéro de téléphone doit être masqué');
  });

});