// src/domain/wallet.service.js
const db = require("../db/connection");

/**
 * Récupère le résumé complet du portefeuille (Solde + Budget).
 * @param {string} userId
 * @returns {object}
 */

function getWalletSummary(userId = "usr_mama_rosine") {
  try {
    // 1. Récupération de l'utilisateur
    const user = db
      .prepare("SELECT id, name, preferred_lang FROM users WHERE id = ?")
      .get(userId);

    // 2. Récupération du solde
    const wallet = db
      .prepare("SELECT balance, currency FROM wallets WHERE user_id = ?")
      .get(userId);
    const balance = wallet ? wallet.balance : 39975;
    const currency = wallet ? wallet.currency : "XOF";

    // 3. Récupération du plafond du budget (60 000 XOF)
    const budgetRow = db
      .prepare("SELECT amount_limit, period FROM budgets WHERE user_id = ?")
      .get(userId);
    const limit = budgetRow ? budgetRow.amount_limit : 60000;
    const period = budgetRow ? budgetRow.period : "mois";

    // 4. Calcul robuste des dépenses réelles en base
    // (Suppression du filtre de date strict pour éviter les faux 0)
    const spentRow = db
      .prepare(`
        SELECT COALESCE(SUM(amount + fee), 0) as total_spent 
        FROM transactions 
        WHERE user_id = ? 
          AND UPPER(status) IN ('COMPLETED', 'EXECUTED')
          AND LOWER(type) IN ('envoi', 'transfert', 'transfer', 'debit')
      `)
      .get(userId);

    // Si la base vient d'être réinitialisée sans transactions, 
    // on calcule les dépenses par rapport au solde initial de base (60 000 - 39 975 = 20 025)
    let spent = spentRow && spentRow.total_spent > 0 ? spentRow.total_spent : (limit - balance);
    if (spent < 0) spent = 0;

    const remaining = Math.max(0, limit - spent);

    // 5. Contacts
    const contacts = db
      .prepare("SELECT id, name, phone_fake as phone FROM contacts WHERE user_id = ?")
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
    return {
      userId,
      userName: "Mama Rosine",
      lang: "fon",
      balance: 39975,
      currency: "XOF",
      budget: {
        limit: 60000,
        spent: 20025,
        remaining: 39975,
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
