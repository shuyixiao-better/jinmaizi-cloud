PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(username) BETWEEN 3 AND 32),
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 64),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK(password_iterations >= 100000),
  role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'SUB_ACCOUNT')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK(session_version >= 1),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_version INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  card_no TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(card_no) BETWEEN 3 AND 64),
  balance_cents INTEGER NOT NULL DEFAULT 0 CHECK(balance_cents >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'DISABLED')),
  remark TEXT NOT NULL DEFAULT '' CHECK(length(remark) <= 500),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  card_id TEXT NOT NULL REFERENCES cards(id),
  card_no TEXT NOT NULL,
  operator_user_id TEXT NOT NULL REFERENCES users(id),
  operator_username TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('INITIAL', 'INCREASE', 'DECREASE')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0 AND amount_cents <= 100000000000),
  remark TEXT NOT NULL DEFAULT '' CHECK(length(remark) <= 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip TEXT,
  user_agent TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_cards_card_no ON cards(card_no);
CREATE INDEX idx_transactions_card_id ON transactions(card_id);
CREATE INDEX idx_transactions_operator_user_id ON transactions(operator_user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_operator_created ON transactions(operator_user_id, created_at);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- 余额只能由不可变流水驱动。触发器在同一条 INSERT 中完成校验与原子更新，
-- D1 串行化写入，因此并发扣减不会产生负余额或无流水余额变化。
CREATE TRIGGER transactions_validate_before_insert
BEFORE INSERT ON transactions
BEGIN
  SELECT RAISE(ABORT, 'CARD_NOT_FOUND')
  WHERE NOT EXISTS (SELECT 1 FROM cards WHERE id = NEW.card_id);

  SELECT RAISE(ABORT, 'CARD_DISABLED')
  WHERE NEW.transaction_type IN ('INCREASE', 'DECREASE')
    AND (SELECT status FROM cards WHERE id = NEW.card_id) != 'ACTIVE';

  SELECT RAISE(ABORT, 'INSUFFICIENT_BALANCE')
  WHERE NEW.transaction_type = 'DECREASE'
    AND (SELECT balance_cents FROM cards WHERE id = NEW.card_id) < NEW.amount_cents;

  SELECT RAISE(ABORT, 'CARD_SNAPSHOT_MISMATCH')
  WHERE NEW.card_no != (SELECT card_no FROM cards WHERE id = NEW.card_id);
END;

CREATE TRIGGER transactions_apply_balance_after_insert
AFTER INSERT ON transactions
BEGIN
  UPDATE cards
  SET balance_cents = balance_cents + NEW.amount_cents,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.card_id
    AND NEW.transaction_type IN ('INITIAL', 'INCREASE');

  UPDATE cards
  SET balance_cents = balance_cents - NEW.amount_cents,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.card_id
    AND NEW.transaction_type = 'DECREASE';
END;

CREATE TRIGGER transactions_immutable_update
BEFORE UPDATE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'TRANSACTION_IMMUTABLE');
END;

CREATE TRIGGER transactions_immutable_delete
BEFORE DELETE ON transactions
BEGIN
  SELECT RAISE(ABORT, 'TRANSACTION_IMMUTABLE');
END;

CREATE TRIGGER audit_logs_immutable_update
BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'AUDIT_IMMUTABLE'); END;
CREATE TRIGGER audit_logs_immutable_delete
BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'AUDIT_IMMUTABLE'); END;
