// tests/integration/demo_ameliorations.test.js
const assert = require('node:assert/strict');
const { test, describe, before, after } = require('node:test');
const app = require('../../app');

function digits(value) {
  return String(value || '').replace(/\s/g, '');
}

describe('Pipeline vocal : score, langue et mode secours', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
        resolve();
      });
    });
    await fetch(`${baseUrl}/demo/reset`, { method: 'POST' });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  async function pipeline(sessionId, lang, scenario) {
    const form = new FormData();
    form.append('audio', new Blob([new Uint8Array(16)], { type: 'audio/wav' }), 'secours.wav');
    form.append('lang', lang);
    form.append('sessionId', sessionId);
    form.append('demo_scenario', scenario);
    form.append('secours', '1');
    const res = await fetch(`${baseUrl}/audio/pipeline`, {
      method: 'POST',
      headers: { 'X-Session-Id': sessionId },
      body: form,
    });
    assert.equal(res.status, 200);
    return res.json();
  }

  for (const lang of ['fr', 'fon', 'yor']) {
    test(`${lang} : solde, frais et transfert 5000 vers Koffi en mode secours`, async () => {
      const sid = `sess_demo_amelio_${lang}_${Date.now()}`;

      const solde = await pipeline(sid, lang, 'consulter_solde');
      assert.equal(solde.asrMock, true);
      assert.equal(solde.secours, true);
      assert.equal(solde.lang, lang);
      assert.equal(solde.intent, 'consulter_solde');
      assert.ok(solde.intentScore && solde.intentScore.score > 0 && solde.intentScore.score <= 1);
      // Le solde exact dépend des autres tests (base partagée) : on vérifie la forme.
      assert.match(digits(solde.replyMessage), /\d{4,}/, solde.replyMessage);
      if (lang === 'fr') assert.equal(solde.translationFr, '');
      else assert.equal(solde.translationFr, 'Quel est mon solde ?');

      const frais = await pipeline(sid, lang, 'comprendre_frais');
      assert.equal(frais.intent, 'comprendre_frais');
      assert.ok(frais.intentScore && typeof frais.intentScore.score === 'number');
      assert.ok(digits(frais.replyMessage).includes('5100'), frais.replyMessage);

      const transfert = await pipeline(sid, lang, 'preparer_transfert');
      assert.equal(transfert.intent, 'transferer');
      assert.equal(transfert.dialogState, 'AWAITING_TRANSFER_CONFIRMATION');
      assert.equal(transfert.preparedOperation.amount, 5000);
      assert.match(transfert.replyMessage, /Koffi/);
      if (lang !== 'fr') assert.equal(transfert.translationFr, 'Envoie cinq mille francs à Koffi');
    });
  }
});
