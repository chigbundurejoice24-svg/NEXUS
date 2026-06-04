/**
 * api/db-setup.ts — ONE-TIME endpoint to initialise the Neon PostgreSQL tables.
 * Protected by CRON_SECRET. Call once after first deploy.
 *
 * Usage:
 *   curl -X POST https://<domain>/api/db-setup \
 *        -H "x-setup-secret: <CRON_SECRET>"
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.headers["x-setup-secret"] as string;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return res.status(500).json({ error: "DATABASE_URL not set" });

  const SQL = `
DO $$ BEGIN CREATE TYPE role AS ENUM ('user', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kyc_status AS ENUM ('NONE','PENDING','VERIFIED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE wallet_type AS ENUM ('EMBEDDED','EXTERNAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE biz_member_role AS ENUM ('ADMIN','TREASURER','VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tx_state AS ENUM ('CREATED','QUOTED','SIMULATED','PENDING_SIGNATURE','SUBMITTED','CONFIRMED','SETTLED','FAILED','REVERSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_status AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE ticket_priority AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, open_id VARCHAR(64) NOT NULL UNIQUE, name TEXT,
  email VARCHAR(320) UNIQUE, email_verified BOOLEAN NOT NULL DEFAULT false,
  verification_code VARCHAR(6), code_expires_at TIMESTAMP, phone VARCHAR(32) UNIQUE,
  login_method VARCHAR(64), role role NOT NULL DEFAULT 'user',
  credential_id VARCHAR(512) UNIQUE, public_key TEXT, counter INTEGER NOT NULL DEFAULT 0,
  recovery_credential_id VARCHAR(512), recovery_wallet VARCHAR(42),
  kyc_status kyc_status NOT NULL DEFAULT 'NONE', suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS linked_wallets (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL, chain_id INTEGER NOT NULL, type wallet_type NOT NULL,
  label VARCHAR(255), created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, address, chain_id)
);
CREATE INDEX IF NOT EXISTS idx_lw_user ON linked_wallets(user_id);

CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_members (
  id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role biz_member_role NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS business_wallets (
  id SERIAL PRIMARY KEY, business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  address VARCHAR(42) NOT NULL, chain_id INTEGER NOT NULL, type wallet_type NOT NULL,
  label VARCHAR(255), created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE (business_id, address, chain_id)
);

CREATE TABLE IF NOT EXISTS account_audit_logs (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(128) NOT NULL, metadata JSONB, ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aal_user ON account_audit_logs(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  reference_id VARCHAR(255) NOT NULL, idempotency_key VARCHAR(255) UNIQUE,
  state tx_state NOT NULL DEFAULT 'CREATED', chain_id INTEGER NOT NULL,
  wallet VARCHAR(42) NOT NULL, recipient VARCHAR(42) NOT NULL,
  amount_raw BIGINT NOT NULL, token_decimals INTEGER NOT NULL, fee_raw BIGINT NOT NULL,
  discount_bps INTEGER NOT NULL DEFAULT 0, cozanet_snapshot VARCHAR(79),
  quote_expires_at TIMESTAMP, request_hash VARCHAR(66), tx_hash VARCHAR(66),
  metadata JSON, risk_flags JSON,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tx_user  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_state ON transactions(state);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
  total_value_usd NUMERIC(20,2) NOT NULL DEFAULT 0,
  chain_count INTEGER NOT NULL DEFAULT 0, asset_count INTEGER NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  subject VARCHAR(255) NOT NULL, message TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'OPEN',
  priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_st_user ON support_tickets(user_id);

CREATE TABLE IF NOT EXISTS support_replies (
  id SERIAL PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id), message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL, body TEXT NOT NULL, type VARCHAR(64),
  is_read BOOLEAN NOT NULL DEFAULT false, data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
  `;

  try {
    const { Pool } = require("@neondatabase/serverless");
    const pool = new Pool({ connectionString: dbUrl });
    await pool.query(SQL);
    await pool.end();
    return res.json({ ok: true, message: "All tables created / verified." });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
