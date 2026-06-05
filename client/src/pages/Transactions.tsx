import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Download, PlusCircle, ArrowLeftRight, Search, Filter, ChevronDown, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUnits } from "viem";

type TxState = "CREATED"|"QUOTED"|"SIMULATED"|"PENDING_SIGNATURE"|"SUBMITTED"|"CONFIRMED"|"SETTLED"|"FAILED"|"REVERSED";

const STATE_BADGE: Record<TxState, { label: string; color: string }> = {
  CREATED:           { label: "Created",       color: "bg-gray-100 dark:bg-gray-800 text-aegis-secondary-dark" },
  QUOTED:            { label: "Quoted",        color: "bg-blue-50 dark:bg-blue-900/20 text-blue-500" },
  SIMULATED:         { label: "Simulated",     color: "bg-purple-50 dark:bg-purple-900/20 text-purple-500" },
  PENDING_SIGNATURE: { label: "Awaiting Sig",  color: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500" },
  SUBMITTED:         { label: "Submitted",     color: "bg-blue-50 dark:bg-blue-900/20 text-blue-500" },
  CONFIRMED:         { label: "Confirmed",     color: "bg-green-50 dark:bg-green-900/20 text-green-600" },
  SETTLED:           { label: "Settled ✓",    color: "bg-green-50 dark:bg-green-900/20 text-green-600" },
  FAILED:            { label: "Failed",        color: "bg-red-50 dark:bg-red-900/20 text-red-500" },
  REVERSED:          { label: "Reversed",      color: "bg-orange-50 dark:bg-orange-900/20 text-orange-500" },
};

const TYPE_ICON: Record<string, React.ElementType> = {
  SEND: Send, RECEIVE: Download, FUND: PlusCircle, SWAP: ArrowLeftRight,
};

const FILTERS = ["All","SETTLED","PENDING_SIGNATURE","SUBMITTED","FAILED","CREATED"];

export default function Transactions() {
  const [search, setSearch]       = useState("");
  const [stateFilter, setFilter]  = useState("All");
  const [showDrop, setShowDrop]   = useState(false);
  const [expandedId, setExpanded] = useState<number|null>(null);

  // Auto-refresh every 15s if any tx is pending/submitted
  const { data: rawTxs, isLoading, refetch, isFetching } = trpc.transactions.list.useQuery(
    { limit: 100, offset: 0 },
    {
      refetchInterval: (data: any) => {
        const txs = (data as any)?.transactions ?? [];
        const hasPending = txs.some((t: any) => ["SUBMITTED","CONFIRMED","PENDING_SIGNATURE","CREATED","QUOTED"].includes(t.state));
        return hasPending ? 15_000 : false;
      },
    }
  );

  const allTxs: any[] = (rawTxs as any)?.transactions ?? [];

  const filtered = allTxs.filter(tx => {
    const matchState = stateFilter === "All" || tx.state === stateFilter;
    const matchSearch = !search || String(tx.id).includes(search) || tx.recipient?.toLowerCase().includes(search.toLowerCase());
    return matchState && matchSearch;
  });

  return (
    <div className="space-y-5 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-aegis-tertiary-dark flex-shrink-0"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ID or address..."
            className="bg-transparent text-sm flex-1 focus:outline-none dark:text-white placeholder:text-aegis-tertiary-dark"/>
        </div>
        <div className="relative">
          <button onClick={() => setShowDrop(!showDrop)}
            className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-xl text-xs text-aegis-secondary-dark">
            <Filter size={13}/>{stateFilter}<ChevronDown size={11}/>
          </button>
          <AnimatePresence>
            {showDrop && (
              <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}}
                className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg py-1 w-40">
                {FILTERS.map(f => (
                  <button key={f} onClick={() => { setFilter(f); setShowDrop(false); }}
                    className={`w-full px-4 py-2 text-xs text-left transition-colors ${stateFilter===f ? "text-aegis-accent-purple font-semibold" : "text-aegis-secondary-dark hover:bg-aegis-bg-elevated"}`}>
                    {f}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="p-2 rounded-xl bg-card border border-border hover:bg-aegis-bg-elevated transition-colors">
          <RefreshCw size={14} className={`text-aegis-tertiary-dark ${isFetching ? "animate-spin" : ""}`}/>
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_,i) => <Skeleton key={i} className="h-20 w-full rounded-xl"/>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-aegis-bg-elevated flex items-center justify-center mx-auto mb-3">
            <ArrowLeftRight size={24} className="text-aegis-tertiary-dark"/>
          </div>
          <p className="text-sm font-medium dark:text-white">No transactions yet</p>
          <p className="text-xs text-aegis-tertiary-dark mt-1">Your sends and receives will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx: any) => {
            const badge = STATE_BADGE[tx.state as TxState] ?? { label: tx.state, color: "bg-gray-100 dark:bg-gray-800 text-gray-400" };
            const Icon  = TYPE_ICON[tx.type ?? "SEND"] ?? Send;
            const amt   = tx.amountRaw ? `${(Number(tx.amountRaw) / 1e6).toFixed(2)} USDT` : "—";
            const isExpanded = expandedId === tx.id;

            return (
              <motion.div key={tx.id} layout initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
                className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : tx.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-aegis-bg-elevated/50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-aegis-bg-elevated flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-aegis-accent-purple"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium dark:text-white">{tx.type ?? "Transfer"} #{tx.id}</p>
                    <p className="text-xs text-aegis-tertiary-dark truncate">{tx.recipient ? `To: ${tx.recipient.slice(0,10)}...` : "—"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold dark:text-white">{amt}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
                      className="border-t border-border px-4 py-3 space-y-1.5 bg-aegis-bg-elevated/30">
                      {tx.txHash && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-aegis-tertiary-dark">Tx Hash:</p>
                          <a href={`https://bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noreferrer"
                            className="text-xs font-mono text-aegis-accent-purple flex items-center gap-1 hover:underline truncate">
                            {tx.txHash.slice(0,18)}… <ExternalLink size={10}/>
                          </a>
                        </div>
                      )}
                      {tx.feeRaw && <p className="text-xs text-aegis-tertiary-dark">Fee: {(Number(tx.feeRaw)/1e6).toFixed(4)} USDT</p>}
                      {tx.createdAt && <p className="text-xs text-aegis-tertiary-dark">{new Date(tx.createdAt).toLocaleString()}</p>}
                      {["SUBMITTED","CONFIRMED","PENDING_SIGNATURE"].includes(tx.state) && (
                        <div className="flex items-center gap-1.5 text-xs text-yellow-500 mt-1">
                          <Loader2 size={11} className="animate-spin"/> Auto-refreshing every 15s…
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
