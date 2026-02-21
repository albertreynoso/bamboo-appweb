// src/components/PctBadge.tsx
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function calcPct(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

interface PctBadgeProps {
  pct: number;
  /** "inline" — plain colored text (default, used in Dashboard stat cards)
   *  "pill"   — rounded badge with background (used in Pagos stat cards)  */
  variant?: "inline" | "pill";
}

export function PctBadge({ pct, variant = "inline" }: PctBadgeProps) {
  const up = pct >= 0;

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          up
            ? "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200"
            : "text-red-600 bg-red-50 ring-1 ring-red-200"
        }`}
      >
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(pct).toFixed(0)}%
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-0.5 text-sm font-medium ${
        up ? "text-emerald-500" : "text-red-500"
      }`}
    >
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}
