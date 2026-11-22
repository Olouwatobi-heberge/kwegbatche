// src/services/transfer.service.js
const { randomUUID } = require('crypto');
const db = require('../db/connection');
const config = require('../config');
const { calculateFee } = require('./fees.service');
const { evaluateAntifraudRules } = require('../domain/antifraud.rules');
const { v4: uuidv4 } = require('uuid');
const { recordAudit } = require('../observability/audit');


/**
 * Prépare une opération de transfert avec clé d'idempotence et TTL de 30s.
 */
function prepareTransfer(userId, contact, amount, rawTranscript = '') {
  const { fee, total } = calculateFee(amount);
  const idempotencyKey = uuidv4();
  const opId = `op_${uuidv4().slice(0, 12)}`;
  const now = Date.now();
  const ttlMs = config.transfer?.ttlMs || 30000;
  const expiresAt = now + ttlMs;

  const recipientName = contact?.name || 'Destinataire';
  const recipientPhone = contact?.phone_fake || contact?.phone || '+229 00 00 00 00';
  const recipientId = contact?.id || 'unknown';

  db.prepare(`
    INSERT INTO operations (
      id, user_id, idempotency_key, recipient_id, recipient_name, recipient_phone,
      amount, fee, total_debit, status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PREPARED', ?, ?)
  `).run(
    opId, userId, idempotencyKey, recipientId, recipientName, recipientPhone,
    amount, fee, total, expiresAt, now
  );

  return {
    idempotencyKey,
    operation: {
      id: opId,
      idempotencyKey,
      amount,
      fee,
      total,
      recipient: {
        id: recipientId,
        name: recipientName,
        phone: recipientPhone
      },
      status: 'PREPARED',
      expiresAt
    }
  };
}

/**
 * Exécute le transfert de manière atomique et strictement idempotente (EF-21).
 */
function executeTransfer(idempotencyKey, traceId = null) {
  const op = db.prepare('SELECT * FROM operations WHERE idempotency_key = ?').get(idempotencyKey);

  if (!op) {
    throw new Error('Opération introuvable pour cette clé d\'idempotence.');
  }

  // Idempotence : Si déjà complété, renvoyer la transaction sans re-débiter
  if (op.status === 'COMPLETED') {
    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(op.user_id);
    return {
      status: 'COMPLETED',
      replayed: true,
      idempotencyKey,
      operationId: op.id,
      amount: op.amount,
      fee: op.fee,
      total: op.total_debit,
      recipient_name: op.recipient_name,
      new_balance: wallet.balance
    };
  }

  if (op.status === 'CANCELLED') {
    throw new Error('Cette opération a été annulée.');
  }

  if (Date.now() > op.expires_at) {
    db.prepare(`UPDATE operations SET status = 'EXPIRED' WHERE id = ?`).run(op.id);
    throw new Error('Le délai de confirmation (TTL 30s) a expiré.');
  }

  // Exécution atomique
  return db.transaction(() => {
    const wallet = db.prepare('SELECT id, balance FROM wallets WHERE user_id = ?').get(op.user_id);

    if (!wallet || wallet.balance < op.total_debit) {
      throw new Error('Solde insuffisant pour exécuter ce transfert.');
    }

    const newBalance = wallet.balance - op.total_debit;
    const now = Date.now();

    // 1. Débit du solde
    db.prepare('UPDATE wallets SET balance = ?, updated_at = ? WHERE id = ?').run(newBalance, now, wallet.id);

    // 2. Clôture de l'opération
    db.prepare(`UPDATE operations SET status = 'COMPLETED' WHERE id = ?`).run(op.id);

    // 3. Enregistrement transaction
    const txId = `tx_${uuidv4().slice(0, 12)}`;
    db.prepare(`
      INSERT INTO transactions (id, user_id, wallet_id, operation_id, type, amount, fee, status, created_at)
      VALUES (?, ?, ?, ?, 'envoi', ?, ?, 'COMPLETED', ?)
    `).run(txId, op.user_id, wallet.id, op.id, op.amount, op.fee, now);

    recordAudit({
      action: 'TRANSFER_EXECUTED',
      userId: op.user_id,
      details: { amount: op.amount, fee: op.fee, total: op.total_debit, recipient: op.recipient_name, txId },
      traceId
    });

    return {
      status: 'COMPLETED',
      replayed: false,
      idempotencyKey,
      operationId: op.id,
      transactionId: txId,
      amount: op.amount,
      fee: op.fee,
      total: op.total_debit,
      recipient_name: op.recipient_name,
      new_balance: newBalance
    };
  })();
}

/**
 * Annule une opération préparée.
 */
function cancelTransfer(idempotencyKey, traceId = null) {
  const op = db.prepare('SELECT id, user_id FROM operations WHERE idempotency_key = ?').get(idempotencyKey);
  if (op) {
    db.prepare(`UPDATE operations SET status = 'CANCELLED' WHERE id = ?`).run(op.id);
    recordAudit({
      action: 'TRANSFER_CANCELLED',
      userId: op.user_id,
      details: { operationId: op.id, idempotencyKey },
      traceId
    });
  }
  return { status: 'CANCELLED' };
}

module.exports = { prepareTransfer, executeTransfer, cancelTransfer };