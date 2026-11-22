// tests/integration/api.test.js
const assert = require('node:assert/strict');
const { test, describe, before, after } = require('node:test');
const app = require('../../app');

describe('🌐 Tests d\'Intégration HTTP (Endpoints REST)', () => {

  let server;
  let baseUrl;

  // Démarrage asynchrone sécurisé du serveur Express sur port dynamique
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/v1`;
        resolve();
      });
    });
  });

  // Fermeture propre après les tests
  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /wallet/summary -> 200 OK avec Solde et Budget', async () => {
    const res = await fetch(`${baseUrl}/wallet/summary`, {
      headers: { 'X-Session-Id': 'sess_test_integration' }
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.currency, 'XOF');
    assert.equal(typeof data.balance, 'number');
    assert.ok(data.budget, 'Doit retourner les informations de budget');
  });

  test('GET /wallet/fees?amount=7500 -> 200 OK (Palier 2 : 100 F)', async () => {
    const res = await fetch(`${baseUrl}/wallet/fees?amount=7500`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.fee, 100);
    assert.equal(data.total, 7600);
    assert.equal(data.currency, 'XOF');
  });

  test('GET /wallet/fees?amount=invalid -> 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/wallet/fees?amount=abc`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'INVALID_AMOUNT');
  });

  test('POST /dialog/turns -> Intention de solde', async () => {
    const res = await fetch(`${baseUrl}/dialog/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'consulter_solde',
        confidence: 0.98,
        slots: {}
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.state, 'IDLE');
    assert.ok(data.message.length > 0);
    assert.ok(res.headers.get('x-trace-id'));
  });

  test('POST /demo/reset -> Réinitialisation DB réussie', async () => {
    const res = await fetch(`${baseUrl}/demo/reset`, { method: 'POST' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'DATABASE_RESET_SUCCESS');
    assert.equal(data.summary.balance, 42500);
  });

  test('POST /demo/idempotency-test -> Preuve anti-double débit (EF-21)', async () => {
    const res = await fetch(`${baseUrl}/demo/idempotency-test`, { method: 'POST' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.verification.doubleDebitAvoided, true);
    assert.equal(data.click2.replayed, true);
  });

});