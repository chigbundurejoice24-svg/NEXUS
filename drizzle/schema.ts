import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  json,
  jsonb,
  bigint,
  numeric,
  index,
  uniqueIndex,
  serial,
  boolean,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────
export const roleEnum            = pgEnum("role",             ["user", "admin"]);
export const kycStatusEnum       = pgEnum("kyc_status",       ["NONE", "PENDING", "VERIFIED", "REJECTED"]);
export const walletTypeEnum      = pgEnum("wallet_type",      ["EMBEDDED", "EXTERNAL"]);
export const bizMemberRoleEnum   = pgEnum("biz_member_role",  ["ADMIN", "TREASURER", "VIEWER"]);
export const txStateEnum         = pgEnum("tx_state",         ["CREATED","QUOTED","SIMULATED","PENDING_SIGNATURE","SUBMITTED","CONFIRMED","SETTLED","FAILED","REVERSED"]);
export const ledgerTypeEnum      = pgEnum("ledger_type",      ["ASSET","LIABILITY","EQUITY","REVENUE","EXPENSE"]);
export const journalStatusEnum   = pgEnum("journal_status",   ["PENDING","POSTED","REVERSED"]);

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
export const users = pgTable("users", {
  id:                   serial("id").primaryKey(),
  openId:               varchar("open_id",              { length: 64  }).notNull().unique(),
  name:                 text("name"),
  email:                varchar("email",                { length: 320 }).unique(),
  emailVerified:        boolean("email_verified").default(false).notNull(),
  verificationCode:     varchar("verification_code",    { length: 6   }),
  codeExpiresAt:        timestamp("code_expires_at"),
  phone:                varchar("phone",                { length: 32  }).unique(),
  loginMethod:          varchar("login_method",         { length: 64  }),
  role:                 roleEnum("role").default("user").notNull(),
  credentialId:         varchar("credential_id",        { length: 512 }).unique(),
  publicKey:            text("public_key"),
  counter:              integer("counter").default(0).notNull(),
  recoveryCredentialId: varchar("recovery_credential_id", { length: 512 }),
  recoveryWallet:       varchar("recovery_wallet",      { length: 42  }),
  kycStatus:            kycStatusEnum("kyc_status").default("NONE").notNull(),
  suspended:            boolean("suspended").default(false).notNull(),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn:         timestamp("last_signed_in").defaultNow().notNull(),
  credentialHash:       varchar("credential_hash", { length: 64 }),
  walletAddress:        varchar("wallet_address",  { length: 42 }),
});
export type User        = typeof users.$inferSelect;
export type InsertUser  = typeof users.$inferInsert;

