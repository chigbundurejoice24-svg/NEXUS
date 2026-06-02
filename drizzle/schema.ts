import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  decimal,
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
// TRANSACTIONS
// ─────────────────────────────────────────────
export const transactionStateEnum = mysqlEnum("transaction_state", [
  "CREATED", "QUOTED", "SIMULATED", "PENDING_SIGNATURE",
  "SUBMITTED", "CONFIRMED", "SETTLED", "FAILED", "REVERSED",
]);

export const transactions = mysqlTable(
  "transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    referenceId: varchar("reference_id", { length: 255 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }),
    state: transactionStateEnum.notNull().default("CREATED"),
    chainId: int("chain_id").notNull(),
    wallet: varchar("wallet", { length: 42 }).notNull(),
    recipient: varchar("recipient", { length: 42 }).notNull(),
    amountRaw: bigint("amount_raw", { mode: "bigint" }).notNull(),
    tokenDecimals: int("token_decimals").notNull(),
    feeRaw: bigint("fee_raw", { mode: "bigint" }).notNull(),
    discountBps: int("discount_bps").notNull().default(0),
    cozanetSnapshot: varchar("cozanet_snapshot", { length: 79 }),
    quoteExpiresAt: timestamp("quote_expires_at"),
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
// LEDGER ACCOUNTS (double-entry backbone)
// ─────────────────────────────────────────────
export const ledgerAccounts = mysqlTable("ledger_accounts", {
  id: int("id").autoincrement().primaryKey(),
  accountCode: varchar("account_code", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]).notNull(),
  assetCode: varchar("asset_code", { length: 10 }).notNull(),
  balance: decimal("balance", { precision: 36, scale: 18 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LedgerAccount = typeof ledgerAccounts.$inferSelect;

// ─────────────────────────────────────────────
// JOURNAL ENTRIES (one per settlement event)
// ─────────────────────────────────────────────
export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  referenceId: varchar("reference_id", { length: 255 }).notNull(),
  reversalOfId: int("reversal_of_id"),
  chainId: int("chain_id"),
  wallet: varchar("wallet", { length: 42 }),
  txHash: varchar("tx_hash", { length: 66 }),
  createdBy: varchar("created_by", { length: 100 }),
  description: varchar("description", { length: 500 }),
  status: mysqlEnum("status", ["PENDING", "POSTED", "REVERSED"]).default("POSTED").notNull(),
  postedAt: timestamp("posted_at").defaultNow().notNull(),
  reversedAt: timestamp("reversed_at"),
});
export type JournalEntry = typeof journalEntries.$inferSelect;

// ─────────────────────────────────────────────
// JOURNAL LINES (debit / credit legs)
// ─────────────────────────────────────────────
export const journalLines = mysqlTable("journal_lines", {
  id: int("id").autoincrement().primaryKey(),
  journalEntryId: int("journal_entry_id").notNull(),
  accountId: int("account_id").notNull(),
  debit: decimal("debit", { precision: 36, scale: 18 }).default("0").notNull(),
  credit: decimal("credit", { precision: 36, scale: 18 }).default("0").notNull(),
});
export type JournalLine = typeof journalLines.$inferSelect;

// ─────────────────────────────────────────────
// IDEMPOTENCY KEYS (prevent duplicate ops)
// ─────────────────────────────────────────────
export const idempotencyKeys = mysqlTable("idempotency_keys", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  referenceId: varchar("reference_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;

// ─────────────────────────────────────────────
// LEGACY — backwards compat
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
