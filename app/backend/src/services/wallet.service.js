// src/domain/wallet.service.js
const db = require("../db/connection");

/**
 * Récupère le résumé complet du portefeuille (Solde + Budget hebdo).
 * @param {string} userId
 * @returns {object|null}
 */
function getWalletSummary(userId) {
  const user = db
    .prepare("SELECT id, name FROM users WHERE id = ?")
    .get(userId);
  if (!user) return null;

  const wallet = db
    .prepare("SELECT balance, currency FROM wallets WHERE user_id = ?")
    .get(userId);
  if (!wallet) return null;

  // Budget semaine
  const budget = db
    .prepare(
      "SELECT amount_limit FROM budgets WHERE user_id = ? AND period = ?",
    )
    .get(userId, "semaine");

  // Dépenses des 7 derniers jours (millisecondes)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const spentResult = db
    .prepare(
      `
    SELECT SUM(amount + fee) as total_spent 
    FROM transactions 
    WHERE user_id = ? AND type = 'envoi' AND created_at >= ?
  `,
    )
    .get(userId, oneWeekAgo);

  const spent = spentResult?.total_spent || 0;
  let budgetInfo = null;

  if (budget) {
    const remaining = budget.amount_limit - spent;
    budgetInfo = {
      period: "semaine",
      limit: budget.amount_limit,
      spent,
      remaining,
      exceeded: remaining < 0,
    };
  }

  return {
    user: { display_name: user.name },
    balance: wallet.balance,
    currency: wallet.currency,
    budget: budgetInfo,
  };
}

/**
 * Recuperer le budget suivant une periode quelconque bihebdo, mensuelle etc...
 * PLUS TARD
 */

/**
 * Récupère les contacts d'un utilisateur.
 * @param {string} userId
 */
function getContacts(userId) {
  return db
    .prepare(
      "SELECT id, name, phone_fake FROM contacts WHERE user_id = ? ORDER BY name ASC",
    )
    .all(userId);
}

module.exports = { getWalletSummary, getContacts };
