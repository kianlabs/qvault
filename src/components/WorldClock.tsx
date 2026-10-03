// QVAULT — World clock card (Wave 3, Agent C). Jam dunia yang berjalan tiap detik.
// Zona default: Local, UTC, Tokyo, New York (pakai Intl.DateTimeFormat + setInterval).
import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

interface Zone {
  /** Nama yang ditampilkan (kota / label zona). */
  label: string;
  /** IANA time zone; kosong = zona waktu lokal perangkat. */
  timeZone?: string;
}

const ZONES: Zone[] = [
  { label: "Local" },
  { label: "UTC", timeZone: "UTC" },
  { label: "Tokyo", timeZone: "Asia/Tokyo" },
  { label: "New York", timeZone: "America/New_York" },
];

/** Format jam:menit:detik (24h) untuk satu zona; fallback ke jam lokal bila zona invalid. */
function formatTime(date: Date, timeZone?: string): string {
  const base: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  try {
    return new Intl.DateTimeFormat("en-GB", timeZone ? { ...base, timeZone } : base).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("en-GB", base).format(date);
  }
}

export default function WorldClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="rounded-2xl border border-line bg-elevated p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Globe className="h-4 w-4 text-accent" />
          World clock
        </h2>
        <span className="text-[11px] text-muted">24h</span>
      </div>

      <ul className="space-y-2">
        {ZONES.map((zone) => (
          <li
            key={zone.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2.5"
          >
            <span className="text-sm text-ink">{zone.label}</span>
            <span className="font-mono text-sm tabular-nums text-muted">
              {formatTime(now, zone.timeZone)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
