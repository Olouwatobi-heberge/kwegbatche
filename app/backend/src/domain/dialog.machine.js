// src/domain/dialog.machine.js
const config = require('../config');
const { t } = require('../i18n/t');
const { getWalletSummary } = require('../services/wallet.service');
const { calculateFee } = require('../services/fees.service');
const { prepareTransfer } = require('../services/transfer.service');
const { validateAmount, resolveContact } = require('./validators');
const { evaluateAntifraudRules } = require('./antifraud.rules');
const { recordAudit } = require('../observability/audit');

/**
 * Machine à états finis du dialogue vocal KwèGbaTché.
 * 
 * @param {object} params
 * @param {string} params.currentState État actuel ('IDLE', 'AWAITING_TRANSFER_CONFIRMATION', 'AWAITING_CLARIFICATION')
 * @param {object} params.session Session utilisateur
 * @param {object} params.nlu Résultat NLU { intent, confidence, slots, rawText }
 * @param {string} [params.action] Action explicite venant de l'IHM ('confirm', 'cancel')
 * @param {string} [params.traceId] Identifiant de trace
 * @returns {{ nextState: string, message: string, preparedOperation: object|null, warnings: Array, suggestedActions: Array }}
 */
function processDialogTurn({ currentState = 'IDLE', session = {}, nlu = {}, action = null, traceId = null }) {
  const userId = session.userId || 'usr_mama_rosine';
  const lang = session.lang || 'fon';
  const highConfidenceThreshold = config.confidence?.high || 0.80;

  let nextState = currentState;
  let message = '';
  let preparedOperation = null;
  let warnings = [];
  let suggestedActions = [];

  const rawIntent = nlu.intent || 'inconnu';
  const confidence = typeof nlu.confidence === 'number' ? nlu.confidence : 1.0;
  const slots = nlu.slots || {};
  const rawText = nlu.rawText || '';

  // -------------------------------------------------------------
  // GESTION DU BOUTON / ACTION EXPLICITE (IHM)
  // -------------------------------------------------------------
  if (action === 'cancel' || rawIntent === 'annuler') {
    recordAudit({ action: 'DIALOG_CANCEL', userId, traceId });
    return {
      nextState: 'IDLE',
      message: t(lang, 'transfer_cancelled'),
      preparedOperation: null,
      warnings: [],
      suggestedActions: []
    };
  }

  // -------------------------------------------------------------
  // ÉTAT 1 : EN ATTENTE DE CONFIRMATION DU RECAPITULATIF
  // -------------------------------------------------------------
  if (currentState === 'AWAITING_TRANSFER_CONFIRMATION') {
    if (rawIntent === 'confirmer' && confidence >= highConfidenceThreshold) {
      // Intention de confirmation vocale explicite validée
      return {
        nextState: 'COMPLETED',
        message: t(lang, 'transfer_recap'),
        preparedOperation: session.pendingOperation || null,
        warnings: [],
        suggestedActions: []
      };
    }

    if (rawIntent === 'annuler' || rawIntent === 'refuser') {
      return {
        nextState: 'IDLE',
        message: t(lang, 'transfer_cancelled'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    // Réponse ambiguë ou silence -> ON NE DÉBITE JAMAIS (Garde-fou CA-2)
    return {
      nextState: 'AWAITING_TRANSFER_CONFIRMATION',
      message: t(lang, 'fallback_rephrase'),
      preparedOperation: session.pendingOperation || null,
      warnings: [],
      suggestedActions: ['confirmer', 'annuler']
    };
  }

  // -------------------------------------------------------------
  // ÉTAT 2 : ÉTAT DE DÉPART (IDLE) OU TOUT AUTRE ÉTAT
  // -------------------------------------------------------------

  // A. Consultation de Solde / Budget
  if (rawIntent === 'consulter_solde') {
    const summary = getWalletSummary(userId);
    message = t(lang, 'balance_recap', { balance: summary.balance });

    if (summary.budget) {
      message += ' ' + t(lang, 'budget_info', {
        spent: summary.budget.spent,
        limit: summary.budget.limit,
        remaining: summary.budget.remaining
      });
    }

    return {
      nextState: 'IDLE',
      message,
      preparedOperation: null,
      warnings: [],
      suggestedActions: []
    };
  }

  // B. Intention de Transfert
  if (rawIntent === 'transferer') {
    // Garde-fou O4 : Si la confiance est sous 0.80, on demande de reformuler sans engager
    if (confidence < highConfidenceThreshold) {
      return {
        nextState: 'IDLE',
        message: t(lang, 'fallback_rephrase'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    const recipientName = slots.recipient || slots.contact || null;
    const amountRaw = slots.amount || null;

    // 1. Manque le destinataire ?
    if (!recipientName) {
      return {
        nextState: 'AWAITING_CLARIFICATION',
        message: t(lang, 'clarify_amount', { recipient: 'votre destinataire' }),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    // 2. Résolution du contact
    const contactRes = resolveContact(userId, recipientName);

    if (contactRes.status === 'AMBIGUOUS') {
      const matchNames = contactRes.matches.map(m => m.name).join(', ');
      return {
        nextState: 'AWAITING_CLARIFICATION',
        message: t(lang, 'clarify_contact', { matches: matchNames }),
        preparedOperation: null,
        warnings: [],
        suggestedActions: contactRes.matches.map(m => m.name)
      };
    }

    // 3. Validation du montant
    const amountVal = validateAmount(amountRaw);
    if (!amountVal.valid) {
      return {
        nextState: 'AWAITING_CLARIFICATION',
        message: t(lang, 'error_invalid_amount'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    const amount = amountVal.amount;
    const summary = getWalletSummary(userId);
    const isKnown = contactRes.status === 'EXACT_MATCH';
    const contactObj = isKnown ? contactRes.contact : { id: 'unknown', name: recipientName, phone_fake: '+229 00 00 00 00' };

    // 4. Évaluation du moteur Anti-Fraude (AR-01 à AR-05)
    const fraudCheck = evaluateAntifraudRules({
      isKnownContact: isKnown,
      amount,
      balance: summary.balance,
      transcript: rawText
    });

    warnings = fraudCheck.warnings || [];

    // Si bloquant (ex: AR-03 Solde insuffisant) -> Refus net immédiat
    if (fraudCheck.blocked) {
      const { fee } = calculateFee(amount);
      return {
        nextState: 'IDLE',
        message: t(lang, 'error_insufficient_balance', {
          balance: summary.balance,
          amount,
          fee
        }),
        preparedOperation: null,
        warnings,
        suggestedActions: []
      };
    }

    // 5. Tout est valide -> Préparation de l'opération idempotente
    const prep = prepareTransfer(userId, contactObj, amount, rawText);
    const { fee, total } = calculateFee(amount);

    let recapMsg = t(lang, 'transfer_recap', {
      amount,
      recipient: contactObj.name,
      fee,
      total
    });

    // Ajout vocal des avertissements anti-fraude si présents (ex: AR-01, AR-02, AR-04)
    if (warnings.length > 0) {
      const warningText = warnings.map(w => t(lang, w.messageKey, { amount, recipient: contactObj.name })).join(' ');
      recapMsg = `${warningText} ${recapMsg}`;
    }

    recordAudit({
      action: 'TRANSFER_PREPARED',
      userId,
      details: { amount, recipient: contactObj.name, idempotencyKey: prep.idempotencyKey },
      traceId
    });

    return {
      nextState: 'AWAITING_TRANSFER_CONFIRMATION',
      message: recapMsg,
      preparedOperation: prep.operation,
      warnings,
      suggestedActions: ['confirmer', 'annuler']
    };
  }

  // C. Fallback général (intention incomprise ou confiance < 0.50)
  return {
    nextState: 'IDLE',
    message: t(lang, 'fallback_rephrase'),
    preparedOperation: null,
    warnings: [],
    suggestedActions: []
  };
}

module.exports = { processDialogTurn };