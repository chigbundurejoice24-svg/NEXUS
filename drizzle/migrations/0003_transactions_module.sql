-- Migration: 0003_transactions_module
-- Adds: transactions table with state machine, idempotency, bigint amounts, risk flags

CREATE TABLE IF NOT EXISTS `transactions` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`            INT NOT NULL,
  `reference_id`       VARCHAR(255) NOT NULL,
  `idempotency_key`    VARCHAR(255),
  `state`              ENUM(
                         'CREATED','QUOTED','SIMULATED','PENDING_SIGNATURE',
                         'SUBMITTED','CONFIRMED','SETTLED','FAILED','REVERSED'
                       ) NOT NULL DEFAULT 'CREATED',
  `chain_id`           INT NOT NULL,
  `wallet`             VARCHAR(42) NOT NULL,
  `recipient`          VARCHAR(42) NOT NULL,
  `amount_raw`         BIGINT NOT NULL,
  `token_decimals`     INT NOT NULL,
  `fee_raw`            BIGINT NOT NULL,
  `discount_bps`       INT NOT NULL DEFAULT 0,
  `cozanet_snapshot`   VARCHAR(79),
  `quote_expires_at`   TIMESTAMP NULL,
  `request_hash`       VARCHAR(66),
  `tx_hash`            VARCHAR(66),
  `metadata`           JSON,
  `risk_flags`         JSON,
  `created_at`         TIMESTAMP NOT NULL DEFAULT NOW(),
  `updated_at`         TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),

  UNIQUE KEY `idempotency_key_idx` (`idempotency_key`),
  KEY `tx_user_idx` (`user_id`),
  KEY `tx_state_idx` (`state`),
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
);
