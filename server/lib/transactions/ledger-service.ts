/**
 * ledger-service.ts
 * Interface contract for the Ledger Engine.
 * The transaction state machine calls this during QUOTED and SETTLED transitions.
 * Replace StubLedgerService with the real LedgerEngine once Phase 2 is built.
 */

export interface LedgerService {
  postFeeEntry(params: {
    userId: number;       // int — matches users.id in this codebase
    amount: bigint;
    tokenDecimals: number;
    referenceId: string;
  }): Promise<void>;

  postSettlementEntry(params: {
    userId: number;
    amount: bigint;
    fee: bigint;
    tokenDecimals: number;
    referenceId: string;
    txHash?: string | null;
  }): Promise<void>;
}

/**
 * Stub implementation — logs to console until the real ledger is built.
 * Wire this in until Phase 2 LedgerEngine is complete.
 */
export class StubLedgerService implements LedgerService {
  async postFeeEntry(params: Parameters<LedgerService["postFeeEntry"]>[0]): Promise<void> {
    console.log("[Ledger:FEE]", {
      userId: params.userId,
      amount: params.amount.toString(),
      tokenDecimals: params.tokenDecimals,
      referenceId: params.referenceId,
    });
  }

  async postSettlementEntry(
    params: Parameters<LedgerService["postSettlementEntry"]>[0]
  ): Promise<void> {
    console.log("[Ledger:SETTLEMENT]", {
      userId: params.userId,
      amount: params.amount.toString(),
      fee: params.fee.toString(),
      tokenDecimals: params.tokenDecimals,
      referenceId: params.referenceId,
      txHash: params.txHash,
    });
  }
}
