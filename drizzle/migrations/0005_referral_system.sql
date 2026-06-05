-- 0005_referral_system.sql
-- Referral codes and tracking table
-- Run via /api/run-migration (POST with x-admin-key)

CREATE TABLE IF NOT EXISTS referral_codes (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  code       VARCHAR(16) NOT NULL UNIQUE,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rc_code    ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_rc_user_id ON referral_codes(user_id);

CREATE TABLE IF NOT EXISTS referrals (
  id              SERIAL PRIMARY KEY,
  referrer_id     INTEGER NOT NULL REFERENCES users(id),
  referee_id      INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  code            VARCHAR(16) NOT NULL,
  reward_paid     BOOLEAN NOT NULL DEFAULT false,
  reward_paid_at  TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ref_referrer ON referrals(referrer_id);
