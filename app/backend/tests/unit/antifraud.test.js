// tests/unit/antifraud.test.js
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { evaluateAntifraudRules } = require('../../src/domain/antifraud.rules');

describe('🛡️ [AR-01 à AR-05] Moteur de Détection Anti-Fraude', () => {

  test('AR-01 : Destinataire inconnu (Cas Positif & Négatif)', () => {
    // Cas Positif : Contact non enregistré -> Avertissement
    const resUnknown = evaluateAntifraudRules({
      isKnownContact: false,
      amount: 1000,
      balance: 42500,
      transcript: ''
    });
    assert.ok(resUnknown.warnings.some(w => w.rule === 'AR-01'));
    assert.equal(resUnknown.blocked, false);

    // Cas Négatif : Contact habituel -> Aucun avertissement AR-01
    const resKnown = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 1000,
      balance: 42500,
      transcript: ''
    });
    assert.ok(!resKnown.warnings.some(w => w.rule === 'AR-01'));
  });

  test('AR-02 : Montant anormalement élevé (> 200 000 ou > 3x médiane)', () => {
    // Cas Positif
    const resHigh = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 250000,
      balance: 300000,
      transcript: ''
    });
    assert.ok(resHigh.warnings.some(w => w.rule === 'AR-02'));

    // Cas Négatif
    const resNormal = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 5000,
      balance: 42500,
      transcript: ''
    });
    assert.ok(!resNormal.warnings.some(w => w.rule === 'AR-02'));
  });

  test('AR-03 : Solde insuffisant (Règle BLOQUANTE)', () => {
    // Cas Positif : Débit > Solde -> BLOCAGE
    const resBroke = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 50000,
      balance: 42500,
      transcript: ''
    });
    assert.equal(resBroke.blocked, true, 'AR-03 doit impérativement bloquer le transfert');
    assert.ok(resBroke.warnings.some(w => w.rule === 'AR-03'));

    // Cas Négatif : Solde suffisant -> Non bloqué
    const resOk = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 5000,
      balance: 42500,
      transcript: ''
    });
    assert.equal(resOk.blocked, false);
  });

  test('AR-04 : Détection de manipulation ou précipitation / urgence', () => {
    // Cas Positif en Français
    const resFr = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 2000,
      balance: 42500,
      transcript: 'Envoie vite tout de suite c est une urgence vitale'
    });
    assert.ok(resFr.warnings.some(w => w.rule === 'AR-04'));

    // Cas Positif en Fongbé
    const resFon = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 2000,
      balance: 42500,
      transcript: 'yáwǔ sɛ́dó kútúkútú'
    });
    assert.ok(resFon.warnings.some(w => w.rule === 'AR-04'));

    // Cas Négatif
    const resCalm = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 2000,
      balance: 42500,
      transcript: 'Sɛ gankpwe we nǔ Koffi'
    });
    assert.ok(!resCalm.warnings.some(w => w.rule === 'AR-04'));
  });

  test('AR-05 : Tentative d\'extorsion de code PIN / mot de passe', () => {
    // Cas Positif : Demande de code
    const resPin = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 1000,
      balance: 42500,
      transcript: 'Donne-moi ton code secret ou ton mot de passe pin'
    });
    assert.ok(resPin.warnings.some(w => w.rule === 'AR-05'));

    // Cas Négatif
    const resNoPin = evaluateAntifraudRules({
      isKnownContact: true,
      amount: 1000,
      balance: 42500,
      transcript: 'Je veux payer mon loyer'
    });
    assert.ok(!resNoPin.warnings.some(w => w.rule === 'AR-05'));
  });

});