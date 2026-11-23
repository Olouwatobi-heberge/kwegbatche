// src/db/seed.js
const db = require('./connection');

function seed() {
  try {
    const now = Date.now();
    const userId = 'usr_mama_rosine';
    const walletId = 'wlt_mama_rosine';

    // 1. Désactiver temporairement les contraintes de clés étrangères pour nettoyer proprement
    db.pragma('foreign_keys = OFF');

    const runSeed = db.transaction(() => {
      // Nettoyage de toutes les tables
      const tables = [
        'audit_log',
        'transactions',
        'operations',
        'contacts',
        'budgets',
        'wallets',
        'users'
      ];

      for (const table of tables) {
        try {
          db.prepare(`DELETE FROM ${table}`).run();
        } catch (e) {
          // Ignore si la table n'existe pas encore
        }
      }

      // -------------------------------------------------------------
      // 1. UTILISATEUR : Persona Mama Rosine (avec phone & created_at)
      // -------------------------------------------------------------
      db.prepare(`
        INSERT INTO users (id, name, phone, preferred_lang, pin_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        'Mama Rosine',
        '+229 97 00 12 34',
        'fon',
        '1234',
        now - 86400000 * 30
      );

      // -------------------------------------------------------------
      // 2. PORTEFEUILLE (WALLET) : Solde 39 975 XOF (avec id & updated_at)
      // -------------------------------------------------------------
      db.prepare(`
        INSERT INTO wallets (id, user_id, balance, currency, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        walletId,
        userId,
        39975,
        'XOF',
        now
      );

      // -------------------------------------------------------------
      // 3. BUDGET (avec id, period, created_at)
      // -------------------------------------------------------------
      db.prepare(`
        INSERT INTO budgets (id, user_id, amount_limit, period, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'bdg_mois',
        userId,
        60000,
        'mois',
        now - 86400000 * 15
      );

      // -------------------------------------------------------------
      // 4. RÉPERTOIRE DE 12 CONTACTS BÉNINOIS RÉALISTES
      // -------------------------------------------------------------
      const insertContact = db.prepare(`
        INSERT INTO contacts (id, user_id, name, phone_fake, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const contacts = [
        { id: 'ct_koffi_01', name: 'Koffi', phone: '+229 97 00 01 02' },
        { id: 'ct_amina_02', name: 'Amina', phone: '+229 96 11 22 33' },
        { id: 'ct_moussa_03', name: 'Moussa', phone: '+229 95 44 55 66' },
        { id: 'ct_fola_04', name: 'Fola', phone: '+229 54 67 55 58' },
        { id: 'ct_ola_05', name: 'Ola', phone: '+229 95 12 13 91' },
        { id: 'ct_senami_06', name: 'Sènami', phone: '+229 97 45 89 12' },
        { id: 'ct_kpedetin_07', name: 'Kpèdétin', phone: '+229 61 23 45 67' },
        { id: 'ct_ayaba_08', name: 'Ayaba', phone: '+229 94 88 77 66' },
        { id: 'ct_bignon_09', name: 'Bignon', phone: '+229 66 10 20 30' },
        { id: 'ct_chabi_10', name: 'Chabi', phone: '+229 90 55 44 33' },
        { id: 'ct_fatou_11', name: 'Fatou', phone: '+229 51 02 03 04' },
        { id: 'ct_emmanuel_12', name: 'Emmanuel', phone: '+229 97 77 88 99' }
      ];

      for (const c of contacts) {
        insertContact.run(c.id, userId, c.name, c.phone, now - 86400000 * 10);
      }

      // -------------------------------------------------------------
      // 5. TRANSACTIONS HISTORIQUES (conforme au schéma SQL)
      // -------------------------------------------------------------
      const insertTx = db.prepare(`
        INSERT INTO transactions (id, user_id, wallet_id, operation_id, type, amount, fee, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertTx.run('tx_01', userId, walletId, null, 'envoi', 5000, 100, 'COMPLETED', now - 3600000 * 4);
      insertTx.run('tx_02', userId, walletId, null, 'envoi', 2000, 50, 'COMPLETED', now - 86400000 * 2);
      insertTx.run('tx_03', userId, walletId, null, 'envoi', 5000, 100, 'COMPLETED', now - 86400000 * 5);
      insertTx.run('tx_04', userId, walletId, null, 'reception', 20000, 0, 'COMPLETED', now - 86400000 * 7);
    });

    // Exécution de la transaction
    runSeed();

    // 2. Réactivation des contraintes de clés étrangères
    db.pragma('foreign_keys = ON');

    console.log('✅ Base de données initialisée avec succès (Mama Rosine + 12 contacts + Wallet 39 975 XOF).');
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de la BDD :", error.message);
    throw error;
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;