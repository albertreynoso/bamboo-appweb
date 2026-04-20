import React, { useState, useEffect, useMemo } from "react";
import { Search, History, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { suscribirLogs } from "@/services/activityLogService";
import type { LogActividad } from "@/types/activityLog";
import { Timestamp } from "firebase/firestore";

const MODULOS = [
  "Todos",
  "Empleados",
  "Pacientes",
  "Calendario",
  "Pagos",
  "Tratamientos",
  "Inventario",
  "Usuarios",
  "Configuración",
  "Documentos",
  "Perfil",
] as const;

const ACCION_COLOR: Record<string, string> = {
  creó:       "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
  editó:      "bg-blue-50 text-blue-700 ring-1 ring-blue-200/80",
  eliminó:    "bg-red-50 text-red-700 ring-1 ring-red-200/80",
  registró:   "bg-violet-50 text-violet-700 ring-1 ring-violet-200/80",
  aprobó:     "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",
  guardó:     "bg-slate-50 text-slate-700 ring-1 ring-slate-200/80",
  canceló:    "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80",
  reprogramó: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/80",
  actualizó:  "bg-blue-50 text-blue-700 ring-1 ring-blue-200/80",
  subió:      "bg-teal-50 text-teal-700 ring-1 ring-teal-200/80",
  cargó:      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
  descargó:   "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80",
  revocó:     "bg-red-50 text-red-700 ring-1 ring-red-200/80",
};


function toDate(fecha: Timestamp | Date | any): Date | null {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha.toDate === "function") return fecha.toDate();
  return null;
}

