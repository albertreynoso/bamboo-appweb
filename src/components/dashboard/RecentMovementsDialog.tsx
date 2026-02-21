// src/components/MovimientosRecientes.tsx
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  DollarSign,
  XCircle,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Activity,
  Loader2,
  Stethoscope,
  ChevronRight,
} from "lucide-react";

// ══════════ INTERFACES ══════════
interface EstadoHistorial {
  estado: string;
  fecha: any;
  realizado_por: string;
  tipo: "creacion" | "cambio_estado";
}

interface Appointment {
  id: string;
  tipo_consulta: string;
  fecha: Date;
  hora: string;
  duracion?: string;
  estado: string;
  costo?: number;
  pagado?: boolean;
  notas_observaciones?: string;
  paciente_nombre?: string;
  historial_estados?: EstadoHistorial[];
  es_tratamiento?: boolean;
  tratamiento_nombre?: string;
}

interface Pago {
  id: string;
  monto: number;
  metodo_pago: string;
  fecha: any;
  concepto: string;
  tipo: "consulta" | "tratamiento";
  referencia_id: string;
  referencia_nombre: string;
  paciente_id: string;
  creado_por: string;
  notas?: string;
}

interface MovimientosRecientesProps {
  appointments: Appointment[];
  pagos: Pago[];
  loadingAppointments: boolean;
  loadingPagos: boolean;
}

// ══════════ CONFIGURACIÓN DE ESTADOS ══════════
const ESTADO_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: typeof Calendar;
}> = {
  pendiente: {
    label: "Pendiente",
    color: "rgb(245, 158, 11)",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    textColor: "text-amber-700 dark:text-amber-400",
    icon: Clock,
  },
  confirmada: {
    label: "Confirmada",
    color: "#10B981",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    textColor: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle,
  },
  completada: {
    label: "Completada",
    color: "#6B7280",
    bgColor: "bg-gray-100 dark:bg-gray-800/40",
    textColor: "text-gray-700 dark:text-gray-400",
    icon: CheckCircle,
  },
  cancelada: {
    label: "Cancelada",
    color: "#EF4444",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    textColor: "text-red-700 dark:text-red-400",
    icon: XCircle,
  },
  reprogramada: {
    label: "Reprogramada",
    color: "#F97316",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    textColor: "text-orange-700 dark:text-orange-400",
    icon: RefreshCw,
  },
};

const getEstadoConfig = (estado: string) => {
  return ESTADO_CONFIG[estado.toLowerCase()] || ESTADO_CONFIG.pendiente;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amount);
};

