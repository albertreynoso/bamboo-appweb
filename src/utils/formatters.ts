// src/utils/formatters.ts

/**
 * Capitalizes a full name respecting compound particles.
 * Examples: "maría josé" → "María José", "de la cruz" → "De La Cruz"
 */
export const capitalizeName = (name: string): string => {
  if (!name) return "";
  const exceptions = ["de", "del", "la", "los", "las", "y"];
  return name
    .toLowerCase()
    .split(" ")
    .map(word => (exceptions.includes(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
};

/** Format a number as Peruvian soles currency, e.g. S/ 1,500.00 */
export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

/** Compact currency label for chart Y-axis ticks */
export const formatCurrencyAxis = (v: number): string =>
  v >= 1000 ? `S/${(v / 1000).toFixed(0)}K` : `S/${v}`;
