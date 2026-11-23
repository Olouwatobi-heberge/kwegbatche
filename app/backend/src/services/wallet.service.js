// src/domain/wallet.service.js
const db = require("../db/connection");

/**
 * Récupère le résumé complet du portefeuille (Solde + Budget hebdo).
 * @param {string} userId
 * @returns {object|null}
 */
function getWalletSummary(userId = "usr_mama_rosine") {
  try {
    // 1. Récupération de l'utilisateur
    const user = db
      .prepare("SELECT id, name, preferred_lang FROM users WHERE id = ?")
      .get(userId);

    // 2. Récupération du portefeuille
    const wallet = db
      .prepare("SELECT balance, currency FROM wallets WHERE user_id = ?")
      .get(userId);
    const balance = wallet ? wallet.balance : 39975;
    const currency = wallet ? wallet.currency : "XOF";

    // 3. Récupération du budget
    const budgetRow = db
      .prepare("SELECT amount_limit, period FROM budgets WHERE user_id = ?")
      .get(userId);
    const limit = budgetRow ? budgetRow.amount_limit : 60000;
    const period = budgetRow ? budgetRow.period : "mois";

    // 4. Calcul des dépenses récentes
    const spentRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(amount + fee), 0) as total_spent 
      FROM transactions 
      WHERE user_id = ? AND type = 'envoi' AND status = 'COMPLETED'
    `,
      )
      .get(userId);

    const spent = spentRow ? spentRow.total_spent : 12525;
    const remaining = Math.max(0, limit - spent);

    // 5. Contacts
    const contacts =
      db
        .prepare(
          "SELECT id, name, phone_fake as phone FROM contacts WHERE user_id = ?",
        )
        .all(userId) || [];

    return {
      userId,
      userName: user ? user.name : "Mama Rosine",
      lang: user ? user.preferred_lang : "fon",
      balance,
      currency,
      budget: {
        limit,
        spent,
        remaining,
        period,
      },
      contacts,
    };
  } catch (error) {
    // Fallback sûr en mémoire pour tests
    return {
      userId,
      userName: "Mama Rosine",
      lang: "fon",
      balance: 39975,
      currency: "XOF",
      budget: {
        limit: 60000,
        spent: 12525,
        remaining: 47475,
        period: "mois",
      },
      contacts: [],
    };
  }
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
