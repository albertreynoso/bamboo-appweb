import { useState, useCallback } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import {
  DollarSign, Calendar, UserCircle, TrendingUp, Users,
  ClipboardList, XCircle, UserPlus, Stethoscope,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatId =
  | "ingresos_hoy"
  | "ingresos_mes"
  | "total_pacientes"
  | "citas_hoy"
  | "presupuesto_pendiente"
  | "empleados_activos"
  | "tratamientos_activos"
  | "tasa_cancelacion"
  | "nuevos_pacientes_mes";

export type WidgetId =
  | "grafico_ingresos"
  | "citas_hoy_lista"
  | "tratamientos_resumen"
  | "equipo_resumen";

export interface StatsZone {
  id: string;
  stats: StatId[];
}

export interface WidgetZone {
  id: string;
  widgets: WidgetId[];   // 1–2 widgets per zone (row)
  sizes: number[];       // flex-grow values, e.g. [50, 50] or [100]
  height?: number;       // custom height in px (undefined = auto)
}

export interface DashboardLayout {
  statZones: StatsZone[];
  widgetZones: WidgetZone[];
}

export const MAX_STATS_PER_ZONE = 5;
export const MAX_WIDGETS_PER_ZONE = 3;

function evenSizes(count: number): number[] {
  const base = parseFloat((100 / count).toFixed(4));
  const sizes = Array(count).fill(base);
  sizes[count - 1] = parseFloat((100 - base * (count - 1)).toFixed(4));
  return sizes;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface StatMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconText: string;
}

export interface WidgetMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  previewLabel: string;
}

export const STAT_META: Record<StatId, StatMeta> = {
  ingresos_hoy: {
    label: "Ingresos de Hoy",
    description: "Total de pagos recibidos en el día",
    icon: DollarSign,
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
  },
  ingresos_mes: {
    label: "Ingresos del Mes",
    description: "Total de ingresos del mes actual",
    icon: TrendingUp,
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
  },
  total_pacientes: {
    label: "Total Pacientes",
    description: "Número total de pacientes registrados",
    icon: UserCircle,
    iconBg: "bg-violet-50",
    iconText: "text-violet-600",
  },
  citas_hoy: {
    label: "Citas Hoy",
    description: "Citas programadas para el día de hoy",
    icon: Calendar,
    iconBg: "bg-primary/10",
    iconText: "text-primary",
  },
  presupuesto_pendiente: {
    label: "Presupuesto Pendiente",
    description: "Deuda total de tratamientos activos",
    icon: TrendingUp,
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
  },
  empleados_activos: {
    label: "Empleados Activos",
    description: "Personal activo en la clínica",
    icon: Users,
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
  },
  tratamientos_activos: {
    label: "Tratamientos Activos",
    description: "Tratamientos en curso actualmente",
    icon: ClipboardList,
    iconBg: "bg-teal-50",
    iconText: "text-teal-600",
  },
  tasa_cancelacion: {
    label: "Tasa de Cancelación",
    description: "Porcentaje de citas canceladas este mes",
    icon: XCircle,
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
  },
  nuevos_pacientes_mes: {
    label: "Nuevos este Mes",
    description: "Pacientes registrados en el mes actual",
    icon: UserPlus,
    iconBg: "bg-sky-50",
    iconText: "text-sky-600",
  },
};

