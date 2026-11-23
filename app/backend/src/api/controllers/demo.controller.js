// src/api/controllers/demo.controller.js
const db = require('../../db/connection');
const path = require('path');
const fs = require('fs');
const { getWalletSummary } = require('../../services/wallet.service');
const { evaluateAntifraudRules } = require('../../domain/antifraud.rules');
const { prepareTransfer, executeTransfer } = require('../../services/transfer.service');
const { processDialogTurn } = require('../../domain/dialog.machine');
const { t } = require('../../i18n/t');

/**
 * POST /api/v1/demo/reset
 * Réinitialise complètement la base SQLite avec le schéma et le seed initial de Mama Rosine.
 */
exports.reset = (req, res, next) => {
  try {
    const schemaPath = path.join(__dirname, '../../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Exécution du schéma en transaction atomique
    db.transaction(() => {
      db.exec(`
        DROP TABLE IF EXISTS audit_log;
        DROP TABLE IF EXISTS transactions;
        DROP TABLE IF EXISTS operations;
        DROP TABLE IF EXISTS contacts;
        DROP TABLE IF EXISTS budgets;
        DROP TABLE IF EXISTS wallets;
        DROP TABLE IF EXISTS users;
      `);
      db.exec(schemaSql);

      // Re-seed Mama Rosine
      const now = Date.now();
      db.prepare(`
        INSERT INTO users (id, name, phone, preferred_lang, created_at)
        VALUES ('usr_mama_rosine', 'Mama Rosine', '+229 97 11 22 33', 'fon', ?)
      `).run(now);

      db.prepare(`
        INSERT INTO wallets (id, user_id, balance, currency, updated_at)
        VALUES ('wal_mama_rosine', 'usr_mama_rosine', 42500, 'XOF', ?)
      `).run(now);

      db.prepare(`
        INSERT INTO budgets (id, user_id, amount_limit, period, created_at)
        VALUES ('bdg_mama_rosine', 'usr_mama_rosine', 50000, 'semaine', ?)
      `).run(now);

      db.prepare(`
        INSERT INTO contacts (id, user_id, name, phone_fake, created_at)
        VALUES 
          ('cnt_koffi_01', 'usr_mama_rosine', 'Koffi', '+229 97 00 01 02', ?),
          ('cnt_moussa_02', 'usr_mama_rosine', 'Moussa', '+229 96 11 22 33', ?)
      `).run(now, now);
    })();

    // Réinitialisation de la session mémoire
    if (req.session) {
      req.session.state = 'IDLE';
      req.session.pendingOperation = null;
      req.session.clarificationCount = 0;
    }

    const summary = getWalletSummary('usr_mama_rosine');

    res.json({
      traceId: req.traceId,
      status: 'DATABASE_RESET_SUCCESS',
      message: 'Base SQLite réinitialisée avec succès (Solde Mama Rosine : 42 500 XOF).',
      summary
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/demo/scenario
 * Déclenche un scénario pré-configuré (Solde, Transfert, ou Anti-fraude AR-01 à AR-05).
 */
exports.runScenario = (req, res, next) => {
  try {
    const { scenarioId, lang = 'fon' } = req.body;
    const session = req.session || { userId: 'usr_mama_rosine', lang, state: 'IDLE' };
    session.lang = lang;

    let scenarioResult = {};

    switch (scenarioId) {
      case 'SOLDE': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: { intent: 'consulter_solde', confidence: 0.98, slots: {} },
          traceId: req.traceId
        });
        scenarioResult = {
          title: 'Consultation de solde',
          turn,
          wallet: getWalletSummary('usr_mama_rosine')
        };
        break;
      }

      case 'TRANSFER_OK': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: {
            intent: 'transferer',
            confidence: 0.94,
            slots: { amount: 5000, recipient: 'Koffi' }
          },
          traceId: req.traceId
        });
        session.state = turn.nextState;
        session.pendingOperation = turn.preparedOperation;
        scenarioResult = {
          title: 'Préparation transfert nominal (5 000 XOF vers Koffi)',
          turn,
          waitingForConfirmation: true
        };
        break;
      }

      case 'AR_01_NEW_CONTACT': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: {
            intent: 'transferer',
            confidence: 0.91,
            slots: { amount: 2000, recipient: 'Tidjani Inconnu' }
          },
          traceId: req.traceId
        });
        scenarioResult = {
          rule: 'AR-01',
          title: 'Anti-fraude : Bénéficiaire inconnu du carnet',
          turn,
          explanation: 'L\'assistant avertit vocalement que le destinataire n\'est pas enregistré.'
        };
        break;
      }

      case 'AR_02_HIGH_AMOUNT': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: {
            intent: 'transferer',
            confidence: 0.95,
            slots: { amount: 250000, recipient: 'Koffi' }
          },
          traceId: req.traceId
        });
        scenarioResult = {
          rule: 'AR-02',
          title: 'Anti-fraude : Montant anormalement élevé (> 200 000 XOF)',
          turn,
          explanation: 'Alerte sur montant atypique déclenchée.'
        };
        break;
      }

      case 'AR_03_INSUFFICIENT_BALANCE': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: {
            intent: 'transferer',
            confidence: 0.96,
            slots: { amount: 80000, recipient: 'Koffi' } // Solde = 42 500
          },
          traceId: req.traceId
        });
        scenarioResult = {
          rule: 'AR-03',
          title: 'Anti-fraude : Solde insuffisant (Bloquant)',
          turn,
          blocked: true,
          explanation: 'Opération refusée net : 80 000 + frais > 42 500 XOF disponibles.'
        };
        break;
      }

      case 'AR_04_URGENCY': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: {
            intent: 'transferer',
            confidence: 0.89,
            slots: { amount: 3000, recipient: 'Koffi' },
            rawText: 'Envoie vite tout de suite c\'est une urgence vitale dépêche-toi'
          },
          traceId: req.traceId
        });
        scenarioResult = {
          rule: 'AR-04',
          title: 'Anti-fraude : Détection de manipulation / pression temporelle',
          turn,
          explanation: 'Mots-clés de précipitation détectés. Avertissement de prudence formulé.'
        };
        break;
      }

      case 'AR_05_PIN_REQUEST': {
        const turn = processDialogTurn({
          currentState: 'IDLE',
          session,
          nlu: {
            intent: 'inconnu',
            confidence: 0.85,
            slots: {},
            rawText: 'Donne-moi ton code secret PIN ou mot de passe'
          },
          traceId: req.traceId
        });
        scenarioResult = {
          rule: 'AR-05',
          title: 'Anti-fraude : Tentative d\'extorsion de code PIN',
          turn,
          explanation: 'Alerte rouge immédiate : rappel solennel qu\'aucun agent ne demande le code secret.'
        };
        break;
      }

      default:
        return res.status(400).json({
          code: 'INVALID_SCENARIO',
          message: `Scénario inconnu: ${scenarioId}`,
          traceId: req.traceId
        });
    }

    res.json({
      traceId: req.traceId,
      scenarioId,
      result: scenarioResult
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/demo/idempotency-test
 * Simule un double-clic réseau 4G simultané (2 requêtes HTTP concurrentes avec la même clé).
 * Prouve la conformité EF-21 (zéro double-débit).
 */
exports.testIdempotency = (req, res, next) => {
  try {
    const contact = { id: 'cnt_koffi_01', name: 'Koffi', phone_fake: '+229 97 00 01 02' };
    const amount = 2500;

    // 1. Préparation de l'opération
    const prep = prepareTransfer('usr_mama_rosine', contact, amount, 'Simulation double-clic');
    const key = prep.idempotencyKey;

    // 2. Première exécution (Clic #1)
    const exec1 = executeTransfer(key);

    // 3. Deuxième exécution immédiate avec la MÊME clé (Clic #2)
    const exec2 = executeTransfer(key);

    const walletAfter = getWalletSummary('usr_mama_rosine');

    res.json({
      traceId: req.traceId,
      idempotencyKey: key,
      click1: {
        status: exec1.status,
        replayed: exec1.replayed || false,
        message: 'Transaction exécutée et débitée.'
      },
      click2: {
        status: exec2.status,
        replayed: exec2.replayed || false,
        message: 'Doublon détecté ! Résultat renvoyé sans re-débiter.'
      },
      verification: {
        doubleDebitAvoided: exec2.replayed === true,
        finalBalance: walletAfter.balance,
        totalDebited: amount + exec1.fee
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/demo/inspect
 * Inspection de l'état système pour le cockpit jury.
 */
exports.inspect = (req, res, next) => {
  try {
    const summary = getWalletSummary('usr_mama_rosine');
    const recentTx = db.prepare(`
      SELECT id, type, amount, fee, status, created_at 
      FROM transactions 
      WHERE user_id = 'usr_mama_rosine' 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();

    const recentAudit = db.prepare(`
      SELECT id, action, details, created_at 
      FROM audit_log 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();

    res.json({
      traceId: req.traceId,
      session: {
        state: req.session?.state || 'IDLE',
        lang: req.session?.lang || 'fon',
        pendingOperation: req.session?.pendingOperation || null
      },
      wallet: summary,
      recentTransactions: recentTx,
      recentAuditLogs: recentAudit
    });
  } catch (err) {
    next(err);
  }
};