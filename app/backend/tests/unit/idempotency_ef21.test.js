// tests/unit/idempotency_ef21.test.js
const assert = require('node:assert/strict');
const { test, describe, beforeEach } = require('node:test');
const db = require('../../src/db/connection');
const { prepareTransfer, executeTransfer } = require('../../src/services/transfer.service');
const { getWalletSummary } = require('../../src/services/wallet.service');

describe('⚡ [EF-21] Idempotence Transactionnelle & Prévention Double-Débit', () => {

  const contact = { id: 'cnt_koffi_01', name: 'Koffi', phone_fake: '+229 97 00 01 02' };

  beforeEach(() => {
    // Réinitialisation du solde de test
    db.prepare(`UPDATE wallets SET balance = 42500 WHERE user_id = 'usr_mama_rosine'`).run();
  });

  test('Une opération répétée avec la même clé renvoie l\'existant SANS re-débiter', () => {
    const initialWallet = getWalletSummary('usr_mama_rosine');
    assert.equal(initialWallet.balance, 42500);

    const amount = 2000;
    const prep = prepareTransfer('usr_mama_rosine', contact, amount, 'Test idempotence');
    const key = prep.idempotencyKey;

    // Premier appel (Clic #1)
    const exec1 = executeTransfer(key);
    assert.equal(exec1.status, 'COMPLETED');
    assert.equal(exec1.replayed, false);

    const midWallet = getWalletSummary('usr_mama_rosine');
    const expectedBalance = 42500 - (amount + exec1.fee);
    assert.equal(midWallet.balance, expectedBalance, 'Le solde doit être débité une seule fois');

    // Deuxième appel immédiat avec la MÊME clé UUID (Simulation clic nerveux / bug 4G)
    const exec2 = executeTransfer(key);
    assert.equal(exec2.status, 'COMPLETED');
    assert.equal(exec2.replayed, true, 'Le système doit marquer l\'opération comme rejouée');

    const finalWallet = getWalletSummary('usr_mama_rosine');
    assert.equal(finalWallet.balance, expectedBalance, 'Le solde NE DOIT PAS avoir changé au deuxième appel');
  });

});