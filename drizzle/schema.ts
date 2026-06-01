import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 32 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  credentialId: varchar("credentialId", { length: 512 }).unique(),
  publicKey: text("publicKey"),
  counter: int("counter").default(0).notNull(),
  recoveryCredentialId: varchar("recoveryCredentialId", { length: 512 }),
  recoveryWallet: varchar("recoveryWallet", { length: 42 }),
  kycStatus: mysqlEnum("kycStatus", ["NONE", "PENDING", "VERIFIED", "REJECTED"])
    .default("NONE")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────
// LINKED WALLETS (personal, chain-aware)
// ─────────────────────────────────────────────
export const linkedWallets = mysqlTable("linked_wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  address: varchar("address", { length: 42 }).notNull(),
  chainId: int("chainId").notNull(),
  type: mysqlEnum("type", ["EMBEDDED", "EXTERNAL"]).notNull(),
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LinkedWallet = typeof linkedWallets.$inferSelect;
export type InsertLinkedWallet = typeof linkedWallets.$inferInsert;

// ─────────────────────────────────────────────
// BUSINESSES
// ─────────────────────────────────────────────
export const businesses = mysqlTable("businesses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;

// ─────────────────────────────────────────────
// BUSINESS MEMBERS
// ─────────────────────────────────────────────
export const businessMembers = mysqlTable("business_members", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["ADMIN", "TREASURER", "VIEWER"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type BusinessMember = typeof businessMembers.$inferSelect;
export type InsertBusinessMember = typeof businessMembers.$inferInsert;

// ─────────────────────────────────────────────
// BUSINESS WALLETS
// ─────────────────────────────────────────────
export const businessWallets = mysqlTable("business_wallets", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull(),
  address: varchar("address", { length: 42 }).notNull(),
  chainId: int("chainId").notNull(),
  type: mysqlEnum("type", ["EMBEDDED", "EXTERNAL"]).notNull(),
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BusinessWallet = typeof businessWallets.$inferSelect;
export type InsertBusinessWallet = typeof businessWallets.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNT AUDIT LOG
// ─────────────────────────────────────────────
export const accountAuditLogs = mysqlTable("account_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  details: json("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
export type AccountAuditLog = typeof accountAuditLogs.$inferSelect;
export type InsertAccountAuditLog = typeof accountAuditLogs.$inferInsert;

// ─────────────────────────────────────────────
// TRANSACTIONS  (Phase 1 — Transaction State Machine)
// ─────────────────────────────────────────────
// NOTE: userId is int (FK → users.id) — consistent with this codebase.
// amountRaw and feeRaw are bigint to avoid floating-point precision loss.
// idempotencyKey has a UNIQUE INDEX for race-proof deduplication.
// ─────────────────────────────────────────────
export const transactionStateEnum = mysqlEnum("transaction_state", [
  "CREATED",
  "QUOTED",
  "SIMULATED",
  "PENDING_SIGNATURE",
  "SUBMITTED",
  "CONFIRMED",
  "SETTLED",
  "FAILED",
  "REVERSED",
]);

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),                                      // FK → users.id
    referenceId: varchar("reference_id", { length: 255 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),

    state: transactionStateEnum.notNull().default("CREATED"),

    chainId: int("chain_id").notNull(),
    wallet: varchar("wallet", { length: 42 }).notNull(),
    recipient: varchar("recipient", { length: 42 }).notNull(),

    // Amounts in smallest token unit — no decimals, no precision loss
    amountRaw: bigint("amount_raw", { mode: "bigint" }).notNull(),
    tokenDecimals: int("token_decimals").notNull(),
    feeRaw: bigint("fee_raw", { mode: "bigint" }).notNull(),
    discountBps: int("discount_bps").notNull().default(0),

    // Snapshot of CZN balance at quote time (for audit, stored as decimal string)
    cozanetSnapshot: varchar("cozanet_snapshot", { length: 79 }),

    // Quote expires after 5 minutes — checked before SIMULATED transition
    quoteExpiresAt: timestamp("quote_expires_at"),

    // keccak256 hash of (recipient, amountRaw, tokenDecimals, chainId, wallet, feeRaw)
    // Used to detect replayed/tampered requests
    requestHash: varchar("request_hash", { length: 66 }),

    txHash: varchar("tx_hash", { length: 66 }),
    metadata: json("metadata"),
    riskFlags: json("risk_flags"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("idempotency_key_idx").on(table.idempotencyKey),
    userIdx: index("tx_user_idx").on(table.userId),
    stateIdx: index("tx_state_idx").on(table.state),
  })
);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type TransactionState = typeof transactionStateEnum.enumValues[number];

// ─────────────────────────────────────────────
// LEGACY — kept for backwards compat
// ─────────────────────────────────────────────
export const userWallets = mysqlTable("user_wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  address: varchar("address", { length: 42 }).notNull(),
  label: varchar("label", { length: 255 }),
  isActive: mysqlEnum("isActive", ["true", "false"]).default("true").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type UserWallet = typeof userWallets.$inferSelect;
export type InsertUserWallet = typeof userWallets.$inferInsert;
