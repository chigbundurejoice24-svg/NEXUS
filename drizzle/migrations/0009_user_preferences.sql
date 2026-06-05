-- Migration: add user_preferences table
-- Survives upgrades — stores theme, country, currency per user

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme         VARCHAR(16) DEFAULT 'light',
  country       VARCHAR(8),
  currency      VARCHAR(8),
  language      VARCHAR(16) DEFAULT 'en',
  notifications BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
