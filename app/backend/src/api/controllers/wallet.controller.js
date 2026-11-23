// src/api/controllers/wallet.controller.js
const {
  getWalletSummary,
  getContacts,
} = require("../../services/wallet.service");
const { calculateFee } = require("../../services/fees.service");
const { validateAmount } = require("../../domain/validators");

/**
 * GET /api/v1/wallet/summary
 */
summary = (req, res, next) => {
  try {
    const userId = req.session?.userId || "usr_mama_rosine";
    const summary = getWalletSummary(userId);

    if (!summary) {
      return res.status(404).json({
        code: "WALLET_NOT_FOUND",
        message: "Portefeuille introuvable pour cet utilisateur.",
        traceId: req.traceId,
      });
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/fees?amount=...
 */
fees = (req, res, next) => {
  try {
    const validation = validateAmount(req.query.amount);

    if (!validation.valid) {
      return res.status(400).json({
        code: "INVALID_AMOUNT",
        message: validation.reason,
        traceId: req.traceId,
      });
    }

    const { fee, total } = calculateFee(validation.amount);

    res.json({
      amount: validation.amount,
      fee,
      total,
      currency: "XOF",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/contacts
 */
contacts = (req, res, next) => {
  try {
    const userId = req.session?.userId || "usr_mama_rosine";
    const contacts = getContacts(userId);
    res.json({ contacts, count: contacts.length });
  } catch (err) {
    next(err);
  }
};


/**
 * GET api/v1/wallet/budget-week
 */


module.exports = { contacts, fees, summary };
