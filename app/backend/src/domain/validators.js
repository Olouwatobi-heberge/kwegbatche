// src/domain/validators.js
const db = require("../db/connection");
const config = require("../config");

/**
 * Valide si le montant respecte les bornes autorisées (EF-06 / ENF-15).
 * @param {any} amount
 * @returns {{ valid: boolean, reason?: string, amount?: number }}
 */
function validateAmount(amount) {
  const num = Number(amount);

  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, reason: "Le montant doit être un nombre valide." };
  }

  if (num <= 0) {
    return {
      valid: false,
      reason: "Le montant doit être strictement supérieur à 0.",
    };
  }

  const min = config.transfer?.minAmount || 100;
  const max = config.transfer?.maxAmount || 500000;

  if (num < min) {
    return {
      valid: false,
      reason: `Le montant minimum autorisé est de ${min} XOF.`,
    };
  }

  if (num > max) {
    return {
      valid: false,
      reason: `Le montant maximum autorisé par opération est de ${max} XOF.`,
    };
  }

  return { valid: true, amount: Math.round(num) };
}

/**
 * Résout un nom de destinataire dans la liste des contacts de l'utilisateur.
 * @param {string} userId
 * @param {string} recipientName
 */
function resolveContact(userId, recipientName) {
  if (!recipientName || typeof recipientName !== "string") {
    return { status: "NOT_FOUND" };
  }

  const cleanName = recipientName.trim().toLowerCase();

  const matches = db
    .prepare(
      `
    SELECT id, name, phone_fake 
    FROM contacts 
    WHERE user_id = ? AND LOWER(name) LIKE ?
  `,
    )
    .all(userId, `%${cleanName}%`);

  if (matches.length === 0) {
    return { status: "NOT_FOUND" };
  }

  if (matches.length === 1) {
    return { status: "EXACT_MATCH", contact: matches[0] };
  }

  return { status: "AMBIGUOUS", matches };
}

module.exports = { validateAmount, resolveContact };
