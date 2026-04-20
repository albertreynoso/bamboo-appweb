import { Card, CardContent } from "@/components/ui/card";
import { useAuthContext } from "@/context/AuthContext";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  FileText,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Banknote,
  CreditCard,
  Send,
  TrendingUp,
  Receipt,
  Activity,
  List,
} from "lucide-react";
import { calcPct } from "@/components/common/PctBadge";
import { getAllPayments } from "@/services/paymentService";
import { formatCurrencyAxis } from "@/utils/formatters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo, useRef } from "react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import PaymentDialog from "@/components/payments/PaymentDialog";
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
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  eachHourOfInterval,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameHour,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";

type PeriodType = "dia" | "semana" | "mes" | "anio";

const PERIOD_OPTIONS: { label: string; value: PeriodType }[] = [
  { label: "Día", value: "dia" },
  { label: "Semana", value: "semana" },
  { label: "Mes", value: "mes" },
  { label: "Año", value: "anio" },
];

function getMetodoCfg(metodo: string): {
  color: string;
  bg: string;
  ring: string;
  Icon: typeof Banknote;
  label: string;
} {
  const m = metodo.toLowerCase();
  if (m.includes("efectivo") || m.includes("cash")) {
    return { color: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200", Icon: Banknote, label: "Efectivo" };
  }
  if (m.includes("tarjeta") || m.includes("card") || m.includes("débito") || m.includes("crédito")) {
    return { color: "text-blue-700", bg: "bg-blue-50", ring: "ring-blue-200", Icon: CreditCard, label: "Tarjeta" };
  }
  if (m.includes("transferencia") || m.includes("transfer") || m.includes("yape") || m.includes("plin")) {
    return { color: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200", Icon: Send, label: metodo };
  }
  return { color: "text-gray-600", bg: "bg-gray-100", ring: "ring-gray-200", Icon: Receipt, label: metodo };
}

export default function Pagos() {
  const { rol } = useAuthContext();
  const isRecepcionista = rol === "recepcionista";

  const [searchTerm, setSearchTerm] = useState("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [chartFullHeight, setChartFullHeight] = useState(420);
  const [pagos, setPagos] = useState<any[]>([]);
  const [loadingPagos, setLoadingPagos] = useState(true);
  const show = useMinLoading(loadingPagos);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialLoad = useRef(true);
  const [period, setPeriod] = useState<PeriodType>("mes");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [historialPeriod, setHistorialPeriod] = useState<"todo" | PeriodType>("todo");
  const [sortBy, setSortBy] = useState<"reciente" | "antiguo" | "mayor_monto" | "menor_monto">("reciente");

  const fetchPagos = async () => {
    try {
      if (isInitialLoad.current) { setLoadingPagos(true); } else { setRefreshing(true); }
      const pagosData = await getAllPayments();
      setPagos(pagosData);
    } catch (error) {
      console.error("Error al cargar pagos:", error);
    } finally {
      setLoadingPagos(false);
      setRefreshing(false);
      isInitialLoad.current = false;
    }
  };

  useEffect(() => {
    fetchPagos();
  }, []);

  // Compute chart height dynamically to fill available viewport space
  useEffect(() => {
    const compute = () => {
      // Approximate pixels consumed above the chart area:
      // layout padding(64) + header(80) + gap(24) + period-row(40) + gap(24) + stat-cards(72) + gap(24) + chart-label(54)
      const aboveChart = 64 + 80 + 24 + 40 + 24 + 72 + 24 + 54;
      setChartFullHeight(Math.max(220, window.innerHeight - aboveChart));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const firstPaymentDate = useMemo(() => {
    if (pagos.length === 0) return null;
    return pagos.reduce((earliest, p) => {
      const d = new Date(p.fecha);
      return d < earliest ? d : earliest;
    }, new Date(pagos[0].fecha));
  }, [pagos]);

  const dateRange = useMemo(() => {
    switch (period) {
      case "dia":
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case "semana":
        return {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };
      case "mes":
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case "anio":
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
    }
  }, [period, currentDate]);

  const prevDateRange = useMemo(() => {
    switch (period) {
      case "dia": {
        const prev = subDays(currentDate, 1);
        return { start: startOfDay(prev), end: endOfDay(prev) };
      }
      case "semana": {
        const prev = subWeeks(currentDate, 1);
        return {
          start: startOfWeek(prev, { weekStartsOn: 1 }),
          end: endOfWeek(prev, { weekStartsOn: 1 }),
        };
      }
      case "mes": {
        const prev = subMonths(currentDate, 1);
        return { start: startOfMonth(prev), end: endOfMonth(prev) };
      }
      case "anio": {
        const prev = subYears(currentDate, 1);
        return { start: startOfYear(prev), end: endOfYear(prev) };
      }
    }
  }, [period, currentDate]);

  const navigatePrev = () => {
    switch (period) {
      case "dia": setCurrentDate((d) => subDays(d, 1)); break;
      case "semana": setCurrentDate((d) => subWeeks(d, 1)); break;
      case "mes": setCurrentDate((d) => subMonths(d, 1)); break;
      case "anio": setCurrentDate((d) => subYears(d, 1)); break;
    }
  };

  const navigateNext = () => {
    switch (period) {
      case "dia": setCurrentDate((d) => addDays(d, 1)); break;
      case "semana": setCurrentDate((d) => addWeeks(d, 1)); break;
      case "mes": setCurrentDate((d) => addMonths(d, 1)); break;
      case "anio": setCurrentDate((d) => addYears(d, 1)); break;
    }
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case "dia":
        return format(currentDate, "dd/MM/yyyy");
      case "semana": {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(start, "dd/MM/yyyy")} – ${format(end, "dd/MM/yyyy")}`;
      }
      case "mes":
        return format(currentDate, "MMMM yyyy", { locale: es });
      case "anio":
        return format(currentDate, "yyyy");
    }
  }, [period, currentDate]);

  const pagosEnRango = useMemo(() =>
    pagos.filter((p) => {
      const f = new Date(p.fecha);
      return f >= dateRange.start && f <= dateRange.end;
    }), [pagos, dateRange]);

  const pagosAnterior = useMemo(() =>
    pagos.filter((p) => {
      const f = new Date(p.fecha);
      return f >= prevDateRange.start && f <= prevDateRange.end;
    }), [pagos, prevDateRange]);

  const totalPeriodo = pagosEnRango.reduce((sum, p) => sum + p.monto, 0);
  const cantidadPeriodo = pagosEnRango.length;
  const promedioPeriodo = cantidadPeriodo > 0 ? totalPeriodo / cantidadPeriodo : 0;

  // Estadísticas de hoy (fijas para recepcionista)
  const statsHoy = useMemo(() => {
    const hoy = startOfDay(new Date());
    const finHoy = endOfDay(new Date());
    const delDia = pagos.filter((p) => {
      const f = new Date(p.fecha);
      return f >= hoy && f <= finHoy;
    });
    return {
      total: delDia.reduce((sum, p) => sum + p.monto, 0),
      cantidad: delDia.length
    };
  }, [pagos]);

  const totalAnterior = pagosAnterior.reduce((sum, p) => sum + p.monto, 0);
  const cantidadAnterior = pagosAnterior.length;
  const promedioAnterior = cantidadAnterior > 0 ? totalAnterior / cantidadAnterior : 0;

  const chartData = useMemo(() => {
    switch (period) {
      case "dia": {
        const hours = eachHourOfInterval({ start: dateRange.start, end: dateRange.end });
        return hours.map((hour) => ({
          label: format(hour, "HH:mm"),
          total: pagosEnRango
            .filter((p) => isSameHour(new Date(p.fecha), hour))
            .reduce((sum, p) => sum + p.monto, 0),
        }));
      }
      case "semana":
      case "mes": {
        const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
        return days.map((day) => ({
          label:
            period === "semana"
              ? format(day, "EEE d", { locale: es })
              : format(day, "d"),
          total: pagosEnRango
            .filter((p) => isSameDay(new Date(p.fecha), day))
            .reduce((sum, p) => sum + p.monto, 0),
        }));
      }
      case "anio": {
        const yearStart = startOfYear(currentDate);
        const yearEnd = endOfYear(currentDate);
        const effectiveStart =
          firstPaymentDate &&
            firstPaymentDate.getFullYear() === currentDate.getFullYear() &&
            firstPaymentDate > yearStart
            ? startOfMonth(firstPaymentDate)
            : yearStart;

        const months = eachMonthOfInterval({ start: effectiveStart, end: yearEnd });
        return months.map((month) => ({
          label: format(month, "MMM", { locale: es }),
          total: pagos
            .filter((p) => isSameMonth(new Date(p.fecha), month))
            .reduce((sum, p) => sum + p.monto, 0),
        }));
      }
    }
  }, [period, pagos, pagosEnRango, dateRange, currentDate, firstPaymentDate]);

  const xAxisTickFormatter = (val: string) => {
    if (period !== "mes") return val;
    const n = parseInt(val, 10);
    if (n === 1 || n % 5 === 0) return val;
    return "";
  };

  const historialDateRange = useMemo(() => {
    if (historialPeriod === "todo") return null;
    const now = new Date();
    switch (historialPeriod) {
      case "dia": return { start: startOfDay(now), end: endOfDay(now) };
      case "semana": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "anio": return { start: startOfYear(now), end: endOfYear(now) };
    }
  }, [historialPeriod]);

  const filteredPayments = useMemo(() => {
    let result = pagos.filter(
      (pago) =>
        pago.paciente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pago.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pago.referencia_nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (historialDateRange) {
      result = result.filter((p) => {
        const f = new Date(p.fecha);
        return f >= historialDateRange.start && f <= historialDateRange.end;
      });
    }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "reciente": return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        case "antiguo": return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
        case "mayor_monto": return b.monto - a.monto;
        case "menor_monto": return a.monto - b.monto;
        default: return 0;
      }
    });
  }, [pagos, searchTerm, historialDateRange, sortBy]);

  const historialActiveFiltersCount = [
    searchTerm !== "",
    historialPeriod !== "todo",
    sortBy !== "reciente",
  ].filter(Boolean).length;

  const clearHistorialFilters = () => {
    setSearchTerm("");
    setHistorialPeriod("todo");
    setSortBy("reciente");
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount);

  const chartHeight = showHistorial
    ? Math.round(chartFullHeight * 0.8)
    : chartFullHeight;

  if (show) return <PageLoader message="Cargando pagos..." />;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex justify-between items-center relative z-20 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pagos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            Gestión financiera del consultorio
            {refreshing && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary flex-none" />}
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          onClick={() => setIsPaymentDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Registrar Pago
        </Button>
      </div>

      {/* ── Period selector + Navigator (Oculto para recepcionista) ── */}
      {!isRecepcionista && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented control */}
          <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${period === opt.value
                    ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Date navigator */}
          <div className="flex items-center bg-muted rounded-xl p-1 gap-0.5">
            <button
              onClick={navigatePrev}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-black/[0.06] transition-all text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold min-w-[186px] text-center capitalize px-2 text-foreground">
              {periodLabel}
            </span>
            <button
              onClick={navigateNext}
              className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-black/[0.06] transition-all text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Toggle historial */}
          <button
            onClick={() => setShowHistorial((v) => !v)}
            className={`ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              showHistorial
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            {showHistorial ? "Ocultar historial" : "Mostrar historial"}
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className={`grid grid-cols-1 ${isRecepcionista ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-4`}>
        <StatCard
          title={isRecepcionista ? "Ingresos del día" : "Ingresos del período"}
          value={formatCurrency(isRecepcionista ? statsHoy.total : totalPeriodo)}
          icon={TrendingUp}
          iconBg="bg-primary/10"
          iconText="text-primary"
          trend={
            !isRecepcionista && (totalAnterior > 0 || totalPeriodo > 0)
              ? {
                  value: `${Math.abs(calcPct(totalPeriodo, totalAnterior)).toFixed(0)}% vs período ant.`,
                  positive: totalPeriodo >= totalAnterior,
                }
              : undefined
          }
        />
        <StatCard
          title={isRecepcionista ? "Pagos registrados" : "Total de pagos"}
          value={isRecepcionista ? statsHoy.cantidad : cantidadPeriodo}
          icon={Activity}
          iconBg="bg-violet-50"
          iconText="text-violet-600"
          trend={
            !isRecepcionista && (cantidadAnterior > 0 || cantidadPeriodo > 0)
              ? {
                  value: `${Math.abs(calcPct(cantidadPeriodo, cantidadAnterior)).toFixed(0)}% vs período ant.`,
                  positive: cantidadPeriodo >= cantidadAnterior,
                }
              : undefined
          }
        />
        {!isRecepcionista && (
          <StatCard
            title="Promedio por pago"
            value={formatCurrency(promedioPeriodo)}
            icon={Receipt}
            iconBg="bg-emerald-50"
            iconText="text-emerald-600"
            trend={
              promedioAnterior > 0 || promedioPeriodo > 0
                ? {
                    value: `${Math.abs(calcPct(promedioPeriodo, promedioAnterior)).toFixed(0)}% vs período ant.`,
                    positive: promedioPeriodo >= promedioAnterior,
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* ── Chart + Historial sub-container (no gap between them, managed manually) ── */}
      <div className="flex flex-col">

      {/* ── Chart Card (Oculto para recepcionista) ── */}
      {!isRecepcionista && (
        <Card className="shadow-sm border-border/70">
          <CardContent className="pt-5 pb-5">
            <p className="text-sm font-semibold text-foreground mb-5">
              Evolución de ingresos
            </p>
            <div
              className="overflow-hidden"
              style={{
                height: `${chartHeight}px`,
                transition: "height 0.5s ease-in-out",
              }}
            >
            {
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
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
                    tickFormatter={formatCurrencyAxis}
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
                    strokeWidth={2}
                    fill="url(#gradientTotal)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            }
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Historial (collapsible / siempre visible para recepcionista) ── */}
      <div
        className={`grid transition-all duration-500 ease-in-out ${
          (showHistorial || isRecepcionista) ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0 mt-0"
        }`}
      >
      <div className="overflow-hidden">
      <div className="space-y-6 pt-2">
      <h2 className="text-xl font-bold text-foreground">Historial de pagos</h2>

      {/* ── Controls: search + period pills + sort + clear (estilo Pacientes) ── */}
      <div className="flex gap-3 items-center flex-wrap">
        {/* Search — mitad del ancho con botón X interno */}
        <div className="relative w-1/2 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por paciente o tratamiento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Period filter pills */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {(
            [{ label: "Todo", value: "todo" }, ...PERIOD_OPTIONS] as {
              label: string;
              value: "todo" | PeriodType;
            }[]
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHistorialPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${historialPeriod === opt.value
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground flex-none" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-9 text-xs w-[148px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reciente">Más reciente</SelectItem>
              <SelectItem value="antiguo">Más antiguo</SelectItem>
              <SelectItem value="mayor_monto">Mayor monto</SelectItem>
              <SelectItem value="menor_monto">Menor monto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Limpiar — solo visible cuando hay filtros activos */}
        {historialActiveFiltersCount > 0 && (
          <button
            onClick={clearHistorialFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Payments list ── */}
      <Card className="shadow-sm border-border/70 overflow-hidden">
        <CardContent className="p-0">
          {filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="p-4 rounded-2xl bg-muted">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">
                  No hay pagos registrados
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchTerm
                    ? "No se encontraron resultados para tu búsqueda"
                    : "Los pagos aparecerán aquí cuando se registren"}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredPayments.map((pago) => {
                const cfg = getMetodoCfg(pago.metodo_pago);
                const MetodoIcon = cfg.Icon;
                const esTratamiento = pago.tipo !== "consulta";

                return (
                  <div
                    key={pago.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    {/* Payment method icon */}
                    <div
                      className={`flex-none w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${cfg.bg} ${cfg.ring}`}
                    >
                      <MetodoIcon className={`h-4.5 w-4.5 ${cfg.color}`} />
                    </div>

                    {/* Patient + concept */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {pago.paciente_nombre}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold h-4 px-1.5 py-0 leading-none flex-none ${esTratamiento
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}
                        >
                          {esTratamiento ? "Tratamiento" : "Consulta"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {pago.concepto}
                      </p>
                      {pago.notas && (
                        <p className="text-[11px] text-muted-foreground/70 italic mt-0.5 truncate">
                          {pago.notas}
                        </p>
                      )}
                    </div>

                    {/* Date + method — hidden on small screens */}
                    <div className="hidden md:flex flex-col items-end gap-1 min-w-[120px] text-right">
                      <p className="text-xs font-medium text-foreground">
                        {pago.fecha.toLocaleDateString("es-PE", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <span
                        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="flex-none text-right min-w-[88px]">
                      <p className="text-base font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(pago.monto)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>{/* /space-y-6 historial */}
      </div>{/* /overflow-hidden */}
      </div>{/* /grid collapsible */}

      </div>{/* /chart+historial sub-container */}

      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        onSuccess={() => {
          fetchPagos();
        }}
      />
    </div>
  );
}