export const WIDGET_META: Record<WidgetId, WidgetMeta> = {
  grafico_ingresos: {
    label: "Gráfico de Ingresos",
    description: "Ingresos diarios del mes con curva de área y comparativa mensual",
    icon: TrendingUp,
    previewLabel: "Gráfico · Área",
  },
  citas_hoy_lista: {
    label: "Citas de Hoy",
    description: "Lista cronológica de citas del día con estado en tiempo real",
    icon: Calendar,
    previewLabel: "Lista · Citas",
  },
  tratamientos_resumen: {
    label: "Tratamientos",
    description: "Estado y cobro de tratamientos activos con barra de progreso",
    icon: ClipboardList,
    previewLabel: "Resumen · Progreso",
  },
  equipo_resumen: {
    label: "Equipo",
    description: "Empleados activos, dentistas y rendimiento del mes",
    icon: Stethoscope,
    previewLabel: "Resumen · Equipo",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function flattenStats(layout: DashboardLayout): StatId[] {
  return layout.statZones.flatMap((z) => z.stats);
}

export function flattenWidgets(layout: DashboardLayout): WidgetId[] {
  return layout.widgetZones.flatMap((z) => z.widgets);
}

function addStatToLayout(layout: DashboardLayout, statId: StatId): DashboardLayout {
  const zones = [...layout.statZones];
  if (zones.length === 0) {
    return { ...layout, statZones: [{ id: crypto.randomUUID(), stats: [statId] }] };
  }
  const last = zones[zones.length - 1];
  if (last.stats.length < MAX_STATS_PER_ZONE) {
    zones[zones.length - 1] = { ...last, stats: [...last.stats, statId] };
  } else {
    zones.push({ id: crypto.randomUUID(), stats: [statId] });
  }
  return { ...layout, statZones: zones };
}

function addWidgetToLayout(layout: DashboardLayout, widgetId: WidgetId): DashboardLayout {
  const zones = [...layout.widgetZones];
  if (zones.length === 0) {
    return { ...layout, widgetZones: [{ id: crypto.randomUUID(), widgets: [widgetId], sizes: [100] }] };
  }
  const last = zones[zones.length - 1];
  if (last.widgets.length < MAX_WIDGETS_PER_ZONE) {
    const newCount = last.widgets.length + 1;
    zones[zones.length - 1] = { ...last, widgets: [...last.widgets, widgetId], sizes: evenSizes(newCount) };
  } else {
    zones.push({ id: crypto.randomUUID(), widgets: [widgetId], sizes: [100] });
  }
  return { ...layout, widgetZones: zones };
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT: DashboardLayout = {
  statZones: [
    {
      id: "default-zone-1",
      stats: ["ingresos_hoy", "citas_hoy", "total_pacientes", "presupuesto_pendiente"],
    },
  ],
  widgetZones: [
    {
      id: "default-widget-zone-1",
      widgets: ["grafico_ingresos", "citas_hoy_lista"],
      sizes: [50, 50],
    },
    {
      id: "default-widget-zone-2",
      widgets: ["tratamientos_resumen", "equipo_resumen"],
      sizes: [50, 50],
    },
  ],
};

const STORAGE_KEY = "bamboo_dashboard_layout_v3";

function loadLayout(): DashboardLayout {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed?.statZones) && Array.isArray(parsed?.widgetZones))
        return parsed as DashboardLayout;
    }

    // Migrate from v2 format (flat widgets array)
    const v2 = localStorage.getItem("bamboo_dashboard_layout_v2");
    if (v2) {
      const parsed = JSON.parse(v2);
      if (Array.isArray(parsed?.statZones) && Array.isArray(parsed?.widgets)) {
        const widgetZones: WidgetZone[] = [];
        const widgets = parsed.widgets as WidgetId[];
        for (let i = 0; i < widgets.length; i += 2) {
          const pair = widgets.slice(i, i + 2) as WidgetId[];
          widgetZones.push({
            id: crypto.randomUUID(),
            widgets: pair,
            sizes: pair.length === 2 ? [50, 50] : [100],
          });
        }
        const migrated: DashboardLayout = { statZones: parsed.statZones, widgetZones };
        persistLayout(migrated);
        return migrated;
      }
    }

    return DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function persistLayout(layout: DashboardLayout) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardLayout() {
  const [savedLayout, setSavedLayout] = useState<DashboardLayout>(loadLayout);
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingLayout, setPendingLayout] = useState<DashboardLayout>(savedLayout);

  const displayLayout = isEditMode ? pendingLayout : savedLayout;

  // ── Mode controls ─────────────────────────────────────────────────────────
  const startEdit = useCallback(() => {
    setPendingLayout(savedLayout);
    setIsEditMode(true);
  }, [savedLayout]);

  const saveEdit = useCallback(() => {
    setSavedLayout(pendingLayout);
    persistLayout(pendingLayout);
    setIsEditMode(false);
  }, [pendingLayout]);

  const cancelEdit = useCallback(() => {
    setPendingLayout(savedLayout);
    setIsEditMode(false);
  }, [savedLayout]);

  const resetToDefault = useCallback(() => {
    setPendingLayout(DEFAULT_LAYOUT);
  }, []);

  // ── Add items from modal ──────────────────────────────────────────────────
  const addItems = useCallback(
    (newStatIds: StatId[], newWidgetIds: WidgetId[]) => {
      const merge = (prev: DashboardLayout): DashboardLayout => {
        const existingStats = new Set(flattenStats(prev));
        const existingWidgets = new Set(flattenWidgets(prev));
        let next = { ...prev };
        newStatIds.filter((id) => !existingStats.has(id)).forEach((id) => {
          next = addStatToLayout(next, id);
        });
        newWidgetIds.filter((id) => !existingWidgets.has(id)).forEach((id) => {
          next = addWidgetToLayout(next, id);
        });
        return next;
      };
      if (isEditMode) {
        setPendingLayout((prev) => merge(prev));
      } else {
        setSavedLayout((prev) => {
          const updated = merge(prev);
          persistLayout(updated);
          return updated;
        });
      }
    },
    [isEditMode]
  );

  // ── DnD — stats within a zone ────────────────────────────────────────────
  const moveStatInZone = useCallback((zoneId: string, fromIndex: number, toIndex: number) => {
    setPendingLayout((prev) => ({
      ...prev,
      statZones: prev.statZones.map((z) =>
        z.id === zoneId ? { ...z, stats: arrayMove(z.stats, fromIndex, toIndex) } : z
      ),
    }));
  }, []);

  // ── DnD — reorder stat zones ──────────────────────────────────────────────
  const moveZone = useCallback((fromIndex: number, toIndex: number) => {
    setPendingLayout((prev) => ({
      ...prev,
      statZones: arrayMove(prev.statZones, fromIndex, toIndex),
    }));
  }, []);

  // ── DnD — widgets within a zone ───────────────────────────────────────────
  const moveWidgetInZone = useCallback((zoneId: string, fromIndex: number, toIndex: number) => {
    setPendingLayout((prev) => ({
      ...prev,
      widgetZones: prev.widgetZones.map((z) =>
        z.id === zoneId
          ? { ...z, widgets: arrayMove(z.widgets, fromIndex, toIndex), sizes: arrayMove(z.sizes, fromIndex, toIndex) }
          : z
      ),
    }));
  }, []);

  // ── DnD — reorder widget zones ────────────────────────────────────────────
  const moveWidgetZone = useCallback((fromIndex: number, toIndex: number) => {
    setPendingLayout((prev) => ({
      ...prev,
      widgetZones: arrayMove(prev.widgetZones, fromIndex, toIndex),
    }));
  }, []);

  // ── Resize — widget proportions within a zone ─────────────────────────────
  const resizeWidgetInZone = useCallback((zoneId: string, sizes: number[]) => {
    setPendingLayout((prev) => ({
      ...prev,
      widgetZones: prev.widgetZones.map((z) =>
        z.id === zoneId ? { ...z, sizes } : z
      ),
    }));
  }, []);

  // ── Resize — widget zone height ───────────────────────────────────────────
  const resizeWidgetZoneHeight = useCallback((zoneId: string, height: number) => {
    setPendingLayout((prev) => ({
      ...prev,
      widgetZones: prev.widgetZones.map((z) =>
        z.id === zoneId ? { ...z, height } : z
      ),
    }));
  }, []);

  // ── Remove ────────────────────────────────────────────────────────────────
  const removeStat = useCallback((zoneId: string, statId: StatId) => {
    setPendingLayout((prev) => {
      const zones = prev.statZones
        .map((z) =>
          z.id === zoneId ? { ...z, stats: z.stats.filter((s) => s !== statId) } : z
        )
        .filter((z) => z.stats.length > 0);
      return { ...prev, statZones: zones };
    });
  }, []);

  const removeZone = useCallback((zoneId: string) => {
    setPendingLayout((prev) => ({
      ...prev,
      statZones: prev.statZones.filter((z) => z.id !== zoneId),
    }));
  }, []);

  const removeWidget = useCallback((zoneId: string, widgetId: WidgetId) => {
    setPendingLayout((prev) => {
      const zones = prev.widgetZones
        .map((z) => {
          if (z.id !== zoneId) return z;
          const newWidgets = z.widgets.filter((w) => w !== widgetId);
          return { ...z, widgets: newWidgets, sizes: newWidgets.length > 0 ? evenSizes(newWidgets.length) : [] };
        })
        .filter((z) => z.widgets.length > 0);
      return { ...prev, widgetZones: zones };
    });
  }, []);

  const removeWidgetZone = useCallback((zoneId: string) => {
    setPendingLayout((prev) => ({
      ...prev,
      widgetZones: prev.widgetZones.filter((z) => z.id !== zoneId),
    }));
  }, []);

  // ── Cross-zone moves ───────────────────────────────────────────────────────
  const moveStatBetweenZones = useCallback((fromZoneId: string, statId: StatId, toZoneId: string, toIndex: number) => {
    setPendingLayout((prev) => {
      const zones = prev.statZones
        .map((z) => {
          if (z.id === fromZoneId) return { ...z, stats: z.stats.filter((s) => s !== statId) };
          if (z.id === toZoneId) {
            const stats = [...z.stats];
            stats.splice(Math.min(Math.max(0, toIndex), stats.length), 0, statId);
            return { ...z, stats };
          }
          return z;
        })
        .filter((z) => z.stats.length > 0);
      return { ...prev, statZones: zones };
    });
  }, []);

  const moveWidgetBetweenZones = useCallback((fromZoneId: string, widgetId: WidgetId, toZoneId: string, toIndex: number) => {
    setPendingLayout((prev) => {
      const zones = prev.widgetZones
        .map((z) => {
          if (z.id === fromZoneId) {
            const w = z.widgets.filter((x) => x !== widgetId);
            return { ...z, widgets: w, sizes: w.length > 0 ? evenSizes(w.length) : [] };
          }
          if (z.id === toZoneId) {
            const widgets = [...z.widgets];
            widgets.splice(Math.min(Math.max(0, toIndex), widgets.length), 0, widgetId);
            return { ...z, widgets, sizes: evenSizes(widgets.length) };
          }
          return z;
        })
        .filter((z) => z.widgets.length > 0);
      return { ...prev, widgetZones: zones };
    });
  }, []);

  return {
    layout: displayLayout,
    isEditMode,
    startEdit,
    saveEdit,
    cancelEdit,
    resetToDefault,
    addItems,
    moveStatInZone,
    moveStatBetweenZones,
    moveZone,
    moveWidgetInZone,
    moveWidgetBetweenZones,
    moveWidgetZone,
    removeStat,
    removeZone,
    removeWidget,
    removeWidgetZone,
    resizeWidgetInZone,
    resizeWidgetZoneHeight,
  };
}
