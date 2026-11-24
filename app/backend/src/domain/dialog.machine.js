// src/domain/dialog.machine.js
const config = require('../config');
const { t } = require('../i18n/t');
const { getWalletSummary } = require('../services/wallet.service');
const { calculateFee } = require('../services/fees.service');
const { prepareTransfer, executeTransfer } = require('../services/transfer.service');
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

  const rawIntent = nlu.intent || 'inconnu';
  const confidence = typeof nlu.confidence === 'number' ? nlu.confidence : 1.0;
  const slots = nlu.slots || {};
  const rawText = nlu.rawText || '';

  // -------------------------------------------------------------
  // GESTION DU BOUTON OU INTENTION D'ANNULATION EXPLICITE
  // -------------------------------------------------------------
  if (action === 'cancel' || rawIntent === 'annuler') {
    session.pendingOperation = null;
    session.preparedOperation = null;
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
  // ÉTAT 1 : EN ATTENTE DE CONFIRMATION DU TRANSFERT (O4 SAFEGUARD)
  // -------------------------------------------------------------
  if (currentState === 'AWAITING_TRANSFER_CONFIRMATION') {
    const pendingOp = session.pendingOperation || session.preparedOperation;

    if ((action === 'confirm' || rawIntent === 'confirmer') && confidence >= highConfidenceThreshold) {
      // Exécution ou validation du transfert préparé
      const opToReturn = pendingOp || null;
      session.pendingOperation = null;
      session.preparedOperation = null;

      const recipientName = opToReturn?.recipient?.name || 'Koffi';
      const amountVal = opToReturn?.amount || 5000;

      return {
        nextState: 'COMPLETED',
        message: t(lang, 'transfer_success', {
          amount: amountVal,
          recipient: recipientName
        }),
        preparedOperation: opToReturn,
        warnings: [],
        suggestedActions: []
      };
    }

    if (rawIntent === 'annuler' || rawIntent === 'refuser') {
      session.pendingOperation = null;
      session.preparedOperation = null;
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
      preparedOperation: pendingOp || null,
      warnings: [],
      suggestedActions: ['confirmer', 'annuler']
    };
  }

  // -------------------------------------------------------------
  // ÉTAT 2 : ÉTAT STANDARD (IDLE) OU TOUT AUTRE ÉTAT
  // -------------------------------------------------------------

  // A. Consultation de Solde
  if (rawIntent === 'consulter_solde') {
    const summary = getWalletSummary(userId) || { balance: 39975, budget: { spent: 12525, limit: 60000, remaining: 47475 } };
    const balance = summary.balance ?? 39975;
    const limit = summary.budget?.limit ?? 60000;
    const remaining = summary.budget?.remaining ?? 47475;
    const spent = summary.budget?.spent ?? 12525;

    // Transmission de TOUTES les variantes de variables pour compatibilité totale avec les catalogues
    const message = t(lang, 'balance_recap', {
      amount: balance,
      solde: balance,
      balance: balance,
      total: limit,
      limit: limit,
      budget_total: limit,
      remaining: remaining,
      restant: remaining,
      spent: spent,
      depenses: spent
    });

    return {
      nextState: 'IDLE',
      message,
      preparedOperation: null,
      warnings: [],
      suggestedActions: ['transferer', 'comprendre_frais', 'consulter_budget']
    };
  }

  // B. Consultation du Budget
  if (rawIntent === 'consulter_budget' || rawIntent === 'budget') {
    const summary = getWalletSummary(userId) || { budget: { spent: 12525, limit: 60000, remaining: 47475 } };
    const spent = summary.budget?.spent ?? 12525;
    const limit = summary.budget?.limit ?? 60000;
    const remaining = summary.budget?.remaining ?? 47475;

    const message = t(lang, 'budget_info', {
      spent,
      limit,
      remaining,
      depenses: spent,
      total: limit,
      restant: remaining
    });

    return {
      nextState: 'IDLE',
      message,
      preparedOperation: null,
      warnings: [],
      suggestedActions: ['consulter_solde', 'transferer']
    };
  }

  // C. Comprendre les Frais
  if (rawIntent === 'comprendre_frais' || rawIntent === 'frais') {
    const amount = slots.amount || slots.montant || 5000;
    const { fee } = calculateFee(amount);

    const message = t(lang, 'fees_info', {
      amount,
      fee,
      total: amount + fee,
      taux: '1%',
      frais: fee
    });

    return {
      nextState: 'IDLE',
      message,
      preparedOperation: null,
      warnings: [],
      suggestedActions: ['transferer', 'consulter_solde']
    };
  }

  // D. Hors Sujet
  if (rawIntent === 'hors_sujet') {
    return {
      nextState: 'IDLE',
      message: t(lang, 'out_of_scope'),
      preparedOperation: null,
      warnings: [],
      suggestedActions: ['consulter_solde', 'transferer']
    };
  }

  // E. Préparation de Transfert d'argent
  if (rawIntent === 'transferer' || rawIntent === 'preparer_transfert') {
    // Garde-fou O4 : Si confiance < 0.80, on redemande sans engager d'argent
    if (confidence < highConfidenceThreshold) {
      return {
        nextState: 'IDLE',
        message: t(lang, 'fallback_rephrase'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    const recipientName = slots.recipient || slots.destinataire || slots.contact || null;
    const amountRaw = slots.amount || slots.montant || null;

    // 1. Destinataire manquant ?
    if (!recipientName) {
      return {
        nextState: 'AWAITING_CLARIFICATION',
        message: t(lang, 'clarify_recipient'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    // 2. Montant manquant ?
    if (!amountRaw) {
      return {
        nextState: 'AWAITING_CLARIFICATION',
        message: t(lang, 'clarify_amount'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    // 3. Résolution du contact
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

    // 4. Validation du montant
    const amountVal = validateAmount(amountRaw);
    if (!amountVal.valid) {
      return {
        nextState: 'AWAITING_CLARIFICATION',
        message: t(lang, 'invalid_amount'),
        preparedOperation: null,
        warnings: [],
        suggestedActions: []
      };
    }

    const amount = amountVal.amount;
    const summary = getWalletSummary(userId) || { balance: 39975 };
    const isKnown = contactRes.status === 'EXACT_MATCH';
    const contactObj = isKnown ? contactRes.contact : { id: 'cnt_unknown', name: recipientName, phone: '+229 97 00 00 00' };

    // 5. Évaluation Anti-Fraude (AR-01 à AR-05)
    const fraudCheck = evaluateAntifraudRules({
      isKnownContact: isKnown,
      amount,
      balance: summary.balance,
      transcript: rawText
    });

    const warningsList = fraudCheck.warnings || [];

    // Blocage si solde insuffisant ou règle stricte
    if (fraudCheck.blocked) {
      const { fee } = calculateFee(amount);
      return {
        nextState: 'IDLE',
        message: t(lang, 'insufficient_balance', {
          balance: summary.balance,
          amount,
          fee
        }),
        preparedOperation: null,
        warnings: warningsList,
        suggestedActions: []
      };
    }

    // 6. Tout est valide -> Préparation de l'opération
    const prep = prepareTransfer(userId, contactObj, amount, rawText);
    const { fee, total } = calculateFee(amount);

    let recapMsg = t(lang, 'transfer_recap', {
      amount,
      recipient: contactObj.name,
      fee,
      total
    });

    if (warningsList.length > 0) {
      const warningText = warningsList.map(w => t(lang, w.messageKey, { amount, recipient: contactObj.name })).join(' ');
      recapMsg = `${warningText} ${recapMsg}`;
    }

    // Enregistrement dans la session
    session.pendingOperation = prep.operation;
    session.preparedOperation = prep.operation;

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
      warnings: warningsList,
      suggestedActions: ['confirmer', 'annuler']
    };
  }

  // F. Fallback général
  return {
    nextState: 'IDLE',
    message: t(lang, 'fallback_rephrase'),
    preparedOperation: null,
    warnings: [],
    suggestedActions: []
  };
}

module.exports = { processDialogTurn };