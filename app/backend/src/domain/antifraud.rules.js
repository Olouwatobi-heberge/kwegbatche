// src/domain/antifraud.rules.js
const { calculateFee } = require('../services/fees.service');
const config = require('../config');

// Mots-clés de précipitation / urgence (Français, Fongbé, Yoruba) - Règle AR-04
const URGENCY_KEYWORDS = [
  'urgent', 'urgence', 'vite', 'tout de suite', 'immédiatement', 'dépêche',
  'yáwǔ', 'kútúkútú', 'yawu', 'kutukutu', 'fífí',
  'kia kia', 'kiakia', 'kankan', 'yara'
];

// Mots-clés de demande suspecte de code secret ou PIN - Règle AR-05
const PIN_KEYWORDS = [
  'code secret', 'code pin', 'mot de passe', 'ton pin', 'mon pin', 'identifiant',
  'gbetakɛ́n', 'gbetaken', 'koodu aṣiri', 'koodu asiri', 'pin rẹ', 'pin re'
];

/**
 * Évalue les règles anti-fraude AR-01 à AR-05 sur le contexte de l'opération.
 * 
 * @param {object} ctx
 * @param {boolean} ctx.isKnownContact Le destinataire est-il dans le carnet ?
 * @param {number} ctx.amount Montant demandé en XOF
 * @param {number} ctx.balance Solde actuel du portefeuille
 * @param {string} [ctx.transcript] Phrase prononcée par l'utilisateur
 * @param {number} [ctx.medianAmount] Montant médian des transferts passés (optionnel)
 * @returns {{ blocked: boolean, warnings: Array<{ rule: string, code: string, messageKey: string, severity: string }> }}
 */
function evaluateAntifraudRules(ctx = {}) {
  const warnings = [];
  let blocked = false;

  const {
    isKnownContact = true,
    amount = 0,
    balance = 0,
    transcript = '',
    medianAmount = 15000
  } = ctx;

  const cleanText = (transcript || '').toLowerCase();

  // -------------------------------------------------------------
  // AR-01 : Destinataire inconnu (absent du répertoire)
  // -------------------------------------------------------------
  if (isKnownContact === false) {
    warnings.push({
      rule: 'AR-01',
      code: 'UNKNOWN_RECIPIENT',
      messageKey: 'warning_unknown_contact',
      severity: 'warning'
    });
  }

  // -------------------------------------------------------------
  // AR-02 : Montant anormalement élevé (> 3x médiane ou > 200 000 XOF)
  // -------------------------------------------------------------
  const highThreshold = config.transfer?.highAmountThreshold || 200000;
  const isAboveMedian = medianAmount > 0 && amount > (medianAmount * 3);
  const isAboveAbsoluteThreshold = amount > highThreshold;

  if (amount > 0 && (isAboveMedian || isAboveAbsoluteThreshold)) {
    warnings.push({
      rule: 'AR-02',
      code: 'HIGH_AMOUNT',
      messageKey: 'warning_high_amount',
      severity: 'warning'
    });
  }

  // -------------------------------------------------------------
  // AR-03 : Solde insuffisant (Règle BLOQUANTE)
  // Montant + Frais > Solde disponible
  // -------------------------------------------------------------
  if (amount > 0) {
    let fee = 0;
    try {
      fee = calculateFee(amount).fee;
    } catch {
      fee = 0;
    }

    const totalDebit = amount + fee;
    if (totalDebit > balance) {
      blocked = true;
      warnings.push({
        rule: 'AR-03',
        code: 'INSUFFICIENT_BALANCE',
        messageKey: 'error_insufficient_balance',
        severity: 'critical'
      });
    }
  }

  // -------------------------------------------------------------
  // AR-04 : Détection de manipulation temporelle / Urgence
  // -------------------------------------------------------------
  const hasUrgencyWord = URGENCY_KEYWORDS.some(kw => cleanText.includes(kw));
  if (hasUrgencyWord) {
    warnings.push({
      rule: 'AR-04',
      code: 'URGENCY_DETECTED',
      messageKey: 'warning_urgency',
      severity: 'warning'
    });
  }

  // -------------------------------------------------------------
  // AR-05 : Tentative d'extorsion de code secret / PIN
  // -------------------------------------------------------------
  const hasPinWord = PIN_KEYWORDS.some(kw => cleanText.includes(kw));
  if (hasPinWord) {
    warnings.push({
      rule: 'AR-05',
      code: 'PIN_REQUEST_DETECTED',
      messageKey: 'alert_pin_request',
      severity: 'critical'
    });
  }

  return {
    blocked,
    warnings
  };
}

module.exports = { evaluateAntifraudRules };