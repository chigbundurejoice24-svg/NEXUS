import { relations } from "drizzle-orm";
import {
  users,
  linkedWallets,
  businesses,
  businessMembers,
  businessWallets,
  accountAuditLogs,
  userWallets,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  linkedWallets: many(linkedWallets),
  businessMemberships: many(businessMembers),
  auditLogs: many(accountAuditLogs),
  legacyWallets: many(userWallets),
}));

export const linkedWalletsRelations = relations(linkedWallets, ({ one }) => ({
  user: one(users, { fields: [linkedWallets.userId], references: [users.id] }),
}));

export const businessesRelations = relations(businesses, ({ many }) => ({
  members: many(businessMembers),
  wallets: many(businessWallets),
}));

export const businessMembersRelations = relations(businessMembers, ({ one }) => ({
  business: one(businesses, { fields: [businessMembers.businessId], references: [businesses.id] }),
  user: one(users, { fields: [businessMembers.userId], references: [users.id] }),
}));

export const businessWalletsRelations = relations(businessWallets, ({ one }) => ({
  business: one(businesses, { fields: [businessWallets.businessId], references: [businesses.id] }),
}));

export const accountAuditLogsRelations = relations(accountAuditLogs, ({ one }) => ({
  user: one(users, { fields: [accountAuditLogs.userId], references: [users.id] }),
}));

export const userWalletsRelations = relations(userWallets, ({ one }) => ({
  user: one(users, { fields: [userWallets.userId], references: [users.id] }),
}));
