import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Users,
  UserCircle,
  DollarSign,
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Bell,
  UserX,
  XCircle,
  CheckCircle2,
  ClipboardList,
  Stethoscope,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcPct(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
}

function PctBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-sm font-medium ${
        up ? "text-emerald-500" : "text-red-500"
      }`}
    >
      {up ? (
        <ArrowUpRight className="h-3.5 w-3.5" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" />
      )}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

const yTickFormatter = (v: number) =>
  v >= 1000 ? `S/${(v / 1000).toFixed(0)}K` : `S/${v}`;

const STATUS_COLORS: Record<string, string> = {
  pendiente: "#F59E0B",
  confirmada: "#10B981",
  completada: "#6B7280",
  cancelada: "#EF4444",
  reprogramada: "#F97316",
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  reprogramada: "Reprogramada",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const today = useMemo(() => new Date(), []);

  // ── State ──────────────────────────────────────────────────────────────────
  const [pagos, setPagos] = useState<any[]>([]);
  const [citas, setCitas] = useState<any[]>([]);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [tratamientos, setTratamientos] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const todayStart   = useMemo(() => startOfDay(today),   [today]);
  const todayEnd     = useMemo(() => endOfDay(today),     [today]);
  const monthStart   = useMemo(() => startOfMonth(today), [today]);
  const monthEnd     = useMemo(() => endOfMonth(today),   [today]);
  const yearStart    = useMemo(() => startOfYear(today),  [today]);
  const yearEnd      = useMemo(() => endOfYear(today),    [today]);

  const prevMonthStart = useMemo(() => startOfMonth(subMonths(today, 1)), [today]);
  const prevMonthEnd   = useMemo(() => endOfMonth(subMonths(today, 1)),   [today]);

  const ayerStart = useMemo(() => startOfDay(subMonths(today, 0) /* ayer via timestamp */), [today]);
  const ayerEnd   = useMemo(() => {
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

  const ingresosHoy          = useMemo(() => pagosHoy.reduce((s, p) => s + p.monto, 0),          [pagosHoy]);
  const ingresosAyer         = useMemo(() => pagosAyer.reduce((s, p) => s + p.monto, 0),         [pagosAyer]);
  const ingresosMes          = useMemo(() => pagosMes.reduce((s, p) => s + p.monto, 0),          [pagosMes]);
  const ingresosMesAnterior  = useMemo(() => pagosMesAnterior.reduce((s, p) => s + p.monto, 0),  [pagosMesAnterior]);
  const ingresosAnio         = useMemo(() => pagosAnio.reduce((s, p) => s + p.monto, 0),         [pagosAnio]);

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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground capitalize">
          {format(today, "EEEE, d 'de' MMMM yyyy", { locale: es })} — Visión general del consultorio
        </p>
      </div>

      {/* ── Top StatCards ── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ingresos de Hoy"
          value={formatCurrency(ingresosHoy)}
          icon={DollarSign}
          trend={
            ingresosAyer > 0 || ingresosHoy > 0
              ? {
                  value: `${Math.abs(calcPct(ingresosHoy, ingresosAyer)).toFixed(0)}% vs ayer`,
                  positive: ingresosHoy >= ingresosAyer,
                }
              : undefined
          }
          iconColor="bg-emerald-500"
        />
        <StatCard
          title="Citas Hoy"
          value={citasHoy.length}
          icon={Calendar}
          trend={{
            value: `${citasPorEstadoHoy.completada} completadas`,
            positive: true,
          }}
          iconColor="bg-primary"
        />
        <StatCard
          title="Total Pacientes"
          value={totalPacientes}
          icon={UserCircle}
          trend={
            nuevosEsteMes > 0
              ? { value: `+${nuevosEsteMes} este mes`, positive: true }
              : undefined
          }
          iconColor="bg-secondary"
        />
        <StatCard
          title="Deuda por Cobrar"
          value={formatCurrency(deudaTotal)}
          icon={TrendingUp}
          trend={
            pacientesConDeuda > 0
              ? { value: `${pacientesConDeuda} pacientes`, positive: false }
              : undefined
          }
          iconColor="bg-warning"
        />
      </div>

      {/* ── AreaChart + Citas de Hoy ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly income chart */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-8 mb-6">
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

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={chartDataMes}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradDashboard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={xAxisTickFormatter}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={yTickFormatter}
                  width={56}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Ingresos"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  cursor={{
                    stroke: "hsl(var(--primary))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#gradDashboard)"
                  dot={false}
                  activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Today's appointments */}
        <Card>
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
            {/* Status breakdown */}
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(citasPorEstadoHoy).map(([estado, count]) =>
                count > 0 ? (
                  <span
                    key={estado}
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${STATUS_COLORS[estado]}22`,
                      color: STATUS_COLORS[estado],
                    }}
                  >
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
                <p className="text-sm text-muted-foreground">
                  No hay citas programadas para hoy
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {citasHoyOrdenadas.map((cita) => (
                  <div
                    key={cita.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-12 text-center flex-shrink-0">
                      <p className="text-xs text-muted-foreground">Hora</p>
                      <p className="text-sm font-semibold text-primary">
                        {cita.hora || "—"}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">
                        {cita.paciente_nombre}
                      </p>
                      {cita.atendido_por && (
                        <p className="text-xs text-muted-foreground">
                          {cita.atendido_por}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cita.tipo_consulta || ""}
                      </p>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{
                        backgroundColor: `${STATUS_COLORS[cita.estado] ?? "#6B7280"}22`,
                        color: STATUS_COLORS[cita.estado] ?? "#6B7280",
                      }}
                    >
                      {STATUS_LABELS[cita.estado] ?? cita.estado}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tratamientos + Equipo ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Treatments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Tratamientos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-2xl font-bold text-foreground">
                  {tratamientosActivos.length}
                </p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-2xl font-bold text-foreground">
                  {tratamientosCompletadosMes}
                </p>
                <p className="text-xs text-muted-foreground">Completados (mes)</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-2xl font-bold text-foreground">
                  {tratamientosPausadosCancelados}
                </p>
                <p className="text-xs text-muted-foreground">Pausados/Cancelados</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Presupuesto activo</span>
                <span className="font-semibold">
                  {formatCurrency(presupuestoTotalActivo)}
                </span>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Monto cobrado</span>
                  <span className="font-medium text-emerald-500">
                    {formatCurrency(montoCobradoTotal)}
                  </span>
                </div>
                <Progress value={pctCobrado} className="h-2" />
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-emerald-500">
                    {pctCobrado.toFixed(0)}% cobrado
                  </span>
                  <span className="text-muted-foreground">
                    Pendiente: {formatCurrency(montoPendienteTotal)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Equipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                <p className="text-2xl font-bold text-foreground">
                  {empleadosActivos.length}
                </p>
                <p className="text-xs text-muted-foreground">Empleados activos</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                <p className="text-2xl font-bold text-foreground">
                  {dentistasActivos.length}
                </p>
                <p className="text-xs text-muted-foreground">Dentistas activos</p>
              </div>
            </div>

            {topDentistas.length > 0 && (
              <div className="space-y-2 pt-1 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Citas completadas este mes
                </p>
                {topDentistas.map(([nombre, count]) => (
                  <div
                    key={nombre}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium text-foreground truncate flex-1">
                      {nombre}
                    </span>
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                      {count} cita{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-1 border-t flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tasa de cancelación (mes)
              </span>
              <span
                className={`font-semibold ${
                  tasaCancelacionMes > 20 ? "text-red-500" : "text-emerald-500"
                }`}
              >
                {tasaCancelacionMes.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Pacientes + Alertas ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Pacientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                <p className="text-2xl font-bold text-foreground">{totalPacientes}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-2xl font-bold text-foreground">
                    {nuevosEsteMes}
                  </p>
                  {nuevosMesAnterior > 0 && (
                    <PctBadge pct={calcPct(nuevosEsteMes, nuevosMesAnterior)} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Nuevos este mes</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-1 border-t text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Con tratamiento activo</span>
                <span className="font-semibold">{pacientesConTratamientoActivo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Con deuda pendiente</span>
                <span className="font-semibold text-amber-500">
                  {pacientesConDeuda}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts — spans 2 columns */}
        <Card className="lg:col-span-2 border-amber-200 dark:border-amber-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell
                className={`h-5 w-5 ${
                  totalAlertas > 0 ? "text-amber-500" : "text-muted-foreground"
                }`}
              />
              Alertas y Pendientes
              {totalAlertas > 0 && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                  {totalAlertas}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Unconfirmed appointments */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg ${
                citasSinConfirmar.length > 0
                  ? "bg-amber-50 dark:bg-amber-900/10"
                  : "bg-muted/30"
              }`}
            >
              <Clock
                className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  citasSinConfirmar.length > 0
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Citas sin confirmar</p>
                <p className="text-xs text-muted-foreground">
                  Desde hoy en adelante con estado "pendiente"
                </p>
              </div>
              <span
                className={`text-sm font-bold ${
                  citasSinConfirmar.length > 0
                    ? "text-amber-600"
                    : "text-muted-foreground"
                }`}
              >
                {citasSinConfirmar.length}
              </span>
            </div>

            {/* Pending users */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg ${
                usuariosPendientes.length > 0
                  ? "bg-blue-50 dark:bg-blue-900/10"
                  : "bg-muted/30"
              }`}
            >
              <UserX
                className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  usuariosPendientes.length > 0
                    ? "text-blue-500"
                    : "text-muted-foreground"
                }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Usuarios pendientes de activación
                </p>
                <p className="text-xs text-muted-foreground">
                  Cuentas en estado "pending" sin activar
                </p>
              </div>
              <span
                className={`text-sm font-bold ${
                  usuariosPendientes.length > 0
                    ? "text-blue-600"
                    : "text-muted-foreground"
                }`}
              >
                {usuariosPendientes.length}
              </span>
            </div>

            {/* Past appointments not completed */}
            <div
              className={`flex items-start gap-3 p-3 rounded-lg ${
                citasPasadasSinCompletar.length > 0
                  ? "bg-red-50 dark:bg-red-900/10"
                  : "bg-muted/30"
              }`}
            >
              <XCircle
                className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                  citasPasadasSinCompletar.length > 0
                    ? "text-red-500"
                    : "text-muted-foreground"
                }`}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Citas pasadas sin completar</p>
                <p className="text-xs text-muted-foreground">
                  Citas anteriores a hoy sin estado final
                </p>
              </div>
              <span
                className={`text-sm font-bold ${
                  citasPasadasSinCompletar.length > 0
                    ? "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {citasPasadasSinCompletar.length}
              </span>
            </div>

            {totalAlertas === 0 && (
              <div className="flex items-center gap-2 text-emerald-500 pt-1">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">
                  Todo en orden — sin alertas pendientes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
