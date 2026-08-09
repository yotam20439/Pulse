import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 1_284_000 -> "1.3M". Used for every metric tile. */
export const formatCount = (n: number | null | undefined) =>
  n == null ? "—" : compact.format(n);

export const formatPercent = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : `${(n * 100).toFixed(digits)}%`;

export const formatMoney = (n: number | string | null | undefined, currency = "ILS") =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(Number(n));
