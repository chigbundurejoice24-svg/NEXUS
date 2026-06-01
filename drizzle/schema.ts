import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  boolean,
} from "drizzle-orm/mysql-core";

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier – unique per user */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 32 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),

  // ── WebAuthn / Passkey fields ──────────────
  // Only credential metadata is stored – private key never touches the server
  credentialId: varchar("credentialId", { length: 512 }).unique(),
  publicKey: text("publicKey"),
  counter: int("counter").default(0).notNull(),

  // ── Recovery ──────────────────────────────
  recoveryCredentialId: varchar("recoveryCredentialId", { length: 512 }),
  recoveryWallet: varchar("recoveryWallet", { length: 42 }),

  // ── KYC ───────────────────────────────────
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
// LINKED WALLETS (personal)
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
// LEGACY – kept for backwards compat with existing db.ts wallet queries
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
