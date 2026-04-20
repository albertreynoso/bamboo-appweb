import { StatCard } from "@/components/dashboard/StatCard";
import { DashboardAddModal } from "@/components/dashboard/DashboardAddModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  UserCircle,
  DollarSign,
  Clock,
  TrendingUp,
  Bell,
  UserX,
  XCircle,
  CheckCircle2,
  ClipboardList,
  Stethoscope,
  Plus,
  LayoutGrid,
  GripVertical,
  X,
} from "lucide-react";
import { PctBadge, calcPct } from "@/components/common/PctBadge";
import { formatCurrency, formatCurrencyAxis } from "@/utils/formatters";
import { APPOINTMENT_STATUS_CONFIG } from "@/constants/appointmentConstants";
import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { useDashboardLayout, STAT_META, StatId, WidgetId, StatsZone, WidgetZone, MAX_WIDGETS_PER_ZONE } from "@/hooks/useDashboardLayout";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  CollisionDetection,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  subYears,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(APPOINTMENT_STATUS_CONFIG).map(([k, v]) => [k, v.hex])
);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(APPOINTMENT_STATUS_CONFIG).map(([k, v]) => [k, v.label])
);

// ─── Widget resize utility ────────────────────────────────────────────────────

/**
 * Given the container width, current flex-grow sizes, and the index of the
 * divider handle being dragged (0 = between widget 0 and 1, 1 = between 1 and 2),
 * compute new sizes applying a "push neighbour" model.
 * Minimum widget width = 25% of container (1/4 of the row).
 */
