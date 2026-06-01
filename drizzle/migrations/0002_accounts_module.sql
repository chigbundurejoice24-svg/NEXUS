-- Migration: 0002_accounts_module
-- Adds: linked_wallets, businesses, business_members, business_wallets, account_audit_logs
-- Extends: users table with passkey + KYC + recovery fields

-- Extend users
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `phone` VARCHAR(32) UNIQUE,
  ADD COLUMN IF NOT EXISTS `credentialId` VARCHAR(512) UNIQUE,
  ADD COLUMN IF NOT EXISTS `publicKey` TEXT,
  ADD COLUMN IF NOT EXISTS `counter` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `recoveryCredentialId` VARCHAR(512),
  ADD COLUMN IF NOT EXISTS `recoveryWallet` VARCHAR(42),
  ADD COLUMN IF NOT EXISTS `kycStatus` ENUM('NONE','PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'NONE';

-- Linked wallets (personal, chain-aware)
CREATE TABLE IF NOT EXISTS `linked_wallets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `address` VARCHAR(42) NOT NULL,
  `chainId` INT NOT NULL,
  `type` ENUM('EMBEDDED','EXTERNAL') NOT NULL,
  `label` VARCHAR(255),
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_user_address_chain` (`userId`, `address`, `chainId`),
  CONSTRAINT `fk_lw_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Businesses
CREATE TABLE IF NOT EXISTS `businesses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- Business members
CREATE TABLE IF NOT EXISTS `business_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `businessId` INT NOT NULL,
  `userId` INT NOT NULL,
  `role` ENUM('ADMIN','TREASURER','VIEWER') NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE KEY `uq_biz_member` (`businessId`, `userId`),
  CONSTRAINT `fk_bm_business` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bm_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

-- Business wallets
CREATE TABLE IF NOT EXISTS `business_wallets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `businessId` INT NOT NULL,
  `address` VARCHAR(42) NOT NULL,
  `chainId` INT NOT NULL,
  `type` ENUM('EMBEDDED','EXTERNAL') NOT NULL,
  `label` VARCHAR(255),
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_biz_address_chain` (`businessId`, `address`, `chainId`),
  CONSTRAINT `fk_bw_business` FOREIGN KEY (`businessId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE
);

-- Audit log
CREATE TABLE IF NOT EXISTS `account_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `action` VARCHAR(128) NOT NULL,
  `details` JSON,
  `timestamp` TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT `fk_al_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
