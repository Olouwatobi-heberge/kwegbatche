-- src/db/schema.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  preferred_lang TEXT DEFAULT 'fon', 
  pin_demo TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'XOF',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount_limit INTEGER NOT NULL,
  period TEXT DEFAULT 'semaine',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_fake TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  recipient_id TEXT,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  total_debit INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'PREPARED', 'COMPLETED', 'CANCELLED', 'EXPIRED'
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  operation_id TEXT UNIQUE,
  type TEXT NOT NULL, -- 'envoi', 'reception', 'frais'
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'COMPLETED', 'FAILED'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id),
  FOREIGN KEY (operation_id) REFERENCES operations(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT,
  details TEXT,
  trace_id TEXT,
  created_at INTEGER NOT NULL
);