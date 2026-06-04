import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { trpc, getTrpcClient } from "./lib/trpc";
import App from "./App";
import "./index.css";

// ── System dark mode: respect prefers-color-scheme immediately ────
// Also persists user override in localStorage
function initTheme() {
  const stored = localStorage.getItem("aegis_theme");
  if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
initTheme();

// Re-apply when system preference changes (if user hasn't overridden)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("aegis_theme")) {
    document.documentElement.classList.toggle("dark", e.matches);
  }
});

const trpcClient = getTrpcClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>
);