function formatFecha(fecha: any): string {
  const d = toDate(fecha);
  if (!d) return "—";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatHora(fecha: any): string {
  const d = toDate(fecha);
  if (!d) return "";
  return d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

const B = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-foreground">{children}</span>
);

function buildDetalle(log: LogActividad): React.ReactNode {
  const u = <B>{log.usuario_nombre}</B>;
  const e = log.entidad_nombre ? <B>{log.entidad_nombre}</B> : null;
  const p = log.paciente_nombre ? <B>{log.paciente_nombre}</B> : null;
  const accion = log.accion;

  if (log.modulo === "Pagos") {
    return <>El usuario {u} registró el pago{p ? <> del paciente {p}</> : null}{e ? <> por un monto de {e}</> : null}.</>;
  }

  if (log.modulo === "Calendario") {
    if (accion === "creó") {
      const esConsulta = log.entidad_nombre === "Consulta";
      return <>El usuario {u} creó la cita de tipo {esConsulta ? "consulta" : <>{e}</>}{p ? <> para el paciente {p}</> : null}.</>;
    }
    if (accion.startsWith("cambió")) {
      return <>El usuario {u} cambió el estado de la cita del paciente {p ?? "—"} a <B>{log.entidad_nombre ?? "—"}</B>.</>;
    }
    if (accion === "canceló") {
      return <>El usuario {u} canceló la cita{p ? <> del paciente {p}</> : null}.</>;
    }
    if (accion === "eliminó") {
      return <>El usuario {u} eliminó la cita{p ? <> del paciente {p}</> : null}.</>;
    }
    if (accion === "reprogramó") {
      return <>El usuario {u} reprogramó la cita{p ? <> del paciente {p}</> : null}.</>;
    }
  }

  if (log.modulo === "Tratamientos") {
    if (accion === "creó") {
      return <>El usuario {u} creó el tratamiento {e ?? "—"}{p ? <> para el paciente {p}</> : null}.</>;
    }
    if (accion === "editó") {
      return <>El usuario {u} editó el tratamiento {e ?? "—"}{p ? <> del paciente {p}</> : null}.</>;
    }
    if (accion === "eliminó") {
      return <>El usuario {u} eliminó el tratamiento {e ?? "—"}{p ? <> del paciente {p}</> : null}.</>;
    }
  }

  if (log.modulo === "Empleados") {
    if (accion === "creó")   return <>El usuario {u} registró al empleado {e ?? "—"}.</>;
    if (accion === "editó")  return <>El usuario {u} editó al empleado {e ?? "—"}.</>;
    if (accion === "eliminó") return <>El usuario {u} eliminó al empleado {e ?? "—"}.</>;
  }

  if (log.modulo === "Pacientes") {
    if (accion === "creó")   return <>El usuario {u} registró al paciente {e ?? "—"}.</>;
    if (accion === "editó")  return <>El usuario {u} editó al paciente {e ?? "—"}.</>;
    if (accion === "eliminó") return <>El usuario {u} eliminó al paciente {e ?? "—"}.</>;
  }

  if (log.modulo === "Inventario") {
    if (accion === "creó")   return <>El usuario {u} agregó el producto {e ?? "—"} al inventario.</>;
    if (accion === "editó")  return <>El usuario {u} editó el producto {e ?? "—"}.</>;
    if (accion === "eliminó") return <>El usuario {u} eliminó el producto {e ?? "—"}.</>;
    if (accion === "cargó")  return <>El usuario {u} cargó stock de {e ?? "—"}.</>;
    if (accion === "descargó") return <>El usuario {u} descargó stock de {e ?? "—"}.</>;
  }

  if (log.modulo === "Usuarios") {
    if (accion === "aprobó")  return <>El usuario {u} aprobó el acceso de {e ?? "—"}.</>;
    if (accion === "revocó")  return <>El usuario {u} revocó el acceso de {e ?? "—"}.</>;
    if (accion === "eliminó") return <>El usuario {u} eliminó al usuario {e ?? "—"}.</>;
  }

  if (log.modulo === "Documentos") {
    if (accion === "subió")   return <>El usuario {u} subió el documento {e ?? "—"}.</>;
    if (accion === "eliminó") return <>El usuario {u} eliminó el documento {e ?? "—"}.</>;
  }

  if (log.modulo === "Perfil") {
    return <>El usuario {u} actualizó su perfil.</>;
  }

  if (log.modulo === "Configuración") {
    return <>El usuario {u} guardó la configuración de {e ?? "precios"}.</>;
  }

  // Fallback
  return <>{log.mensaje}</>;
}

function LogTableRow({ log }: { log: LogActividad }) {
  const [expanded, setExpanded] = useState(false);
  const hasCambios = (log.cambios?.length ?? 0) > 0;
  const accionKey = log.accion.split(" ")[0];
  const badgeClass = ACCION_COLOR[accionKey] ?? "bg-muted text-muted-foreground ring-1 ring-border";

  return (
    <TableRow className="hover:bg-muted/20 align-top">
      {/* Acción */}
      <TableCell className="w-[110px] pt-3.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${badgeClass}`}>
          {accionKey}
        </span>
      </TableCell>

      {/* Página */}
      <TableCell className="w-[120px] pt-3.5">
        <span className="text-sm text-muted-foreground">{log.modulo}</span>
      </TableCell>

      {/* Detalle */}
      <TableCell className="pt-3 pb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-foreground/80">{buildDetalle(log)}</span>

          {hasCambios && (
            <div className="mt-1">
              <button
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "Ocultar cambios" : `Ver ${log.cambios!.length} cambio${log.cambios!.length > 1 ? "s" : ""}`}
              </button>

              {expanded && (
                <ul className="mt-1.5 space-y-1">
                  {log.cambios!.map((c) => (
                    <li key={c.campo} className="text-xs text-muted-foreground flex items-baseline gap-1 flex-wrap">
                      <span className="font-medium text-foreground/80">{c.etiqueta}:</span>
                      <span className="line-through opacity-60">{c.anterior}</span>
                      <span>→</span>
                      <span className="font-medium text-foreground">{c.nuevo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </TableCell>

      {/* Fecha/Hora */}
      <TableCell className="w-[120px] pt-3.5 text-right shrink-0">
        <p className="text-xs font-medium text-foreground/70 whitespace-nowrap">{formatFecha(log.fecha)}</p>
        <p className="text-[11px] text-muted-foreground">{formatHora(log.fecha)}</p>
      </TableCell>
    </TableRow>
  );
}

const LOGS_PER_PAGE = 20;

export default function Actividad() {
  const [logs, setLogs] = useState<LogActividad[]>([]);
  const [loading, setLoading] = useState(true);
  const show = useMinLoading(loading);

  const [busqueda, setBusqueda] = useState("");
  const [modulo, setModulo] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const unsub = suscribirLogs((data) => {
      setLogs(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return logs.filter((log) => {
      if (modulo !== "Todos" && log.modulo !== modulo) return false;
      if (q) {
        return (
          log.usuario_nombre?.toLowerCase().includes(q) ||
          log.entidad_nombre?.toLowerCase().includes(q) ||
          log.paciente_nombre?.toLowerCase().includes(q) ||
          log.accion?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, busqueda, modulo]);

  const totalPages = Math.ceil(filtered.length / LOGS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [busqueda, modulo]);

  const clearFilters = () => { setBusqueda(""); setModulo("Todos"); };
  const activeFilters = busqueda !== "" || modulo !== "Todos";

  if (show) return <PageLoader message="Cargando actividad..." />;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center relative z-20 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Actividad</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            Registro de acciones realizadas en el sistema
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/80 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En tiempo real
            </span>
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-stretch divide-x divide-border/70 bg-card rounded-xl border border-border/70 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
          <div className="p-1.5 rounded-lg bg-primary/10 flex-none">
            <History className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{logs.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">Total</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
          <div className="p-1.5 rounded-lg bg-violet-50 flex-none">
            <Search className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{filtered.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">En búsqueda</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative w-1/2 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por usuario, acción o detalle..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground flex-none" />
          <Select value={modulo} onValueChange={setModulo}>
            <SelectTrigger className="h-9 text-xs w-[148px]">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              {MODULOS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[110px]">Acción</TableHead>
                <TableHead className="w-[120px]">Página</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="w-[120px] text-right">Fecha/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <div className="p-4 rounded-2xl bg-muted">
                        <History className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <p className="font-semibold text-foreground text-sm">Sin registros</p>
                      <p className="text-xs text-muted-foreground">
                        {activeFilters
                          ? "No hay registros que coincidan con los filtros."
                          : "Aún no hay actividad registrada en el sistema."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((log) => <LogTableRow key={log.id} log={log} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Paginación */}
      {filtered.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {(currentPage - 1) * LOGS_PER_PAGE + 1}–{Math.min(currentPage * LOGS_PER_PAGE, filtered.length)}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-foreground">{filtered.length}</span> registros
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (currentPage <= 3) p = i + 1;
                  else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                  else p = currentPage - 2 + i;
                  const isActive = currentPage === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
