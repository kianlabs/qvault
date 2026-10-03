// QVAULT — top bar: search + lock (SPEC §5 B4).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Search } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

export default function Topbar() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const lock = useAuthStore((s) => s.lock);

  async function handleLock() {
    try {
      await lock();
    } finally {
      navigate("/unlock", { replace: true });
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface/80 px-6 backdrop-blur">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-xl border border-line bg-elevated/60 py-2 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-accent"
        />
      </div>
      <button
        type="button"
        onClick={handleLock}
        className="ml-auto inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-muted transition hover:text-ink"
      >
        <Lock className="h-4 w-4" />
        Lock
      </button>
    </header>
  );
}
