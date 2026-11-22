// tests/unit/fees.test.js
const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const { calculateFee } = require('../../src/services/fees.service');
const { validateAmount } = require('../../src/domain/validators');

describe('📊 [EF-12] Grille Tarifaire & Validation des Montants', () => {

  test('Palier 1 : Montants de 1 à 2 500 XOF -> Frais de 25 XOF', () => {
    const resMin = calculateFee(100);
    assert.equal(resMin.fee, 25);
    assert.equal(resMin.total, 125);

    const resMax = calculateFee(2500);
    assert.equal(resMax.fee, 25);
    assert.equal(resMax.total, 2525);
  });

  test('Palier 2 : Montants de 2 501 à 10 000 XOF -> Frais de 100 XOF', () => {
    const res = calculateFee(5000);
    assert.equal(res.fee, 100);
    assert.equal(res.total, 5100);

    const resLimit = calculateFee(10000);
    assert.equal(resLimit.fee, 100);
    assert.equal(resLimit.total, 10100);
  });

  test('Palier 3 : Montants de 10 001 à 50 000 XOF -> Frais de 250 XOF', () => {
    const res = calculateFee(25000);
    assert.equal(res.fee, 250);
    assert.equal(res.total, 25250);

    const resLimit = calculateFee(50000);
    assert.equal(resLimit.fee, 250);
    assert.equal(resLimit.total, 50250);
  });

  test('Palier 4 : Montants de 50 001 à 500 000 XOF -> Frais de 500 XOF', () => {
    const res = calculateFee(75000);
    assert.equal(res.fee, 500);
    assert.equal(res.total, 75500);

    const resMax = calculateFee(500000);
    assert.equal(resMax.fee, 500);
    assert.equal(resMax.total, 500500);
  });

  test('Validation des bornes (Minimum 100 XOF, Maximum 500 000 XOF)', () => {
    assert.equal(validateAmount(50).valid, false, 'Montant < 100 XOF doit être rejeté');
    assert.equal(validateAmount(600000).valid, false, 'Montant > 500 000 XOF doit être rejeté');
    assert.equal(validateAmount(-1000).valid, false, 'Montant négatif doit être rejeté');
    assert.equal(validateAmount('abc').valid, false, 'Valeur non numérique rejetée');
    assert.equal(validateAmount(5000).valid, true, 'Montant nominal accepté');
  });

});