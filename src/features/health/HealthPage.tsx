// QVAULT — Password Health (route "/health", Wave 4 / Agent C).
// Analisis kekuatan password dari data vault yang SUDAH didekripsi (useVaultStore.items).
// Tidak butuh backend: semua hitungan dilakukan lokal dari item.password/username/title/updatedAt/url.
// UI bahasa Inggris, komentar bahasa Indonesia. Lapisan tampilan saja — logika identik.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Copy,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { useVaultStore } from "../../store/useVaultStore";
import { cn, formatDate, parseDate, passwordStrength } from "../../lib/utils";
import { breachCounts } from "../../lib/hibp";
import { staggerIn, useGsap } from "../../lib/motion";
import EmptyState from "../../components/EmptyState";
import {
  Button,
  Card,
  CardHeader,
  PageHeader,
  RowActions,
  StatCard,
  Tabs,
  type Tone,
} from "../../components/ui";
import type { VaultItem } from "../../lib/types";

/** Ambang item dianggap basi: 180 hari sejak updatedAt. */
const STALE_DAYS = 180;

interface HealthReport {
  total: number;
  /** Item sehat (tidak weak/reused/stale/missing dan punya 2FA). */
  healthy: number;
  /** Skor 0–100 = persentase item sehat dari total. */
  score: number;
  weak: VaultItem[];
  reused: VaultItem[];
  stale: VaultItem[];
  missing: VaultItem[];
  no2fa: VaultItem[];
  /** Frekuensi tiap nilai password (untuk menandai reuse). */
  counts: Map<string, number>;
}

/**
 * Hitung seluruh metrik kesehatan dari daftar item.
 * Semua kategori independen — satu item bisa muncul di beberapa kategori sekaligus
 * (mis. password lemah DAN dipakai ulang), itu memang diharapkan pada dashboard health.
 */
function analyze(items: VaultItem[]): HealthReport {
  const total = items.length;

  // Hitung berapa kali tiap nilai password muncul (abaikan string kosong).
  const counts = new Map<string, number>();
  for (const it of items) {
    if (it.password) counts.set(it.password, (counts.get(it.password) ?? 0) + 1);
  }

  const now = Date.now();
  const staleMs = STALE_DAYS * 24 * 60 * 60 * 1000;

  const weak: VaultItem[] = [];
  const reused: VaultItem[] = [];
  const stale: VaultItem[] = [];
  const missing: VaultItem[] = [];
  const no2fa: VaultItem[] = [];
  let healthy = 0;

  for (const it of items) {
    // Weak: pakai passwordStrength(item.password).score <= 1 (persis kontrak C.2).
    const isWeak = passwordStrength(it.password).score <= 1;
    // Reused: nilai password yang sama muncul di >1 item (abaikan kosong).
    const isReused = it.password !== "" && (counts.get(it.password) ?? 0) > 1;
    // Stale: updatedAt lebih tua dari 180 hari (timestamp tak valid = tidak dianggap basi).
    const updated = parseDate(it.updatedAt);
    const isStale = updated !== null && now - updated.getTime() > staleMs;
    // Missing: password kosong.
    const isMissing = it.password === "";
    // No 2FA: belum punya secret TOTP.
    const isNo2fa = !it.hasTotp;

    if (isWeak) weak.push(it);
    if (isReused) reused.push(it);
    if (isStale) stale.push(it);
    if (isMissing) missing.push(it);
    if (isNo2fa) no2fa.push(it);

    if (!isWeak && !isReused && !isStale && !isMissing && !isNo2fa) healthy++;
  }

  // Skor = persentase item sehat. Vault kosong dianggap 100 (tak ada masalah).
  const score = total === 0 ? 100 : Math.round((healthy / total) * 100);

  return { total, healthy, score, weak, reused, stale, missing, no2fa, counts };
}

type TabKey = "weak" | "reused" | "stale" | "missing" | "no2fa" | "breached";

interface TabDef {
  key: TabKey;
  label: string;
  hint: string;
}

const TABS: TabDef[] = [
  { key: "weak", label: "Weak", hint: "Passwords that are easy to guess." },
  { key: "reused", label: "Reused", hint: "Same password used on more than one login." },
  { key: "stale", label: "Stale", hint: `Not updated in over ${STALE_DAYS} days.` },
  { key: "missing", label: "Missing", hint: "Items saved without a password." },
  { key: "no2fa", label: "No 2FA", hint: "Items without a TOTP secret." },
  {
    key: "breached",
    label: "Breached",
    hint: "Found in known data breaches (checked privately via k-anonymity).",
  },
];

/** Tone semantik untuk skor total (satu warna = satu makna). */
function scoreTone(score: number): { text: string; bar: string } {
  if (score >= 80) return { text: "text-success", bar: "bg-success" };
  if (score >= 50) return { text: "text-warn", bar: "bg-warn" };
  return { text: "text-danger", bar: "bg-danger" };
}

