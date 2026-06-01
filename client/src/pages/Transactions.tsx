import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Download, PlusCircle, ArrowLeftRight,
  Search, Filter, ChevronDown, Wallet, RefreshCw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUnits } from "viem";

type TxState =
  | "CREATED" | "QUOTED" | "SIMULATED" | "PENDING_SIGNATURE"
  | "SUBMITTED" | "CONFIRMED" | "SETTLED" | "FAILED" | "REVERSED";

const STATE_BADGE: Record<TxState, { label: string; color: string }> = {
  CREATED:           { label: "Created",           color: "bg-gray-100 dark:bg-gray-800 text-aegis-secondary-dark" },
  QUOTED:            { label: "Quoted",            color: "bg-blue-50 dark:bg-blue-900/20 text-blue-500" },
  SIMULATED:         { label: "Simulated",         color: "bg-purple-50 dark:bg-purple-900/20 text-aegis-accent-purple" },
  PENDING_SIGNATURE: { label: "Awaiting Sig",      color: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500" },
  SUBMITTED:         { label: "Submitted",         color: "bg-blue-50 dark:bg-blue-900/20 text-blue-500" },
  CONFIRMED:         { label: "Confirmed",         color: "bg-green-50 dark:bg-green-900/20 text-aegis-success-green" },
  SETTLED:           { label: "Settled",           color: "bg-green-50 dark:bg-green-900/20 text-aegis-success-green" },
  FAILED:            { label: "Failed",            color: "bg-red-50 dark:bg-red-900/20 text-red-500" },
  REVERSED:          { label: "Reversed",          color: "bg-orange-50 dark:bg-orange-900/20 text-orange-500" },
};

const filterOptions = ["All", "SETTLED", "PENDING_SIGNATURE", "FAILED", "CREATED"];

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [showDropdown, setShowDropdown] = useState(false);

  const { data, isLoading, refetch, isRefetching } = trpc.transactions.list.useQuery(
    { limit: 100 },
    { staleTime: 15_000 }
  );

  const txs = (data ?? []).filter((tx) => {
    const matchState = stateFilter === "All" || tx.state === stateFilter;
    const matchSearch =
      tx.referenceId.toLowerCase().includes(search.toLowerCase()) ||
      tx.recipient.toLowerCase().includes(search.toLowerCase()) ||
      tx.wallet.toLowerCase().includes(search.toLowerCase());
    return matchState && matchSearch;
  });

  function formatAmount(raw: bigint, decimals: number) {
    return parseFloat(formatUnits(raw, decimals)).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  }

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-aegis-secondary-dark">Your on-chain transaction history</p>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-1.5 text-xs text-aegis-tertiary-dark hover:text-aegis-accent-purple transition-colors"
        >
          <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-aegis-tertiary-dark" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, wallet, or recipient..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-aegis-primary-dark dark:text-white placeholder:text-aegis-tertiary-dark focus:outline-none focus:ring-2 focus:ring-aegis-accent-purple/30 focus:border-aegis-accent-purple transition-all"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-aegis-secondary-dark hover:bg-aegis-bg-elevated transition-colors"
          >
            <Filter size={16} />
            {stateFilter === "All" ? "All States" : STATE_BADGE[stateFilter as TxState]?.label ?? stateFilter}
            <ChevronDown size={14} />
          </button>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10 min-w-[170px]"
            >
              {filterOptions.map((f) => (
                <button
                  key={f}
                  onClick={() => { setStateFilter(f); setShowDropdown(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-aegis-bg-elevated transition-colors ${stateFilter === f ? "text-aegis-accent-purple font-medium" : "text-aegis-primary-dark dark:text-white"}`}
                >
                  {f === "All" ? "All States" : STATE_BADGE[f as TxState]?.label ?? f}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : txs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Wallet size={32} className="mx-auto text-aegis-tertiary-dark" />
            <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">No transactions yet</p>
            <p className="text-xs text-aegis-tertiary-dark">
              {stateFilter !== "All" ? "No transactions match this filter" : "Use Send Money to create your first transaction"}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {txs.map((tx, index) => {
              const badge = STATE_BADGE[tx.state as TxState];
              const amountStr = formatAmount(tx.amountRaw, tx.tokenDecimals);
              const feeStr = formatAmount(tx.feeRaw, tx.tokenDecimals);
              const isCredit = false; // all transactions in this view are outgoing

              return (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-aegis-bg-elevated/50 transition-colors ${
                    index < txs.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                    <Send size={16} className="text-aegis-accent-purple" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-aegis-primary-dark dark:text-white truncate">
                      {tx.referenceId}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-aegis-tertiary-dark font-mono">
                        To: {tx.recipient.slice(0,6)}…{tx.recipient.slice(-4)}
                      </span>
                      <span className="text-aegis-tertiary-dark">·</span>
                      <span className="text-xs text-aegis-tertiary-dark">
                        {new Date(tx.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      {tx.discountBps > 0 && (
                        <>
                          <span className="text-aegis-tertiary-dark">·</span>
                          <span className="text-xs text-aegis-success-green">{tx.discountBps / 100}% CZN discount</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Amount + state */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-aegis-primary-dark dark:text-white">
                      -{amountStr}
                    </p>
                    <p className="text-[10px] text-aegis-tertiary-dark">fee: {feeStr}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full mt-0.5 inline-block ${badge?.color ?? ""}`}>
                      {badge?.label ?? tx.state}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
