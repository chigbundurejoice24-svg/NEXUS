/**
 * LegalPage.tsx — Full legal document viewer
 * Route: /legal?doc=terms (or any policy id)
 * Accessible from: auth consent links, Settings, footer
 */
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, ChevronUp, Shield, ExternalLink } from "lucide-react";
import {
  ALL_POLICIES,
  TERMS_OF_SERVICE,
  type LegalDoc,
} from "@/lib/legal-policies";

function PolicyViewer({ doc }: { doc: LegalDoc }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  function toggle(i: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-aegis-primary-dark dark:text-white">{doc.title}</h2>
          <p className="text-xs text-aegis-tertiary-dark mt-1">Last updated: {doc.lastUpdated}</p>
        </div>
      </div>

      {doc.sections.map((section, i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
          {section.heading ? (
            <>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-aegis-bg-elevated transition-colors"
              >
                <span className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
                  {section.heading}
                </span>
                {expanded.has(i)
                  ? <ChevronUp size={16} className="text-aegis-tertiary-dark flex-shrink-0" />
                  : <ChevronDown size={16} className="text-aegis-tertiary-dark flex-shrink-0" />
                }
              </button>
              <AnimatePresence>
                {expanded.has(i) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                      {section.body.map((para, j) => (
                        <p key={j} className="text-sm text-aegis-secondary-dark leading-relaxed">
                          {para}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="px-4 py-4 space-y-2">
              {section.body.map((para, j) => (
                <p key={j} className="text-sm text-aegis-secondary-dark leading-relaxed">{para}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function LegalPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const docId = searchParams.get("doc") ?? "terms";

  const activeDoc = ALL_POLICIES.find(p => p.id === docId) ?? TERMS_OF_SERVICE;

  const POLICY_GROUPS = [
    {
      label: "Core",
      policies: ["terms", "privacy", "risk"],
    },
    {
      label: "Compliance",
      policies: ["kyc", "aml", "aup"],
    },
    {
      label: "Token & Rewards",
      policies: ["czn", "referral"],
    },
    {
      label: "Technical",
      policies: ["cookies"],
    },
    {
      label: "Support",
      policies: ["complaints"],
    },
  ];

  return (
    <div className="min-h-screen bg-aegis-bg-surface dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-aegis-bg-elevated transition-colors"
          >
            <ChevronLeft size={18} className="text-aegis-secondary-dark" />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#5B3CF5]" />
            <span className="text-sm font-semibold text-aegis-primary-dark dark:text-white">
              Legal Documents
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-aegis-tertiary-dark">
            <span>© 2026 Cozanet</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Sidebar — policy list */}
        <aside className="lg:w-56 flex-shrink-0">
          <div className="lg:sticky lg:top-20 space-y-4">
            {POLICY_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-aegis-tertiary-dark uppercase tracking-wider mb-2 px-2">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.policies.map(pid => {
                    const doc = ALL_POLICIES.find(p => p.id === pid);
                    if (!doc) return null;
                    return (
                      <button
                        key={pid}
                        onClick={() => setSearchParams({ doc: pid })}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
                          docId === pid
                            ? "bg-[#5B3CF5]/10 text-[#5B3CF5] font-semibold"
                            : "text-aegis-secondary-dark hover:bg-aegis-bg-elevated"
                        }`}
                      >
                        {doc.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={docId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <PolicyViewer doc={activeDoc} />
            </motion.div>
          </AnimatePresence>

          {/* Footer notice */}
          <div className="mt-8 p-4 bg-card border border-border rounded-xl text-center space-y-1">
            <p className="text-xs text-aegis-tertiary-dark">
              Aegis is a product of Cozanet. All services are provided "as is" without warranties.
            </p>
            <p className="text-xs text-aegis-tertiary-dark">
              Use of digital assets involves risk of loss. © 2026 Cozanet. All rights reserved.
            </p>
            <a
              href="mailto:info@cozanet.net"
              className="text-xs text-[#5B3CF5] hover:underline flex items-center justify-center gap-1 mt-2"
            >
              info@cozanet.net <ExternalLink size={10} />
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
