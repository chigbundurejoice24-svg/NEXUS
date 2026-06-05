-- ================================================================
-- CRITICAL MIGRATION — Run on Neon ONCE
-- Adds wallet security columns missing from original schema
-- ================================================================

-- 1. Add missing columns to users table (safe, IF NOT EXISTS)
ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address  VARCHAR(42);

-- 2. Add wallet_anchor to linked_wallets (safe)
ALTER TABLE linked_wallets ADD COLUMN IF NOT EXISTS wallet_anchor VARCHAR(64);

-- 3. Remove ON DELETE CASCADE from linked_wallets (CRITICAL)
--    Wallets must NEVER be deleted when user row is touched
ALTER TABLE linked_wallets DROP CONSTRAINT IF EXISTS linked_wallets_user_id_fkey;
ALTER TABLE linked_wallets ADD CONSTRAINT linked_wallets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- 4. THE VAULT — permanent email→wallet registry
--    Written ONCE at account creation. NEVER updated. NEVER deleted.
--    This is the final recovery source if everything else is lost.
CREATE TABLE IF NOT EXISTS wallet_registry (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(320) NOT NULL,
  wallet_address VARCHAR(42)  NOT NULL,
  credential_hash VARCHAR(64) NOT NULL,
  open_id        VARCHAR(64)  NOT NULL,
  user_id        INTEGER      NOT NULL,
  network        VARCHAR(32)  NOT NULL DEFAULT 'BSC',
  chain_id       INTEGER      NOT NULL DEFAULT 56,
  locked_at      TIMESTAMP    NOT NULL DEFAULT NOW(),

  -- Immutability guards
  UNIQUE (email),           -- one wallet per email, forever
  UNIQUE (wallet_address),  -- one email per wallet, forever
  UNIQUE (user_id)          -- one registry entry per account
);
-- NO foreign keys — this table must survive even if users table is corrupted
-- NO CASCADE — never touch this table via triggers
CREATE INDEX IF NOT EXISTS idx_wr_email   ON wallet_registry(email);
CREATE INDEX IF NOT EXISTS idx_wr_address ON wallet_registry(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wr_user_id ON wallet_registry(user_id);

-- 5. Backfill existing users into wallet_registry (safe, ON CONFLICT DO NOTHING)
INSERT INTO wallet_registry (email, wallet_address, credential_hash, open_id, user_id, locked_at)
SELECT
  u.email,
  COALESCE(u.wallet_address, lw.address),
  COALESCE(u.credential_hash, ''),
  u.open_id,
  u.id,
  NOW()
FROM users u
LEFT JOIN linked_wallets lw ON lw.user_id = u.id AND lw.type = 'EMBEDDED'
WHERE u.email IS NOT NULL
  AND COALESCE(u.wallet_address, lw.address) IS NOT NULL
ON CONFLICT DO NOTHING;