function computeNewSizes(
  containerW: number,
  handleIdx: number,
  mouseX: number,       // mouse x relative to container left edge
  currentSizes: number[]
): number[] {
  const n = currentSizes.length;
  if (n < 2) return currentSizes;

  const MIN_W = containerW * 0.25; // 25% minimum per widget

  const total = currentSizes.reduce((a, b) => a + b, 0);

  // Convert flex sizes → pixel widths
  const widths = currentSizes.map((s) => (s / total) * containerW);

  // Compute current handle x-positions (pixels from left)
  const handlePx: number[] = [];
  let cum = 0;
  for (let i = 0; i < n - 1; i++) {
    cum += widths[i];
    handlePx.push(cum);
  }

  // Clamp the dragged handle within valid range
  const minPos = (handleIdx + 1) * MIN_W;
  const maxPos = containerW - (n - 1 - handleIdx) * MIN_W;
  const newPos = Math.max(minPos, Math.min(maxPos, mouseX));

  const newHandlePx = [...handlePx];
  newHandlePx[handleIdx] = newPos;

  // Push handles to the RIGHT that would be too close
  for (let i = handleIdx + 1; i < n - 1; i++) {
    if (newHandlePx[i] < newHandlePx[i - 1] + MIN_W) {
      newHandlePx[i] = newHandlePx[i - 1] + MIN_W;
    }
  }
  // Push handles to the LEFT that would be too close
  for (let i = handleIdx - 1; i >= 0; i--) {
    if (newHandlePx[i] > newHandlePx[i + 1] - MIN_W) {
      newHandlePx[i] = newHandlePx[i + 1] - MIN_W;
    }
  }

  // Convert back to percentage sizes (summing to 100)
  const newSizes: number[] = [];
  let prev = 0;
  for (let i = 0; i < n - 1; i++) {
    newSizes.push(((newHandlePx[i] - prev) / containerW) * 100);
    prev = newHandlePx[i];
  }
  newSizes.push(((containerW - prev) / containerW) * 100);
  return newSizes;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = useMemo(() => new Date(), []);

  // ── Layout & modal ─────────────────────────────────────────────────────────
  const {
    layout,
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
  } = useDashboardLayout();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeWidgetDrag, setActiveWidgetDrag] = useState<{ id: WidgetId; width: number; height: number } | null>(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [pagos, setPagos] = useState<any[]>([]);
  const [citas, setCitas] = useState<any[]>([]);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [tratamientos, setTratamientos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const show = useMinLoading(loading);

  // ── Fetch all collections in parallel ─────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [
          pagosSnap,
          citasSnap,
          pacientesSnap,
          tratamientosSnap,
          empleadosSnap,
          usuariosSnap,
        ] = await Promise.all([
          getDocs(query(collection(db, "pagos"), orderBy("fecha", "desc"))),
          getDocs(collection(db, "citas")),
          getDocs(collection(db, "pacientes")),
          getDocs(collection(db, "tratamientos")),
          getDocs(collection(db, "personal")),
          getDocs(collection(db, "usuarios")),
        ]);

        setPagos(
          pagosSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
              monto: data.monto || 0,
              tipo: data.tipo || "consulta",
            };
          })
        );

        setCitas(
          citasSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
            };
          })
        );

        setPacientes(
          pacientesSnap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              fecha_creacion: data.fecha_creacion?.toDate
                ? data.fecha_creacion.toDate()
                : new Date(),
            };
          })
        );

        setTratamientos(
          tratamientosSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );

        setEmpleados(
          empleadosSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );

        setUsuarios(
          usuariosSnap.docs.map((d) => ({ uid: d.id, ...d.data() }))
        );
      } catch (error) {
        console.error("Error al cargar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // ── Date ranges ────────────────────────────────────────────────────────────
  const todayStart = useMemo(() => startOfDay(today), [today]);
  const todayEnd = useMemo(() => endOfDay(today), [today]);
  const monthStart = useMemo(() => startOfMonth(today), [today]);
  const monthEnd = useMemo(() => endOfMonth(today), [today]);
  const yearStart = useMemo(() => startOfYear(today), [today]);
  const yearEnd = useMemo(() => endOfYear(today), [today]);

  const prevMonthStart = useMemo(() => startOfMonth(subMonths(today, 1)), [today]);
  const prevMonthEnd = useMemo(() => endOfMonth(subMonths(today, 1)), [today]);

  const ayerStart = useMemo(() => startOfDay(subMonths(today, 0) /* ayer via timestamp */), [today]);
  const ayerEnd = useMemo(() => {
    const ayer = new Date(today);
    ayer.setDate(ayer.getDate() - 1);
    return { start: startOfDay(ayer), end: endOfDay(ayer) };
  }, [today]);

  // ── FINANCIAL METRICS ──────────────────────────────────────────────────────
  const pagosHoy = useMemo(
    () => pagos.filter((p) => p.fecha >= todayStart && p.fecha <= todayEnd),
    [pagos, todayStart, todayEnd]
  );

  const pagosAyer = useMemo(() => {
    const { start, end } = ayerEnd;
    return pagos.filter((p) => p.fecha >= start && p.fecha <= end);
  }, [pagos, ayerEnd]);

  const pagosMes = useMemo(
    () => pagos.filter((p) => p.fecha >= monthStart && p.fecha <= monthEnd),
    [pagos, monthStart, monthEnd]
  );

  const pagosMesAnterior = useMemo(
    () => pagos.filter((p) => p.fecha >= prevMonthStart && p.fecha <= prevMonthEnd),
    [pagos, prevMonthStart, prevMonthEnd]
  );

  const pagosAnio = useMemo(
    () => pagos.filter((p) => p.fecha >= yearStart && p.fecha <= yearEnd),
    [pagos, yearStart, yearEnd]
  );

  const ingresosHoy = useMemo(() => pagosHoy.reduce((s, p) => s + p.monto, 0), [pagosHoy]);
  const ingresosAyer = useMemo(() => pagosAyer.reduce((s, p) => s + p.monto, 0), [pagosAyer]);
  const ingresosMes = useMemo(() => pagosMes.reduce((s, p) => s + p.monto, 0), [pagosMes]);
  const ingresosMesAnterior = useMemo(() => pagosMesAnterior.reduce((s, p) => s + p.monto, 0), [pagosMesAnterior]);
  const ingresosAnio = useMemo(() => pagosAnio.reduce((s, p) => s + p.monto, 0), [pagosAnio]);

  const deudaTotal = useMemo(
    () =>
      tratamientos
        .filter((t) => t.estado === "activo" || t.estado === "en_progreso")
        .reduce((s, t) => s + (t.pago_pendiente || 0), 0),
    [tratamientos]
  );

  // Monthly income chart (day-by-day for current month)
  const chartDataMes = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return days.map((day) => ({
      label: format(day, "d"),
      total: pagosMes
        .filter((p) => isSameDay(new Date(p.fecha), day))
        .reduce((s, p) => s + p.monto, 0),
    }));
  }, [pagosMes, monthStart, monthEnd]);

  const xAxisTickFormatter = (val: string) => {
    const n = parseInt(val, 10);
    return n === 1 || n % 5 === 0 ? val : "";
  };

  // ── APPOINTMENT METRICS ────────────────────────────────────────────────────
  const citasHoy = useMemo(
    () =>
      citas.filter((c) => {
        const f = new Date(c.fecha);
        return f >= todayStart && f <= todayEnd;
      }),
    [citas, todayStart, todayEnd]
  );

  const citasMes = useMemo(
    () =>
      citas.filter((c) => {
        const f = new Date(c.fecha);
        return f >= monthStart && f <= monthEnd;
      }),
    [citas, monthStart, monthEnd]
  );

  const citasPorEstadoHoy = useMemo(() => {
    const counts: Record<string, number> = {
      pendiente: 0,
      confirmada: 0,
      completada: 0,
      cancelada: 0,
      reprogramada: 0,
    };
    citasHoy.forEach((c) => {
      if (c.estado in counts) counts[c.estado]++;
    });
    return counts;
  }, [citasHoy]);

  const citasHoyOrdenadas = useMemo(
    () => [...citasHoy].sort((a, b) => (a.hora || "").localeCompare(b.hora || "")),
    [citasHoy]
  );

  const canceladasMes = useMemo(
    () => citasMes.filter((c) => c.estado === "cancelada").length,
    [citasMes]
  );
  const tasaCancelacionMes = useMemo(
    () => (citasMes.length > 0 ? (canceladasMes / citasMes.length) * 100 : 0),
    [canceladasMes, citasMes]
  );

  // ── PATIENT METRICS ────────────────────────────────────────────────────────
  const totalPacientes = pacientes.length;

  const nuevosEsteMes = useMemo(
    () =>
      pacientes.filter((p) => {
        const f = new Date(p.fecha_creacion);
        return f >= monthStart && f <= monthEnd;
      }).length,
    [pacientes, monthStart, monthEnd]
  );

  const nuevosMesAnterior = useMemo(
    () =>
      pacientes.filter((p) => {
        const f = new Date(p.fecha_creacion);
        return f >= prevMonthStart && f <= prevMonthEnd;
      }).length,
    [pacientes, prevMonthStart, prevMonthEnd]
  );

  const pacientesConTratamientoActivo = useMemo(() => {
    const ids = new Set(
      tratamientos
        .filter((t) => t.estado === "activo" || t.estado === "en_progreso")
        .map((t) => t.paciente_id)
    );
    return ids.size;
  }, [tratamientos]);

  const pacientesConDeuda = useMemo(() => {
    const ids = new Set(
      tratamientos
        .filter((t) => (t.pago_pendiente || 0) > 0)
        .map((t) => t.paciente_id)
    );
    return ids.size;
  }, [tratamientos]);

  // ── TREATMENT METRICS ──────────────────────────────────────────────────────
  const tratamientosActivos = useMemo(
    () =>
      tratamientos.filter(
        (t) => t.estado === "activo" || t.estado === "en_progreso"
      ),
    [tratamientos]
  );

  const tratamientosCompletadosMes = useMemo(
    () =>
      tratamientos.filter((t) => {
        if (t.estado !== "completado") return false;
        const raw = t.fecha_fin;
        const f = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
        return f && f >= monthStart && f <= monthEnd;
      }).length,
    [tratamientos, monthStart, monthEnd]
  );

  const tratamientosPausadosCancelados = useMemo(
    () =>
      tratamientos.filter(
        (t) => t.estado === "pausado" || t.estado === "cancelado"
      ).length,
    [tratamientos]
  );

  const presupuestoTotalActivo = useMemo(
    () => tratamientosActivos.reduce((s, t) => s + (t.total_presupuesto || 0), 0),
    [tratamientosActivos]
  );

  const montoCobradoTotal = useMemo(
    () => tratamientosActivos.reduce((s, t) => s + (t.monto_abonado || 0), 0),
    [tratamientosActivos]
  );

  const montoPendienteTotal = useMemo(
    () => tratamientosActivos.reduce((s, t) => s + (t.pago_pendiente || 0), 0),
    [tratamientosActivos]
  );

  const pctCobrado =
    presupuestoTotalActivo > 0
      ? (montoCobradoTotal / presupuestoTotalActivo) * 100
      : 0;

  // ── EMPLOYEE METRICS ───────────────────────────────────────────────────────
  const empleadosActivos = useMemo(
    () => empleados.filter((e) => e.activo !== false),
    [empleados]
  );

  const dentistasActivos = useMemo(
    () =>
      empleadosActivos.filter((e) => {
        const tipo = (e.tipo_empleado_id || "").toLowerCase();
        return tipo.includes("dentista") || tipo.includes("odontólogo") || tipo.includes("odontologo");
      }),
    [empleadosActivos]
  );

  const topDentistas = useMemo(() => {
    const completadas = citasMes.filter((c) => c.estado === "completada");
    const counts: Record<string, number> = {};
    completadas.forEach((c) => {
      if (c.atendido_por) counts[c.atendido_por] = (counts[c.atendido_por] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [citasMes]);

  // ── ALERTS ─────────────────────────────────────────────────────────────────
  const citasSinConfirmar = useMemo(
    () =>
      citas.filter((c) => {
        const f = new Date(c.fecha);
        return c.estado === "pendiente" && f >= todayStart;
      }),
    [citas, todayStart]
  );

  const usuariosPendientes = useMemo(
    () => usuarios.filter((u) => u.estado === "pending"),
    [usuarios]
  );

  const citasPasadasSinCompletar = useMemo(
    () =>
      citas.filter((c) => {
        const f = new Date(c.fecha);
        return (
          f < todayStart &&
          c.estado !== "completada" &&
          c.estado !== "cancelada"
        );
      }),
    [citas, todayStart]
  );

  const totalAlertas =
    citasSinConfirmar.length +
    usuariosPendientes.length +
    citasPasadasSinCompletar.length;

  // ── Stat data mapper ───────────────────────────────────────────────────────
  const getStatProps = (id: StatId) => {
    switch (id) {
      case "ingresos_hoy":
        return {
          value: formatCurrency(ingresosHoy),
          trend:
            ingresosAyer > 0 || ingresosHoy > 0
              ? {
                value: `${Math.abs(calcPct(ingresosHoy, ingresosAyer)).toFixed(0)}% vs ayer`,
                positive: ingresosHoy >= ingresosAyer,
              }
              : undefined,
        };
      case "ingresos_mes":
        return {
          value: formatCurrency(ingresosMes),
          trend: {
            value: `${Math.abs(calcPct(ingresosMes, ingresosMesAnterior)).toFixed(0)}% vs mes ant.`,
            positive: ingresosMes >= ingresosMesAnterior,
          },
        };
      case "total_pacientes":
        return {
          value: totalPacientes,
          trend:
            nuevosEsteMes > 0
              ? { value: `+${nuevosEsteMes} este mes`, positive: true }
              : undefined,
        };
      case "citas_hoy":
        return {
          value: citasHoy.length,
          trend: { value: `${citasPorEstadoHoy.completada} completadas`, positive: true },
        };
      case "presupuesto_pendiente":
        return {
          value: formatCurrency(deudaTotal),
          trend:
            pacientesConDeuda > 0
              ? { value: `${pacientesConDeuda} pacientes`, positive: false }
              : undefined,
        };
      case "empleados_activos":
        return {
          value: empleadosActivos.length,
          trend:
            dentistasActivos.length > 0
              ? { value: `${dentistasActivos.length} dentistas`, positive: true }
              : undefined,
        };
      case "tratamientos_activos":
        return {
          value: tratamientosActivos.length,
          trend:
            tratamientosCompletadosMes > 0
              ? { value: `${tratamientosCompletadosMes} completados este mes`, positive: true }
              : undefined,
        };
      case "tasa_cancelacion":
        return {
          value: `${tasaCancelacionMes.toFixed(1)}%`,
          trend: { value: `${canceladasMes} canceladas`, positive: tasaCancelacionMes <= 15 },
        };
      case "nuevos_pacientes_mes":
        return {
          value: nuevosEsteMes,
          trend:
            nuevosMesAnterior > 0
              ? {
                value: `${calcPct(nuevosEsteMes, nuevosMesAnterior) >= 0 ? "+" : ""}${calcPct(nuevosEsteMes, nuevosMesAnterior).toFixed(0)}% vs mes ant.`,
                positive: nuevosEsteMes >= nuevosMesAnterior,
              }
              : undefined,
        };
      default:
        return { value: "—", trend: undefined };
    }
  };

  // ── Widget renderer ────────────────────────────────────────────────────────
  const renderWidgetContent = (id: WidgetId) => {
    switch (id) {
      case "grafico_ingresos":
        return (
          <>
            <CardContent className="pt-6 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-start gap-8 mb-6 flex-none">
                <div className="flex-none">
                  <p className="text-sm text-muted-foreground mb-1">
                    Ingresos del mes ({format(today, "MMMM", { locale: es })})
                  </p>
                  <p className="text-3xl font-bold text-foreground leading-none mb-1.5">
                    {formatCurrency(ingresosMes)}
                  </p>
                  <PctBadge pct={calcPct(ingresosMes, ingresosMesAnterior)} />
                </div>
                <div className="w-px self-stretch bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Del año</p>
                  <p className="text-2xl font-bold text-foreground leading-none mb-1.5">
                    {formatCurrency(ingresosAnio)}
                  </p>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDataMes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradDashboard" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={xAxisTickFormatter} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={formatCurrencyAxis} width={56} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }}
                      labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
                    />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gradDashboard)" dot={false} activeDot={{ r: 5, fill: "hsl(var(--primary))" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </>
        );

      case "citas_hoy_lista":
        return (
          <>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Citas de Hoy
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {citasHoy.length} total
                </span>
              </CardTitle>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(citasPorEstadoHoy).map(([estado, count]) =>
                  count > 0 ? (
                    <span key={estado} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${STATUS_COLORS[estado]}22`, color: STATUS_COLORS[estado] }}>
                      {STATUS_LABELS[estado]}: {count}
                    </span>
                  ) : null
                )}
              </div>
            </CardHeader>
            <CardContent>
              {citasHoyOrdenadas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No hay citas programadas para hoy</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {citasHoyOrdenadas.map((cita) => (
                    <div key={cita.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="w-12 text-center flex-shrink-0">
                        <p className="text-xs text-muted-foreground">Hora</p>
                        <p className="text-sm font-semibold text-primary">{cita.hora || "—"}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{cita.paciente_nombre}</p>
                        {cita.atendido_por && <p className="text-xs text-muted-foreground">{cita.atendido_por}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">{cita.tipo_consulta || ""}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: `${STATUS_COLORS[cita.estado] ?? "#6B7280"}22`, color: STATUS_COLORS[cita.estado] ?? "#6B7280" }}>
                        {STATUS_LABELS[cita.estado] ?? cita.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </>
        );

      case "tratamientos_resumen":
        return (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Tratamientos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-2xl font-bold text-foreground">{tratamientosActivos.length}</p>
                  <p className="text-xs text-muted-foreground">Activos</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-2xl font-bold text-foreground">{tratamientosCompletadosMes}</p>
                  <p className="text-xs text-muted-foreground">Completados (mes)</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-2xl font-bold text-foreground">{tratamientosPausadosCancelados}</p>
                  <p className="text-xs text-muted-foreground">Pausados/Cancelados</p>
                </div>
              </div>
              <div className="space-y-3 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Presupuesto activo</span>
                  <span className="font-semibold">{formatCurrency(presupuestoTotalActivo)}</span>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Monto cobrado</span>
                    <span className="font-medium text-emerald-500">{formatCurrency(montoCobradoTotal)}</span>
                  </div>
                  <Progress value={pctCobrado} className="h-2" />
                  <div className="flex justify-between text-xs mt-1.5">
                    <span className="text-emerald-500">{pctCobrado.toFixed(0)}% cobrado</span>
                    <span className="text-muted-foreground">Pendiente: {formatCurrency(montoPendienteTotal)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        );

      case "equipo_resumen":
        return (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Equipo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                  <p className="text-2xl font-bold text-foreground">{empleadosActivos.length}</p>
                  <p className="text-xs text-muted-foreground">Empleados activos</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                  <p className="text-2xl font-bold text-foreground">{dentistasActivos.length}</p>
                  <p className="text-xs text-muted-foreground">Dentistas activos</p>
                </div>
              </div>
              {topDentistas.length > 0 && (
                <div className="space-y-2 pt-1 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Citas completadas este mes
                  </p>
                  {topDentistas.map(([nombre, count]) => (
                    <div key={nombre} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground truncate flex-1">{nombre}</span>
                      <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                        {count} cita{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-1 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">Tasa de cancelación (mes)</span>
                <span className={`font-semibold ${tasaCancelacionMes > 20 ? "text-red-500" : "text-emerald-500"}`}>
                  {tasaCancelacionMes.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </>
        );

      default:
        return null;
    }
  };

  // ── DnD handlers ───────────────────────────────────────────────────────────
  // ── Unified stat DnD handler (zones + items, cross-zone) ──────────────────
  const handleStatsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    const activeIsZone = layout.statZones.some((z) => z.id === activeId);
    if (activeIsZone) {
      // Zone reorder: over.id may be a zone ID or a stat ID inside a zone
      let toZoneId = overId;
      if (!layout.statZones.some((z) => z.id === overId)) {
        const z = layout.statZones.find((z) => z.stats.includes(overId as StatId));
        if (!z) return;
        toZoneId = z.id;
      }
      const from = layout.statZones.findIndex((z) => z.id === activeId);
      const to = layout.statZones.findIndex((z) => z.id === toZoneId);
      if (from !== -1 && to !== -1 && from !== to) moveZone(from, to);
      return;
    }

    // Stat drag: find source and target
    const fromZone = layout.statZones.find((z) => z.stats.includes(activeId as StatId));
    if (!fromZone) return;
    let toZone = layout.statZones.find((z) => z.id === overId);
    let toIndex = toZone ? toZone.stats.length : -1;
    if (!toZone) {
      toZone = layout.statZones.find((z) => z.stats.includes(overId as StatId));
      if (toZone) toIndex = toZone.stats.indexOf(overId as StatId);
    }
    if (!toZone) return;
    if (fromZone.id === toZone.id) {
      const from = fromZone.stats.indexOf(activeId as StatId);
      if (from !== -1 && toIndex !== -1 && from !== toIndex) moveStatInZone(fromZone.id, from, toIndex);
    } else {
      moveStatBetweenZones(fromZone.id, activeId as StatId, toZone.id, toIndex);
    }
  };

  // ── Unified widget DnD handler (zones + items, cross-zone) ─────────────────
  const handleWidgetsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    const activeIsZone = layout.widgetZones.some((z) => z.id === activeId);
    if (activeIsZone) {
      let toZoneId = overId;
      if (!layout.widgetZones.some((z) => z.id === overId)) {
        const z = layout.widgetZones.find((z) => z.widgets.includes(overId as WidgetId));
        if (!z) return;
        toZoneId = z.id;
      }
      const from = layout.widgetZones.findIndex((z) => z.id === activeId);
      const to = layout.widgetZones.findIndex((z) => z.id === toZoneId);
      if (from !== -1 && to !== -1 && from !== to) moveWidgetZone(from, to);
      return;
    }

    const fromZone = layout.widgetZones.find((z) => z.widgets.includes(activeId as WidgetId));
    if (!fromZone) return;
    let toZone = layout.widgetZones.find((z) => z.id === overId);
    let toIndex = toZone ? toZone.widgets.length : -1;
    if (!toZone) {
      toZone = layout.widgetZones.find((z) => z.widgets.includes(overId as WidgetId));
      if (toZone) toIndex = toZone.widgets.indexOf(overId as WidgetId);
    }
    if (!toZone) return;
    // Respect max widgets per zone for cross-zone moves
    if (fromZone.id !== toZone.id && toZone.widgets.length >= MAX_WIDGETS_PER_ZONE) return;
    if (fromZone.id === toZone.id) {
      const from = fromZone.widgets.indexOf(activeId as WidgetId);
      if (from !== -1 && toIndex !== -1 && from !== toIndex) moveWidgetInZone(fromZone.id, from, toIndex);
    } else {
      moveWidgetBetweenZones(fromZone.id, activeId as WidgetId, toZone.id, toIndex);
    }
  };

  // ── Custom collision detection for widgets (55% overlap threshold) ──────────
  const widgetsDndCollision = React.useCallback<CollisionDetection>((args) => {
    const { active, collisionRect, droppableRects, droppableContainers } = args;

    // Zone being dragged → standard closest center
    if (layout.widgetZones.some((z) => z.id === active.id)) {
      return closestCenter(args);
    }

    const zoneIds = new Set<UniqueIdentifier>(layout.widgetZones.map((z) => z.id));
    const itemHits: Array<{ id: UniqueIdentifier; data: { droppableContainer: unknown; value: number } }> = [];
    const zoneHits: Array<{ id: UniqueIdentifier; data: { droppableContainer: unknown; value: number } }> = [];

    for (const container of droppableContainers) {
      const { id } = container;
      if (id === active.id) continue;
      const rect = droppableRects.get(id);
      if (!rect) continue;

      const ox = Math.max(0, Math.min(collisionRect.right, rect.right) - Math.max(collisionRect.left, rect.left));
      const oy = Math.max(0, Math.min(collisionRect.bottom, rect.bottom) - Math.max(collisionRect.top, rect.top));
      if (ox <= 0 || oy <= 0) continue;

      if (zoneIds.has(id)) {
        // Zone container: any intersection qualifies (enables cross-zone drops)
        zoneHits.push({ id, data: { droppableContainer: container, value: ox * oy } });
      } else {
        // Widget item: require ≥55% horizontal overlap before swapping
        const ratio = ox / rect.width;
        if (ratio >= 0.55) {
          itemHits.push({ id, data: { droppableContainer: container, value: ratio } });
        }
      }
    }

    // Prefer same-zone widget collisions; fall back to zone for cross-zone
    const ranked = itemHits.length > 0 ? itemHits : zoneHits;
    return ranked.sort((a, b) => b.data.value - a.data.value);
  }, [layout.widgetZones]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (show) return <PageLoader message="Cargando dashboard..." />;

  const totalStats = layout.statZones.reduce((s, z) => s + z.stats.length, 0);
  const totalWidgets = layout.widgetZones.reduce((s, z) => s + z.widgets.length, 0);
  const isEmpty = totalStats === 0 && totalWidgets === 0;

  return (
    <div className="space-y-[18px] pb-0">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 capitalize">
            {format(today, "EEEE, d 'de' MMMM 'del' yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={isEditMode ? saveEdit : startEdit}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {isEditMode ? "Guardar layout" : "Editar layout"}
          </Button>
        </div>
      </div>

      {/* ── Stats zones ── */}
      {layout.statZones.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleStatsDragEnd}>
          <SortableContext items={layout.statZones.map((z) => z.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-[18px]">
              {layout.statZones.map((zone) => (
                <SortableStatsZone
                  key={zone.id}
                  zone={zone}
                  isEditMode={isEditMode}
                  onRemoveStat={(statId) => removeStat(zone.id, statId)}
                  onRemoveZone={() => removeZone(zone.id)}
                  getStatProps={getStatProps}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ── Widget zones ── */}
      {layout.widgetZones.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={widgetsDndCollision}
          onDragStart={(e: DragStartEvent) => {
            const id = e.active.id as string;
            if (!layout.widgetZones.some((z) => z.id === id)) {
              const rect = e.active.rect.current?.initial;
              setActiveWidgetDrag({
                id: id as WidgetId,
                width: rect?.width ?? 400,
                height: rect?.height ?? 300,
              });
            }
          }}
          onDragEnd={(e) => { setActiveWidgetDrag(null); handleWidgetsDragEnd(e); }}
          onDragCancel={() => setActiveWidgetDrag(null)}
        >
          <SortableContext items={layout.widgetZones.map((z) => z.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-[18px]">
              {layout.widgetZones.map((zone) => (
                <SortableWidgetZone
                  key={zone.id}
                  zone={zone}
                  isEditMode={isEditMode}
                  activeWidgetId={activeWidgetDrag?.id ?? null}
                  onRemoveWidget={(widgetId) => removeWidget(zone.id, widgetId)}
                  onRemoveZone={() => removeWidgetZone(zone.id)}
                  onResize={(sizes) => resizeWidgetInZone(zone.id, sizes)}
                  onResizeHeight={(height) => resizeWidgetZoneHeight(zone.id, height)}
                  renderWidgetContent={renderWidgetContent}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag overlay: clon semitransparente que sigue el cursor */}
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
            {activeWidgetDrag && (
              <div
                style={{ width: activeWidgetDrag.width, height: activeWidgetDrag.height }}
                className="opacity-80 shadow-2xl rounded-xl overflow-hidden"
              >
                <Card className="h-full flex flex-col">
                  {renderWidgetContent(activeWidgetDrag.id)}
                </Card>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="p-4 rounded-2xl bg-muted">
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Dashboard vacío</p>
            <p className="text-sm text-muted-foreground mt-1">Añade estadísticas y widgets para personalizar tu vista</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4" /> Añadir elementos
          </Button>
        </div>
      )}

      {/* ── Edit mode floating bar ── */}
      {isEditMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-card border border-border/70 shadow-xl rounded-2xl px-4 py-2.5">
          <button onClick={resetToDefault} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted">
            Restablecer
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button onClick={cancelEdit} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted">
            Cancelar
          </button>
          <Button size="sm" className="h-7 text-xs gap-1.5 ml-1" onClick={saveEdit}>
            Guardar cambios
          </Button>
        </div>
      )}

      <DashboardAddModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        currentLayout={layout}
        onAdd={addItems}
      />
    </div>
  );
}

// ─── Sortable sub-components ──────────────────────────────────────────────────

function SortableStatsZone({
  zone,
  isEditMode,
  onRemoveStat,
  onRemoveZone,
  getStatProps,
}: {
  zone: StatsZone;
  isEditMode: boolean;
  onRemoveStat: (statId: StatId) => void;
  onRemoveZone: () => void;
  getStatProps: (id: StatId) => { value: string | number; trend?: { value: string; positive: boolean } };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.id });
  const style = {
    transform: transform ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 }) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [removeHovered, setRemoveHovered] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch rounded-xl transition-colors",
        isEditMode && cn("-ml-8", removeHovered ? "bg-destructive/10" : "bg-muted/90")
      )}
    >
      {/* Left controls column — edit mode only */}
      {isEditMode && (
        <div className="w-8 flex-none flex flex-col items-end justify-center gap-1 py-2 pr-0">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
            title="Arrastrar zona"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            onClick={onRemoveZone}
            onMouseEnter={() => setRemoveHovered(true)}
            onMouseLeave={() => setRemoveHovered(false)}
            className={cn(
              "p-1 rounded transition-colors",
              removeHovered ? "text-destructive" : "text-muted-foreground/40 hover:text-destructive"
            )}
            title="Eliminar zona"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="flex-1 min-w-0 px-3 py-[5px]">
        <SortableContext items={zone.stats} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-3 items-stretch">
            {zone.stats.map((statId) => (
              <SortableStat
                key={statId}
                id={statId}
                isEditMode={isEditMode}
                onRemove={() => onRemoveStat(statId)}
                getStatProps={getStatProps}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableStat({
  id,
  isEditMode,
  onRemove,
  getStatProps,
}: {
  id: StatId;
  isEditMode: boolean;
  onRemove: () => void;
  getStatProps: (id: StatId) => { value: string | number; trend?: { value: string; positive: boolean } };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });
  const style = {
    transform: transform ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 }) : undefined,
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  const meta = STAT_META[id];
  const data = getStatProps(id);

  return (
    <div ref={setNodeRef} style={style} className={cn("relative flex flex-col flex-1 min-w-0", isEditMode && "pt-3")}>
      {isEditMode && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-card border border-border/70 shadow-md rounded-lg px-1 py-0.5">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            title="Arrastrar"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <div className="w-px h-3 bg-border" />
          <button onClick={onRemove} className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className={cn("h-full", isEditMode && "ring-2 ring-dashed ring-primary/90 rounded-xl")}>
        <StatCard title={meta.label} icon={meta.icon} iconBg={meta.iconBg} iconText={meta.iconText} value={data.value} trend={data.trend} />
      </div>
    </div>
  );
}

function SortableWidget({
  id,
  isEditMode,
  isActiveDrag,
  onRemove,
  children,
  flexGrow,
}: {
  id: WidgetId;
  isEditMode: boolean;
  isActiveDrag: boolean;
  onRemove: () => void;
  children: React.ReactNode;
  flexGrow: number;
}) {
  const { attributes, listeners, setNodeRef, transition } = useSortable({
    id,
    transition: { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  });
  const style: React.CSSProperties = {
    // No transform on the original slot — DragOverlay handles the visual drag
    transition,
    // When this widget is being dragged, show a faint placeholder in its original slot
    opacity: isActiveDrag ? 0.25 : 1,
    flex: `${flexGrow} 1 0%`,
    minWidth: 0,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(isEditMode && "pt-3")}>
      {isEditMode && !isActiveDrag && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 bg-card border border-border/70 shadow-md rounded-lg px-1 py-0.5">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
            title="Arrastrar"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <div className="w-px h-3 bg-border" />
          <button onClick={onRemove} className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Quitar widget">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── SortableWidgetZone ─────────────────────────────────────────────────────

function SortableWidgetZone({
  zone,
  isEditMode,
  activeWidgetId,
  onRemoveWidget,
  onRemoveZone,
  onResize,
  onResizeHeight,
  renderWidgetContent,
}: {
  zone: WidgetZone;
  isEditMode: boolean;
  activeWidgetId: WidgetId | null;
  onRemoveWidget: (widgetId: WidgetId) => void;
  onRemoveZone: () => void;
  onResize: (sizes: number[]) => void;
  onResizeHeight: (height: number) => void;
  renderWidgetContent: (id: WidgetId) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zone.id });
  const style = {
    transform: transform ? CSS.Transform.toString({ ...transform, scaleX: 1, scaleY: 1 }) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [removeHovered, setRemoveHovered] = useState(false);

  /**
   * Returns a mousedown handler for the divider at `handleIdx`.
   * withHeight=false → horizontal resize only (col-resize)
   * withHeight=true  → horizontal + vertical resize (corner grip)
   */
  const makeDividerHandler = (handleIdx: number, withHeight: boolean) =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const startY = e.clientY;
      const startHeight = rect.height;

      const onMove = (ev: MouseEvent) => {
        // Horizontal (always)
        const mouseX = ev.clientX - rect.left;
        onResize(computeNewSizes(rect.width, handleIdx, mouseX, zone.sizes));
        // Vertical (corner only)
        if (withHeight) {
          onResizeHeight(Math.max(200, startHeight + (ev.clientY - startY)));
        }
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = withHeight ? "nesw-resize" : "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch rounded-xl transition-colors",
        isEditMode && cn("-ml-8", removeHovered ? "bg-destructive/10" : "bg-muted/90")
      )}
    >
      {/* Left controls column — edit mode only */}
      {isEditMode && (
        <div className="w-8 flex-none flex flex-col items-end justify-center gap-1 py-2 pr-0">
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
            title="Arrastrar zona"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            onClick={onRemoveZone}
            onMouseEnter={() => setRemoveHovered(true)}
            onMouseLeave={() => setRemoveHovered(false)}
            className={cn(
              "p-1 rounded transition-colors",
              removeHovered ? "text-destructive" : "text-muted-foreground/40 hover:text-destructive"
            )}
            title="Eliminar zona"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Widgets row with inner DnD */}
      <div className="flex-1 min-w-0 px-3 py-[5px]">
        <SortableContext items={zone.widgets} strategy={horizontalListSortingStrategy}>
          <div
            ref={containerRef}
            className="flex items-stretch overflow-visible"
            style={{ height: zone.height ? `${zone.height}px` : undefined }}
          >
            {zone.widgets.map((widgetId, widgetIdx) => (
              <React.Fragment key={widgetId}>
                {widgetIdx > 0 && (
                  isEditMode ? (
                    /* ── Internal divider — lateral resize ── */
                    <div
                      className="w-3 flex-none flex items-center justify-center cursor-col-resize group z-10"
                      onMouseDown={makeDividerHandler(widgetIdx - 1, false)}
                    >
                      <div className="w-0.5 h-10 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
                    </div>
                  ) : (
                    <div className="w-3 flex-none" />
                  )
                )}

                <SortableWidget
                  id={widgetId}
                  isEditMode={isEditMode}
                  isActiveDrag={activeWidgetId === widgetId}
                  onRemove={() => onRemoveWidget(widgetId)}
                  flexGrow={zone.sizes[widgetIdx] ?? (100 / zone.widgets.length)}
                >
                  <>
                    <Card className={cn("h-full flex flex-col", isEditMode && "ring-2 ring-dashed ring-primary/90")}>
                      {renderWidgetContent(widgetId)}
                    </Card>

                    {/* Internal bottom-RIGHT corner grip → controls right boundary */}
                    {isEditMode && widgetIdx < zone.widgets.length - 1 && (
                      <div
                        className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center cursor-nwse-resize opacity-40 hover:opacity-100 transition-opacity z-20"
                        onMouseDown={(e) => { e.stopPropagation(); makeDividerHandler(widgetIdx, true)(e); }}
                        title="Redimensionar"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground rotate-90">
                          <path d="M1 1L9 9M5 1L9 5M1 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}

                    {/* Internal bottom-LEFT corner grip → controls left boundary */}
                    {isEditMode && widgetIdx > 0 && (
                      <div
                        className="absolute bottom-1 left-1 w-5 h-5 flex items-center justify-center cursor-nesw-resize opacity-40 hover:opacity-100 transition-opacity z-20"
                        onMouseDown={(e) => { e.stopPropagation(); makeDividerHandler(widgetIdx - 1, true)(e); }}
                        title="Redimensionar"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground rotate-90">
                          <path d="M9 1L1 9M5 1L1 5M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                  </>
                </SortableWidget>
              </React.Fragment>
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
