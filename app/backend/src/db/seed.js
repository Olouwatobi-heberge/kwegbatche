const db = require('./connection');

function seed() {
  const reset = db.transaction(() => {
    // Nettoyage
    db.prepare('DELETE FROM audit_log').run();
    db.prepare('DELETE FROM operations').run();
    db.prepare('DELETE FROM transactions').run();
    db.prepare('DELETE FROM contacts').run();
    db.prepare('DELETE FROM budgets').run();
    db.prepare('DELETE FROM wallets').run();
    db.prepare('DELETE FROM users').run();

    // Insertion Persona Mama Rosine
    const userId = 'usr_mama_rosine';
    db.prepare(`
      INSERT INTO users (id, name, preferred_lang, pin_demo)
      VALUES (?, ?, ?, ?)
    `).run(userId, 'Mama Rosine', 'fon', '1234');

    // Solde fictif : 42.500 FCFA
    db.prepare(`
      INSERT INTO wallets (user_id, balance, currency)
      VALUES (?, ?, ?)
    `).run(userId, 42500, 'XOF');

    // Budget semaine
    db.prepare(`
      INSERT INTO budgets (id, user_id, period, amount_limit)
      VALUES (?, ?, ?, ?)
    `).run('bdg_semaine', userId, 'semaine', 50000);

    // Contacts
    const insertContact = db.prepare(`
      INSERT INTO contacts (id, user_id, name, phone_fake) VALUES (?, ?, ?, ?)
    `);
    insertContact.run('ct_koffi_1', userId, 'Koffi', '+229 97 00 00 01');
    insertContact.run('ct_moussa_2', userId, 'Moussa', '+229 95 00 00 02');

    // Historique de transaction fictif
    const insertTx = db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount, fee, recipient_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    insertTx.run('tx_1', userId, 'envoi', 2000, 50, 'Moussa', now - 86400000);
    insertTx.run('tx_2', userId, 'envoi', 5000, 100, 'Koffi', now - 172800000);
  });

  reset();
  console.log('✅ Base de données initialisée avec les données de démonstration (Mama Rosine).');
}

if (require.main === module) {
  seed();
}

module.exports = seed;