// ══════════ COMPONENTE PRINCIPAL ══════════
export default function MovimientosRecientes({
  appointments,
  pagos,
  loadingAppointments,
  loadingPagos,
}: MovimientosRecientesProps) {
  // Combinar citas y pagos en un solo timeline ordenado por fecha (más reciente primero)
  const movimientos = useMemo(() => {
    const items: Array<{
      id: string;
      type: "cita" | "pago";
      fecha: Date;
      data: any;
    }> = [];

    // Agregar TODAS las citas (incluyendo canceladas y reprogramadas)
    appointments.forEach((apt) => {
      const fecha = apt.fecha instanceof Date ? apt.fecha : new Date(apt.fecha);
      items.push({
        id: `cita-${apt.id}`,
        type: "cita",
        fecha,
        data: apt,
      });
    });

    // Agregar todos los pagos
    pagos.forEach((pago) => {
      const fecha = pago.fecha instanceof Date
        ? pago.fecha
        : pago.fecha?.toDate
          ? pago.fecha.toDate()
          : new Date(pago.fecha);
      items.push({
        id: `pago-${pago.id}`,
        type: "pago",
        fecha,
        data: pago,
      });
    });

    // Ordenar por fecha descendente (más reciente primero)
    return items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }, [appointments, pagos]);

  const isLoading = loadingAppointments || loadingPagos;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando movimientos...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (movimientos.length === 0) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Activity className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">No hay movimientos registrados</p>
              <p className="text-sm text-muted-foreground mt-1">
                Las citas, cancelaciones, reprogramaciones y pagos aparecerán aquí
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Agrupar movimientos por mes/año
  const groupedByMonth: Record<string, typeof movimientos> = {};
  movimientos.forEach((mov) => {
    const key = `${mov.fecha.getFullYear()}-${String(mov.fecha.getMonth() + 1).padStart(2, "0")}`;
    if (!groupedByMonth[key]) groupedByMonth[key] = [];
    groupedByMonth[key].push(mov);
  });

  const monthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Timeline agrupado por mes */}
      {monthKeys.map((monthKey) => {
        const [year, month] = monthKey.split("-");
        const monthDate = new Date(parseInt(year), parseInt(month) - 1);
        const monthLabel = monthDate.toLocaleDateString("es-PE", {
          month: "long",
          year: "numeric",
        });

        return (
          <div key={monthKey}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {monthLabel}
            </h3>
            <div className="space-y-3">
              {groupedByMonth[monthKey].map((mov) => (
                <Card key={mov.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    {mov.type === "cita" ? (
                      <CitaMovimiento cita={mov.data} fecha={mov.fecha} />
                    ) : (
                      <PagoMovimiento pago={mov.data} fecha={mov.fecha} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════ HELPER: FORMATEAR FECHA DEL HISTORIAL ══════════
function formatHistorialFecha(fecha: any): string {
  try {
    const date = typeof fecha?.toDate === "function" ? fecha.toDate() : new Date(fecha);
    const dia = date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
    const hora = date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${dia} ${hora}`;
  } catch {
    return "";
  }
}

// ══════════ HELPER: TRUNCAR NOMBRE A DOS PALABRAS ══════════
function shortName(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ");
}

// ══════════ COMPONENTE: TIMELINE DE ESTADOS ══════════
function EstadoTimeline({ historial }: { historial: EstadoHistorial[] }) {
  if (!historial || historial.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-shrink-0 pl-3 border-l border-border/50">
      {historial.map((entry, i) => {
        const cfg = ESTADO_CONFIG[entry.estado?.toLowerCase()] || ESTADO_CONFIG.pendiente;
        const label = entry.tipo === "creacion" ? "Creación" : cfg.label;
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            <div className="flex flex-col items-center min-w-0">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${cfg.bgColor} ${cfg.textColor}`}
              >
                {label}
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                {formatHistorialFecha(entry.fecha)}
              </span>
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                {shortName(entry.realizado_por)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════ COMPONENTE: CITA ══════════
function CitaMovimiento({ cita, fecha }: { cita: Appointment; fecha: Date }) {
  const config = getEstadoConfig(cita.estado);
  const StatusIcon = config.icon;

  return (
    <div className="flex items-start gap-3">
      {/* Indicador lateral con color del estado */}
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: config.color }}
      />

      {/* Icono */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${config.color}15` }}
      >
        <Stethoscope className="h-4 w-4" style={{ color: config.color }} />
      </div>

      {/* Tres contenedores: info | timeline | badge */}
      <div className="flex-1 min-w-0 flex items-center gap-4">

        {/* Contenedor 1: Info principal (1/3 del ancho, alineado start) */}
        <div className="w-1/3 flex justify-start">
          <div>
            <p className="font-semibold text-sm text-foreground">
              {cita.es_tratamiento
                ? `Cita de tratamiento: ${cita.tratamiento_nombre || "Sin nombre"}`
                : cita.tipo_consulta}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fecha.toLocaleDateString("es-PE", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              • {cita.hora}
              {cita.duracion && ` • ${cita.duracion} min`}
            </p>

            {/* Info extra para canceladas y reprogramadas */}
            {(cita.estado.toLowerCase() === "cancelada" ||
              cita.estado.toLowerCase() === "reprogramada") &&
              cita.notas_observaciones && (
                <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Nota:</span> {cita.notas_observaciones}
                  </p>
                </div>
              )}

            {/* Costo si aplica (solo para consultas, no tratamientos) */}
            {!cita.es_tratamiento && cita.costo && cita.costo > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(cita.costo)}
                  {cita.pagado ? (
                    <span className="text-emerald-600 font-medium ml-1">· Pagado</span>
                  ) : ["confirmada", "completada"].includes(cita.estado?.toLowerCase()) ? (
                    <span className="font-medium ml-1" style={{ color: "rgb(245, 158, 11)" }}>
                      · Pendiente de pago
                    </span>
                  ) : null}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Contenedor 2: Timeline (se expande, alineado start) */}
        <div className="flex-1 flex justify-start">
          {cita.historial_estados && cita.historial_estados.length > 0 && (
            <EstadoTimeline historial={cita.historial_estados} />
          )}
        </div>

        {/* Contenedor 3: Badge (tamaño automático, alineado end) */}
        <div className="flex-shrink-0 flex justify-end">
          <Badge
            variant="secondary"
            className={`${config.bgColor} ${config.textColor} border-0 gap-1`}
          >
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ══════════ COMPONENTE: PAGO ══════════
function PagoMovimiento({ pago, fecha }: { pago: Pago; fecha: Date }) {
  return (
    <div className="flex items-start gap-3">
      {/* Indicador lateral verde */}
      <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-blue-500" />

      {/* Icono */}
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-blue-50 dark:bg-blue-900/20">
        <DollarSign className="h-4 w-4 text-blue-600" />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground">
              {pago.concepto || pago.referencia_nombre}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fecha.toLocaleDateString("es-PE", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              • {pago.metodo_pago}
            </p>
          </div>

          <span className="font-bold text-sm text-foreground flex-shrink-0">
            {formatCurrency(pago.monto)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <Badge
            variant="secondary"
            className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-0"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Pago completado
          </Badge>
          <span className="text-[10px] text-muted-foreground capitalize">
            {pago.tipo === "consulta" ? "Consulta" : "Tratamiento"}
          </span>
        </div>

        {pago.notas && (
          <p className="text-xs text-muted-foreground mt-1.5">
            <span className="font-medium">Nota:</span> {pago.notas}
          </p>
        )}
      </div>
    </div>
  );
}