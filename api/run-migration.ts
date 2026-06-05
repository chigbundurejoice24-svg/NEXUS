/**
 * /api/run-migration — Admin-only endpoint to apply pending DB migrations
 * POST /api/run-migration with header X-Admin-Key: <ADMIN_MIGRATION_KEY env var>
 * Applies drizzle/migrations/0004_wallet_registry.sql safely
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../server/db";

const ADMIN_KEY = process.env.ADMIN_MIGRATION_KEY ?? "aegis-migrate-dev";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (req.headers["x-admin-key"] !== ADMIN_KEY) return res.status(403).json({ error: "Forbidden" });

  const db = await getDb();
  if (!db) return res.status(503).json({ error: "DB unavailable" });

  const results: string[] = [];

  try {
    // Step 1: Add missing columns to users
    await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS credential_hash VARCHAR(64)`);
    results.push("✅ users.credential_hash");

    await db.execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42)`);
    results.push("✅ users.wallet_address");

    // Step 2: Add wallet_anchor to linked_wallets
    await db.execute(`ALTER TABLE linked_wallets ADD COLUMN IF NOT EXISTS wallet_anchor VARCHAR(64)`);
    results.push("✅ linked_wallets.wallet_anchor");

    // Step 3: Fix ON DELETE CASCADE → RESTRICT on linked_wallets
    // Only if the old constraint exists
    try {
      await db.execute(`ALTER TABLE linked_wallets DROP CONSTRAINT IF EXISTS linked_wallets_user_id_fkey`);
      await db.execute(`ALTER TABLE linked_wallets ADD CONSTRAINT linked_wallets_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT`);
      results.push("✅ linked_wallets FK → ON DELETE RESTRICT");
    } catch (e: any) {
      results.push(`⚠️  FK constraint: ${e.message?.slice(0,80)}`);
    }

    // Step 4: Create wallet_registry vault
    await db.execute(`
      CREATE TABLE IF NOT EXISTS wallet_registry (
        id              SERIAL PRIMARY KEY,
        email           VARCHAR(320) NOT NULL,
        wallet_address  VARCHAR(42)  NOT NULL,
        credential_hash VARCHAR(64)  NOT NULL,
        open_id         VARCHAR(64)  NOT NULL,
        user_id         INTEGER      NOT NULL,
        network         VARCHAR(32)  NOT NULL DEFAULT 'BSC',
        chain_id        INTEGER      NOT NULL DEFAULT 56,
        locked_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
        UNIQUE (email),
        UNIQUE (wallet_address),
        UNIQUE (user_id)
      )
    `);
    results.push("✅ wallet_registry table created");

    await db.execute(`CREATE INDEX IF NOT EXISTS idx_wr_email   ON wallet_registry(email)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_wr_address ON wallet_registry(wallet_address)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_wr_user_id ON wallet_registry(user_id)`);
    results.push("✅ wallet_registry indexes");

    // Step 5: Backfill existing users into vault
    const { rowCount } = await db.execute(`
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
      ON CONFLICT DO NOTHING
    `);
    results.push(`✅ backfilled ${rowCount ?? 0} existing users into vault`);

    return res.status(200).json({ success: true, results });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message, results });
  }
}
