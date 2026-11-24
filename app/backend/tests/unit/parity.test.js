const { test, describe } = require('node:test');
const assert = require('node:assert');
const { t, verifyCatalogParity, KEY_ALIASES } = require('../../src/i18n/t.js');

describe('🌍 Parité Linguistique des Catalogues (Fon / Yor / Fr)', () => {
  test('Aucune clé manquante ou superflue entre les 3 langues', () => {
    const parity = verifyCatalogParity();
    assert.strictEqual(
      parity.valid,
      true,
      `Erreurs de parité : ${parity.errors ? parity.errors.join(' | ') : 'inconnue'}`
    );
    assert.ok(
      parity.totalKeys >= 15,
      `Nombre total de clés terminales insuffisant (${parity.totalKeys} < 15)`
    );
  });

  test('Toutes les clés du dialogue technique (balance_recap, budget_info, etc.) se traduisent sans erreur', () => {
    const langs = ['fr', 'fon', 'yor'];
    for (const lang of langs) {
      for (const dialogKey of Object.keys(KEY_ALIASES)) {
        const text = t(lang, dialogKey, {
          amount: 5000,
          balance: 42500,
          recipient: 'Moussa',
          fee: 100,
          total: 5100,
          remaining: 15000,
          spent: 35000,
          ref: 'TX-12345',
          reason: 'Test'
        });
        assert.ok(
          !text.includes('MISSING_TRANSLATION'),
          `Traduction manquante pour la clé '${dialogKey}' en langue '${lang}'`
        );
      }
    }
  });

  test('Remplacement adéquat des variables {amount}, {recipient}, {fee}', () => {
    const res = t('fr', 'transfert.recap', {
      amount: 5000,
      recipient: 'Moussa',
      fee: 100,
      total: 5100
    });
    assert.ok(res.includes('Moussa'), `Moussa introuvable dans: "${res}"`);
    assert.ok(res.includes('5000') || res.includes('5 000'), `Montant 5000 introuvable dans: "${res}"`);
  });
});