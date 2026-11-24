const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const db = new Database(config.dbPath);

// Activation du mode WAL pour de meilleures performances d'écriture
db.pragma('journal_mode = WAL');

function initDb() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schemaSql);
}

initDb();

module.exports = db;