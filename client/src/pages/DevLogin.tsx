/**
 * DevLogin.tsx — Development bypass page
 * Navigate to /dev to skip auth and browse the full app.
 * This sets a localStorage flag — no real server call needed.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { enableDevBypass } from "@/lib/trpc";

export default function DevLogin() {
  const navigate = useNavigate();
  useEffect(() => {
    enableDevBypass();
    navigate("/", { replace: true });
  }, [navigate]);
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">⚡</span>
        </div>
        <p className="text-sm text-muted-foreground">Enabling dev mode...</p>
      </div>
    </div>
  );
}
