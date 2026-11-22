// tests/unit/parity.test.js
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { verifyCatalogParity, t } = require('../../src/i18n/t');

describe('🌍 Parité Linguistique des Catalogues (Fon / Yor / Fr)', () => {

  test('Aucune clé manquante ou superflue entre les 3 langues', () => {
    const parity = verifyCatalogParity();
    if (!parity.valid) {
      console.error('Erreurs de parité :', parity.errors);
    }
    assert.equal(parity.valid, true, 'Tous les catalogues doivent avoir strictement les mêmes clés');
    assert.ok(parity.totalKeys >= 15);
  });

  test('Remplacement adéquat des variables {amount}, {recipient}, {fee}', () => {
    const res = t('fon', 'transfer_recap', {
      amount: 10000,
      recipient: 'Moussa',
      fee: 100,
      total: 10100
    });

    assert.ok(res.includes('Moussa'));
    assert.ok(res.includes('100'));
  });

});