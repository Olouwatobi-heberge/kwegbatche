// src/api/controllers/dialog.controller.js
const { processDialogTurn } = require('../../domain/dialog.machine');
const { executeTransfer, cancelTransfer } = require('../../services/transfer.service');
const { t } = require('../../i18n/t');

/**
 * POST /api/v1/dialog/turn
 * Reçoit l'intention utilisateur (extraite ou simulée) et fait progresser le dialogue.
 */
exports.turn = async (req, res, next) => {
  try {
    const traceId = req.traceId;
    const session = req.session || { userId: 'usr_mama_rosine', lang: 'fon', state: 'IDLE' };
    const { text, intent, confidence, slots, action } = req.body;

    // Simulation NLU de repli si intent non fourni directement
    const nluPayload = {
      intent: intent || 'inconnu',
      confidence: typeof confidence === 'number' ? confidence : 1.0,
      slots: slots || {},
      rawText: text || ''
    };

    const result = processDialogTurn({
      currentState: session.state || 'IDLE',
      session,
      nlu: nluPayload,
      action,
      traceId
    });

    // Mise à jour de la session
    session.state = result.nextState;
    if (result.preparedOperation) {
      session.pendingOperation = result.preparedOperation;
    }

    res.json({
      traceId,
      state: result.nextState,
      message: result.message,
      audioKey: result.audioKey || null,
      preparedOperation: result.preparedOperation || null,
      warnings: result.warnings || [],
      suggestedActions: result.suggestedActions || []
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/dialog/confirm
 * Validation explicite par bouton tactile ou intent "confirmer".
 */
exports.confirm = async (req, res, next) => {
  try {
    const traceId = req.traceId;
    const session = req.session;
    const { idempotencyKey } = req.body;

    const keyToExecute = idempotencyKey || session?.pendingOperation?.idempotencyKey;

    if (!keyToExecute) {
      return res.status(400).json({
        code: 'NO_PENDING_OPERATION',
        message: 'Aucune opération en attente de confirmation.',
        traceId
      });
    }

    const txResult = executeTransfer(keyToExecute);

    if (session) {
      session.state = 'IDLE';
      session.pendingOperation = null;
    }

    const lang = session?.lang || 'fon';
    const message = t(lang, 'transfer_success', {
      amount: txResult.amount,
      recipient: txResult.recipient_name,
      newBalance: txResult.new_balance
    });

    res.json({
      traceId,
      status: 'COMPLETED',
      operation: txResult,
      message
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/dialog/cancel
 * Annulation explicite.
 */
exports.cancel = async (req, res, next) => {
  try {
    const traceId = req.traceId;
    const session = req.session;
    const { idempotencyKey } = req.body;

    const keyToCancel = idempotencyKey || session?.pendingOperation?.idempotencyKey;

    if (keyToCancel) {
      cancelTransfer(keyToCancel);
    }

    if (session) {
      session.state = 'IDLE';
      session.pendingOperation = null;
    }

    const lang = session?.lang || 'fon';
    const message = t(lang, 'transfer_cancelled');

    res.json({
      traceId,
      status: 'CANCELLED',
      message
    });
  } catch (err) {
    next(err);
  }
};