import type { CambioLog } from "@/types/activityLog";

/**
 * Compares two plain objects and returns an array of changed fields
 * with human-readable labels and formatted values.
 *
 * @param before  - Original object
 * @param after   - Updated object
 * @param labels  - Map of field key → display label (only listed fields are compared)
 * @param formatters - Optional map of field key → value formatter function
 */
export function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
  formatters?: Record<string, (v: unknown) => string>
): CambioLog[] {
  const cambios: CambioLog[] = [];

  for (const campo of Object.keys(labels)) {
    const bVal = before[campo];
    const aVal = after[campo];

    // Skip unchanged fields (loose equality to handle boolean/number edge cases)
    // eslint-disable-next-line eqeqeq
    if (bVal == aVal) continue;
    // Skip if both are nullish
    if ((bVal == null || bVal === "") && (aVal == null || aVal === "")) continue;

    const fmt = formatters?.[campo] ?? ((v: unknown) => (v == null || v === "" ? "—" : String(v)));

    cambios.push({
      campo,
      etiqueta: labels[campo],
      anterior: fmt(bVal),
      nuevo: fmt(aVal),
    });
  }

  return cambios;
}

/** Formatter helpers */
export const fmtBoolean = (v: unknown) => (v ? "Sí" : "No");
export const fmtActivo = (v: unknown) => (v ? "Activo" : "Inactivo");
export const fmtSoles = (v: unknown) =>
  v != null
    ? new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(Number(v))
    : "—";
