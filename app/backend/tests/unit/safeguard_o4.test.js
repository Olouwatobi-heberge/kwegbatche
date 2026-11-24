// tests/unit/safeguard_o4.test.js
const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const db = require('../../src/db/connection');
const { processDialogTurn } = require('../../src/domain/dialog.machine');
const { executeTransfer } = require('../../src/services/transfer.service');
const { getWalletSummary } = require('../../src/services/wallet.service');

describe('🔒 [O4 / CA-2] Garde-Fou Absolu : Zéro Débit Sans Accord Explicite', () => {

  const session = { userId: 'usr_mama_rosine', lang: 'fon' };

  beforeEach(() => {
    // Réinitialise le solde de Mama Rosine à 42 500 XOF avant chaque test
    db.prepare(`UPDATE wallets SET balance = 42500 WHERE user_id = 'usr_mama_rosine'`).run();
  });

  test('CAS 1 : Confiance insuffisante (< 0.80) -> Rejet net, aucune opération engagée', () => {
    const turn = processDialogTurn({
      currentState: 'IDLE',
      session,
      nlu: {
        intent: 'transferer',
        confidence: 0.72, // Sous le seuil de 0.80
        slots: { amount: 5000, recipient: 'Koffi' }
      },
      traceId: 'tr_o4_low_conf'
    });

    assert.notEqual(turn.nextState, 'AWAITING_TRANSFER_CONFIRMATION', 'Ne doit pas passer en confirmation');
    assert.equal(turn.preparedOperation, null, 'Aucune opération ne doit être préparée');
    
    // Vérification en base : le solde ne doit pas avoir bougé
    const wallet = getWalletSummary('usr_mama_rosine');
    assert.equal(wallet.balance, 42500);
  });

  test('CAS 2 : Confiance suffisante (>= 0.80) -> Préparation d\'opération avec clé d\'idempotence', () => {
    const turn = processDialogTurn({
      currentState: 'IDLE',
      session,
      nlu: {
        intent: 'transferer',
        confidence: 0.92,
        slots: { amount: 5000, recipient: 'Koffi' }
      },
      traceId: 'tr_o4_high_conf'
    });

    assert.equal(turn.nextState, 'AWAITING_TRANSFER_CONFIRMATION');
    assert.ok(turn.preparedOperation, 'Une opération doit être créée');
    assert.equal(turn.preparedOperation.amount, 5000);
    assert.ok(turn.preparedOperation.idempotencyKey, 'Une clé UUID doit être présente');
    assert.equal(turn.preparedOperation.status, 'PREPARED');

    // Le solde n'est TOUJOURS PAS débité à ce stade (étape de préparation seulement)
    const wallet = getWalletSummary('usr_mama_rosine');
    assert.equal(wallet.balance, 42500, 'Le solde ne doit pas être débité en étape de préparation');
  });

  test('CAS 3 : En attente -> Réponse ambiguë ou hésitation NE DÉBITE JAMAIS', () => {
    const turn = processDialogTurn({
      currentState: 'AWAITING_TRANSFER_CONFIRMATION',
      session: { ...session, pendingOperation: { idempotencyKey: 'fake_key_123' } },
      nlu: {
        intent: 'inconnu',
        confidence: 0.45,
        rawText: 'Peut-être, attends je réfléchis'
      },
      traceId: 'tr_o4_ambiguous'
    });

    assert.equal(turn.nextState, 'AWAITING_TRANSFER_CONFIRMATION');
    assert.notEqual(turn.nextState, 'COMPLETED');

    const wallet = getWalletSummary('usr_mama_rosine');
    assert.equal(wallet.balance, 42500, 'Zéro débit sur phrase ambiguë');
  });

  test('CAS 4 : En attente -> Intention d\'annulation stoppe tout et libère la session', () => {
    const turn = processDialogTurn({
      currentState: 'AWAITING_TRANSFER_CONFIRMATION',
      session,
      nlu: {
        intent: 'annuler',
        confidence: 0.95
      },
      traceId: 'tr_o4_cancel'
    });

    assert.equal(turn.nextState, 'IDLE');
    assert.equal(turn.preparedOperation, null);

    const wallet = getWalletSummary('usr_mama_rosine');
    assert.equal(wallet.balance, 42500, 'Aucun débit suite à annulation');
  });

  test('CAS 5 : En attente -> Confirmation explicite (>= 0.80) autorise le passage à l\'exécution', () => {
    // 1. Étape Préparation
    const prepTurn = processDialogTurn({
      currentState: 'IDLE',
      session,
      nlu: {
        intent: 'transferer',
        confidence: 0.95,
        slots: { amount: 3000, recipient: 'Koffi' }
      },
      traceId: 'tr_o4_prep'
    });

    const op = prepTurn.preparedOperation;
    assert.ok(op);

    // 2. Étape Confirmation vocale explicite
    const confirmTurn = processDialogTurn({
      currentState: 'AWAITING_TRANSFER_CONFIRMATION',
      session: { ...session, pendingOperation: op },
      nlu: {
        intent: 'confirmer',
        confidence: 0.90
      },
      traceId: 'tr_o4_confirm'
    });

    assert.equal(confirmTurn.nextState, 'COMPLETED');

    // 3. Exécution finale
    const tx = executeTransfer(op.idempotencyKey);
    assert.equal(tx.status, 'COMPLETED');

    const finalWallet = getWalletSummary('usr_mama_rosine');
    assert.equal(finalWallet.balance, 42500 - (3000 + tx.fee), 'Le débit n\'a lieu qu\'après confirmation validée');
  });

});