// QVAULT — AreaChart (SVG murni, tanpa dependensi).
//
// Grafik area dengan isian gradien + garis, sumbu Y berlabel "cantik" dan
// sumbu X berupa label bulan. 100% offline (tidak ada library chart pihak
// ketiga) sehingga tetap sejalan dengan prinsip local-first.
import { useMemo, useState } from "react";
import { formatCurrency } from "../../lib/utils";

interface Point {
  /** Label sumbu X (mis. "Aug"). */
  label: string;
  /** Nilai untuk tinggi area. */
  value: number;
}

interface AreaChartProps {
  data: Point[];
  /** Tinggi plot dalam px. */
  height?: number;
  /** Kode mata uang untuk label sumbu Y & tooltip. */
  currency?: string;
}

/** Bulatkan ke angka "cantik": 1/2/5 × 10ⁿ. */
function niceMax(max: number): number {
  if (max <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const norm = max / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

export default function AreaChart({
  data,
  height = 180,
  currency = "USD",
}: AreaChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const top = useMemo(
    () => niceMax(Math.max(...data.map((d) => d.value), 0)),
    [data],
  );
  const ticks = [top, top * 0.5, 0];

  const W = 100; // viewBox units (lebar), diskalakan oleh CSS
  const H = 100;
  const n = data.length;

  // Koordinat titik (x merata, y dari nilai ternormalisasi).
  const pts = data.map((d, i) => {
    const x = n <= 1 ? 0 : (i / (n - 1)) * W;
    const y = H - (top > 0 ? (d.value / top) * H : 0);
    return { x, y };
  });

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div className="flex gap-3">
      {/* Sumbu Y */}
      <div
        className="flex shrink-0 flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-faint"
        style={{ height: height + 20 }}
      >
        {ticks.map((t, i) => (
          <span key={i}>{formatCurrency(t, currency)}</span>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height }}
        >
          <defs>
            <linearGradient id="qv-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* Gridlines */}
          {ticks.map((_, i) => (
            <line
              key={i}
              x1="0"
              x2={W}
              y1={(i / (ticks.length - 1)) * H}
              y2={(i / (ticks.length - 1)) * H}
              stroke="var(--line)"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="url(#qv-area)" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Titik hover + tooltip */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <div
              key={d.label + i}
              className="group/point relative h-full flex-1"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <div className="qv-pop absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs shadow-xl">
                  <p className="font-medium text-ink">
                    {formatCurrency(d.value, currency)}
                  </p>
                  <p className="text-[10px] text-muted">{d.label}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sumbu X */}
        <div className="mt-1.5 flex">
          {data.map((d, i) => (
            <span key={d.label + i} className="flex-1 text-center text-[10px] text-muted">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