// ─────────────────────────────────────────────
// LINKED WALLETS
// ─────────────────────────────────────────────
export const linkedWallets = pgTable("linked_wallets", {
  id:           serial("id").primaryKey(),
  userId:       integer("user_id").notNull(),
  address:      varchar("address", { length: 42 }).notNull(),
  chainId:      integer("chain_id").notNull(),
  type:         walletTypeEnum("type").notNull(),
  label:        varchar("label", { length: 255 }),
  walletAnchor: varchar("wallet_anchor", { length: 64 }),  // 🔒 HMAC binding proof
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
export type LinkedWallet       = typeof linkedWallets.$inferSelect;
export type InsertLinkedWallet = typeof linkedWallets.$inferInsert;

// ─────────────────────────────────────────────
// BUSINESSES
// ─────────────────────────────────────────────
export const businesses = pgTable("businesses", {
  id:        serial("id").primaryKey(),
  name:      varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Business       = typeof businesses.$inferSelect;
export type InsertBusiness = typeof businesses.$inferInsert;

export const businessMembers = pgTable("business_members", {
  id:         serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  userId:     integer("user_id").notNull(),
  role:       bizMemberRoleEnum("role").notNull(),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
export type BusinessMember       = typeof businessMembers.$inferSelect;
export type InsertBusinessMember = typeof businessMembers.$inferInsert;

export const businessWallets = pgTable("business_wallets", {
  id:         serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  address:    varchar("address", { length: 42 }).notNull(),
  chainId:    integer("chain_id").notNull(),
  type:       walletTypeEnum("type").notNull(),
  label:      varchar("label", { length: 255 }),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type BusinessWallet       = typeof businessWallets.$inferSelect;
export type InsertBusinessWallet = typeof businessWallets.$inferInsert;

// ─────────────────────────────────────────────
// ACCOUNT AUDIT LOG
// ─────────────────────────────────────────────
export const accountAuditLogs = pgTable("account_audit_logs", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull(),
  action:    varchar("action", { length: 128 }).notNull(),
  details:   json("details"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
export type AccountAuditLog       = typeof accountAuditLogs.$inferSelect;
export type InsertAccountAuditLog = typeof accountAuditLogs.$inferInsert;

// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────
export const transactions = pgTable(
  "transactions",
  {
    id:               serial("id").primaryKey(),
    userId:           integer("user_id").notNull(),
    referenceId:      varchar("reference_id",      { length: 255 }).notNull(),
    idempotencyKey:   varchar("idempotency_key",   { length: 255 }),
    state:            txStateEnum("state").notNull().default("CREATED"),
    chainId:          integer("chain_id").notNull(),
    wallet:           varchar("wallet",            { length: 42  }).notNull(),
    recipient:        varchar("recipient",         { length: 42  }).notNull(),
    amountRaw:        bigint("amount_raw",         { mode: "bigint" }).notNull(),
    tokenDecimals:    integer("token_decimals").notNull(),
    feeRaw:           bigint("fee_raw",            { mode: "bigint" }).notNull(),
    discountBps:      integer("discount_bps").notNull().default(0),
    cozanetSnapshot:  varchar("cozanet_snapshot",  { length: 79  }),
    quoteExpiresAt:   timestamp("quote_expires_at"),
    requestHash:      varchar("request_hash",      { length: 66  }),
    txHash:           varchar("tx_hash",           { length: 66  }),
    metadata:         json("metadata"),
    riskFlags:        json("risk_flags"),
    createdAt:        timestamp("created_at").defaultNow().notNull(),
    updatedAt:        timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex("idempotency_key_idx").on(table.idempotencyKey),
    userIdx:        index("tx_user_idx").on(table.userId),
    stateIdx:       index("tx_state_idx").on(table.state),
  })
);
export type Transaction       = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type TransactionState  =
  | "CREATED" | "QUOTED" | "SIMULATED" | "PENDING_SIGNATURE"
  | "SUBMITTED" | "CONFIRMED" | "SETTLED" | "FAILED" | "REVERSED";

// ─────────────────────────────────────────────
// LEDGER ACCOUNTS
// ─────────────────────────────────────────────
export const ledgerAccounts = pgTable("ledger_accounts", {
  id:          serial("id").primaryKey(),
  accountCode: varchar("account_code", { length: 100 }).notNull().unique(),
  name:        varchar("name",         { length: 255 }).notNull(),
  type:        ledgerTypeEnum("type").notNull(),
  assetCode:   varchar("asset_code",   { length: 10  }).notNull(),
  balance:     numeric("balance",      { precision: 36, scale: 18 }).default("0").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type LedgerAccount = typeof ledgerAccounts.$inferSelect;

// ─────────────────────────────────────────────
// JOURNAL ENTRIES
// ─────────────────────────────────────────────
export const journalEntries = pgTable("journal_entries", {
  id:           serial("id").primaryKey(),
  referenceId:  varchar("reference_id", { length: 255 }).notNull(),
  reversalOfId: integer("reversal_of_id"),
  chainId:      integer("chain_id"),
  wallet:       varchar("wallet",       { length: 42  }),
  txHash:       varchar("tx_hash",      { length: 66  }),
  createdBy:    varchar("created_by",   { length: 100 }),
  description:  varchar("description",  { length: 500 }),
  status:       journalStatusEnum("status").default("POSTED").notNull(),
  postedAt:     timestamp("posted_at").defaultNow().notNull(),
  reversedAt:   timestamp("reversed_at"),
});
export type JournalEntry = typeof journalEntries.$inferSelect;

export const journalLines = pgTable("journal_lines", {
  id:             serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull(),
  accountId:      integer("account_id").notNull(),
  debit:          numeric("debit",  { precision: 36, scale: 18 }).default("0").notNull(),
  credit:         numeric("credit", { precision: 36, scale: 18 }).default("0").notNull(),
});
export type JournalLine = typeof journalLines.$inferSelect;

// ─────────────────────────────────────────────
// IDEMPOTENCY KEYS
// ─────────────────────────────────────────────
export const idempotencyKeys = pgTable("idempotency_keys", {
  id:          serial("id").primaryKey(),
  key:         varchar("key",          { length: 255 }).notNull().unique(),
  referenceId: varchar("reference_id", { length: 255 }).notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;

// ─────────────────────────────────────────────
// LEGACY SHIM (keep for backwards compat)
// ─────────────────────────────────────────────
export const userWallets = linkedWallets;

// ── Support / Customer Care ───────────────────────────────────────
export const ticketStatusEnum   = pgEnum("ticket_status",   ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const supportTickets = pgTable("support_tickets", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").notNull().references(() => users.id),
  subject:   varchar("subject",  { length: 255 }).notNull(),
  message:   text("message").notNull(),
  status:    ticketStatusEnum("status").default("OPEN").notNull(),
  priority:  ticketPriorityEnum("priority").default("MEDIUM").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const supportReplies = pgTable("support_replies", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  ticketId:  integer("ticket_id").notNull().references(() => supportTickets.id),
  userId:    integer("user_id").notNull().references(() => users.id),
  message:   text("message").notNull(),
  isAdmin:   boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Notifications (admin-broadcast + system) ──────────────────────
// Matches actual DB columns — no action_url or sent_by_admin (not in Neon schema)
export const notifications = pgTable("notifications", {
  id:        integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId:    integer("user_id").references(() => users.id), // NULL = broadcast to all
  title:     varchar("title",  { length: 255 }).notNull(),
  body:      text("body").notNull(),
  type:      varchar("type",   { length: 64 }).default("SYSTEM").notNull(),
  isRead:    boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Portfolio Snapshots (pre-computed dashboard data) ─────────────────────
export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  userId:        integer('user_id').notNull().references(() => users.id).unique(),
  totalValueUsd: numeric('total_value_usd', { precision: 20, scale: 2 }).notNull().default('0'),
  chainCount:    integer('chain_count').notNull().default(0),
  assetCount:    integer('asset_count').notNull().default(0),
  snapshot:      jsonb('snapshot').notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