export default function HealthPage() {
  const navigate = useNavigate();
  const items = useVaultStore((s) => s.items);
  const loading = useVaultStore((s) => s.loading);
  const load = useVaultStore((s) => s.load);

  // Pastikan data vault segar saat halaman dibuka.
  useEffect(() => {
    void load();
  }, [load]);

  const report = useMemo(() => analyze(items), [items]);
  const [tab, setTab] = useState<TabKey>("weak");

  // Wave 6 — cek kebocoran HIBP (k-anonymity). Hanya jalan saat user menekan
  // tombol, bukan otomatis, supaya password tidak dicek tanpa sepengetahuan user.
  const [breachCountsMap, setBreachCountsMap] = useState<Map<string, number>>(
    new Map(),
  );
  const [breachBusy, setBreachBusy] = useState(false);
  const [breachError, setBreachError] = useState<string | null>(null);
  const [breachDone, setBreachDone] = useState(false);
  /** Berapa password yang GAGAL dicek (jaringan/hash) — belum terverifikasi. */
  const [breachFailed, setBreachFailed] = useState(0);
  /** Berapa password yang dicoba dicek pada run terakhir. */
  const [breachScanned, setBreachScanned] = useState(0);

  async function runBreachCheck() {
    setBreachBusy(true);
    setBreachError(null);
    try {
      const withPw = items.filter((it) => it.password);
      const { counts, failed } = await breachCounts(
        withPw.map((it) => it.password),
      );
      const byId = new Map<string, number>();
      withPw.forEach((it, i) => {
        const n = counts.get(i);
        if (n && n > 0) byId.set(it.id, n);
      });
      setBreachCountsMap(byId);
      setBreachFailed(failed.length);
      setBreachScanned(withPw.length);
      setBreachDone(true);
    } catch (err) {
      setBreachError(
        err instanceof Error ? err.message : "Could not reach the breach service",
      );
      setBreachDone(false);
    } finally {
      setBreachBusy(false);
    }
  }

  /** Item yang passwordnya muncul di kebocoran data (berdasarkan hasil cek). */
  const breachedItems = useMemo(
    () => items.filter((it) => (breachCountsMap.get(it.id) ?? 0) > 0),
    [items, breachCountsMap],
  );

  // Entrance motion (presentation only): cascade the summary grid on mount and
  // re-cascade the problem list whenever the active filter (tab) changes.
  const statsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useGsap(() => {
    staggerIn(statsRef.current, ":scope > *", { y: 8, stagger: 0.05 });
  }, []);
  useGsap(() => {
    staggerIn(listRef.current, ":scope > *", { y: 8, stagger: 0.03 });
  }, [tab]);

  const tone = scoreTone(report.score);

  // Daftar item untuk tab aktif + teks detail per kategori.
  const activeList = useMemo<VaultItem[]>(() => {
    switch (tab) {
      case "weak":
        return report.weak;
      case "reused":
        return report.reused;
      case "stale":
        return report.stale;
      case "missing":
        return report.missing;
      case "no2fa":
        return report.no2fa;
      case "breached":
        return breachedItems;
    }
  }, [tab, report, breachedItems]);

  const activeDef = TABS.find((t) => t.key === tab) ?? TABS[0];

  const detailFor = (item: VaultItem): string => {
    switch (tab) {
      case "weak":
        return passwordStrength(item.password).label;
      case "reused": {
        const n = report.counts.get(item.password) ?? 0;
        return `Used on ${n} logins`;
      }
      case "stale":
        return `Last updated ${formatDate(item.updatedAt)}`;
      case "missing":
        return "No password stored";
      case "no2fa":
        return "2FA not enabled";
      case "breached": {
        const n = breachCountsMap.get(item.id) ?? 0;
        return `Seen in ${n.toLocaleString()} breach${n === 1 ? "" : "es"}`;
      }
    }
  };

  const counts: Record<TabKey, number> = {
    weak: report.weak.length,
    reused: report.reused.length,
    stale: report.stale.length,
    missing: report.missing.length,
    no2fa: report.no2fa.length,
    breached: breachedItems.length,
  };

  const stats: { label: string; value: number; icon: typeof KeyRound; tone: Tone }[] = [
    { label: "Total", value: report.total, icon: KeyRound, tone: "accent" },
    { label: "Weak", value: report.weak.length, icon: ShieldAlert, tone: "danger" },
    { label: "Reused", value: report.reused.length, icon: Copy, tone: "warn" },
    { label: "Stale", value: report.stale.length, icon: RefreshCw, tone: "info" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Password health"
        subtitle="Find weak, reused, stale and missing credentials — and logins without 2FA."
        actions={
          <Button
            variant="secondary"
            icon={breachBusy ? Loader2 : ShieldX}
            onClick={() => void runBreachCheck()}
            disabled={breachBusy || report.total === 0}
          >
            {breachBusy ? "Checking…" : "Check breaches"}
          </Button>
        }
      />

      {breachError && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-2 text-xs text-danger">
          {breachError}
        </div>
      )}
      {breachDone && !breachError && (
        <div
          className={cn(
            "rounded-xl border px-4 py-2 text-xs",
            breachedItems.length > 0
              ? "border-danger/30 bg-danger-soft text-danger"
              : breachFailed > 0
                ? "border-warn/30 bg-warn-soft text-warn"
                : breachScanned === 0
                  ? "border-line bg-raised text-muted"
                  : "border-success/30 bg-success-soft text-success",
          )}
        >
          {breachedItems.length > 0
            ? `${breachedItems.length} password${
                breachedItems.length === 1 ? "" : "s"
              } found in known breaches — see the “Breached” tab.`
            : breachFailed > 0
              ? `${breachFailed} of ${breachScanned} password${
                  breachScanned === 1 ? "" : "s"
                } could not be checked (network). Re-run the check before trusting a clean result.`
              : breachScanned === 0
                ? "No stored passwords to check — add passwords to your items first."
                : "No passwords found in known breaches. Nice work."}
        </div>
      )}

      {report.total === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={loading ? "Loading vault…" : "No credentials to analyze"}
          hint="Add items to your vault and their health will be reviewed here."
          action={
            <Button
              variant="primary"
              icon={KeyRound}
              onClick={() => navigate("/vault")}
            >
              Go to vault
            </Button>
          }
        />
      ) : (
        <>
          {/* Kartu skor total + 4 stat ringkasan. */}
          <section className="grid gap-4 md:grid-cols-2">
            <Card padding="lg" className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">
                  Overall health
                </span>
                <ShieldAlert className={cn("h-4 w-4", tone.text)} />
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span
                  className={cn(
                    "text-2xl font-semibold tracking-tight tabular-nums",
                    tone.text,
                  )}
                >
                  {report.score}
                </span>
                <span className="pb-0.5 text-sm text-muted">/ 100</span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className={cn("h-full rounded-full transition-all", tone.bar)}
                  style={{ width: `${report.score}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {report.healthy} of {report.total} items are healthy.
              </p>
            </Card>

            <div ref={statsRef} className="grid grid-cols-2 gap-4">
              {stats.map(({ label, value, icon, tone: t }) => (
                <StatCard
                  key={label}
                  label={label}
                  value={value}
                  icon={icon}
                  tone={t}
                />
              ))}
            </div>
          </section>

          {/* Daftar masalah per kategori (tab). */}
          <Card padding="lg">
            <CardHeader
              title={activeDef.label}
              action={
                <Tabs
                  items={TABS.map((t) => ({
                    value: t.key,
                    label: t.label,
                    // Tab Breached: jangan tampilkan "0" sebelum dicek (menyesatkan).
                    count: t.key === "breached" && !breachDone ? undefined : counts[t.key],
                  }))}
                  value={tab}
                  onChange={(v) => setTab(v as TabKey)}
                />
              }
            />

            <p className="mb-4 text-xs text-muted">{activeDef.hint}</p>

            {activeDef.key === "breached" && !breachDone ? (
              <EmptyState
                icon={ShieldX}
                title="Not checked yet"
                hint="Run the breach check to see which passwords appear in known data breaches. Only a 5-character hash prefix ever leaves your device."
                action={
                  <Button
                    variant="primary"
                    icon={breachBusy ? Loader2 : ShieldX}
                    onClick={() => void runBreachCheck()}
                    disabled={breachBusy}
                  >
                    {breachBusy ? "Checking…" : "Check breaches"}
                  </Button>
                }
              />
            ) : activeList.length === 0 ? (
              <EmptyState
                icon={activeDef.key === "no2fa" ? Lock : KeyRound}
                title="Nothing here"
                hint={
                  activeDef.key === "breached"
                    ? breachFailed > 0
                      ? `${breachFailed} password${
                          breachFailed === 1 ? "" : "s"
                        } could not be checked — this list is incomplete. Re-run the check.`
                      : breachScanned === 0
                        ? "No stored passwords were available to check."
                        : "No passwords were found in known breaches. Nice work."
                    : "No items in this category. Nice work."
                }
              />
            ) : (
              <div ref={listRef} className="-mx-5 -mb-5">
                {activeList.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 border-t border-line px-5 py-2.5 transition-colors hover:bg-raised"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-muted">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{item.title}</p>
                      <p className="truncate text-xs text-muted">
                        {item.username || "—"} · {detailFor(item)}
                      </p>
                    </div>
                    <RowActions>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate("/vault")}
                      >
                        Fix in vault
                      </Button>
                    </RowActions>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
