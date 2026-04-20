import React, { useState, useEffect } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { suscribirLogsPorUsuario } from "@/services/activityLogService";
import type { LogActividad } from "@/types/activityLog";

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
  const e = log.entidad_nombre ? <B>{log.entidad_nombre}</B> : null;
  const p = log.paciente_nombre ? <B>{log.paciente_nombre}</B> : null;
  const accion = log.accion;

  if (log.modulo === "Pagos") {
    return <>Registraste el pago{p ? <> del paciente {p}</> : null}{e ? <> por un monto de {e}</> : null}.</>;
  }

  if (log.modulo === "Calendario") {
    if (accion === "creó") {
      const esConsulta = log.entidad_nombre === "Consulta";
      return <>Creaste la cita de tipo {esConsulta ? "consulta" : <>{e}</>}{p ? <> para el paciente {p}</> : null}.</>;
    }
    if (accion.startsWith("cambió")) {
      return <>Cambiaste el estado de la cita del paciente {p ?? "—"} a <B>{log.entidad_nombre ?? "—"}</B>.</>;
    }
    if (accion === "canceló") {
      return <>Cancelaste la cita{p ? <> del paciente {p}</> : null}.</>;
    }
    if (accion === "eliminó") {
      return <>Eliminaste la cita{p ? <> del paciente {p}</> : null}.</>;
    }
    if (accion === "reprogramó") {
      return <>Reprogramaste la cita{p ? <> del paciente {p}</> : null}.</>;
    }
  }

  if (log.modulo === "Tratamientos") {
    if (accion === "creó") {
      return <>Creaste el tratamiento {e ?? "—"}{p ? <> para el paciente {p}</> : null}.</>;
    }
    if (accion === "editó") {
      return <>Editaste el tratamiento {e ?? "—"}{p ? <> del paciente {p}</> : null}.</>;
    }
    if (accion === "eliminó") {
      return <>Eliminaste el tratamiento {e ?? "—"}{p ? <> del paciente {p}</> : null}.</>;
    }
  }

  if (log.modulo === "Empleados") {
    if (accion === "creó")   return <>Registraste al empleado {e ?? "—"}.</>;
    if (accion === "editó")  return <>Editaste al empleado {e ?? "—"}.</>;
    if (accion === "eliminó") return <>Eliminaste al empleado {e ?? "—"}.</>;
  }

  if (log.modulo === "Pacientes") {
    if (accion === "creó")   return <>Registraste al paciente {e ?? "—"}.</>;
    if (accion === "editó")  return <>Editaste al paciente {e ?? "—"}.</>;
    if (accion === "eliminó") return <>Eliminaste al paciente {e ?? "—"}.</>;
  }

  if (log.modulo === "Inventario") {
    if (accion === "creó")   return <>Agregaste el producto {e ?? "—"} al inventario.</>;
    if (accion === "editó")  return <>Editaste el producto {e ?? "—"}.</>;
    if (accion === "eliminó") return <>Eliminaste el producto {e ?? "—"}.</>;
    if (accion === "cargó")  return <>Cargaste stock de {e ?? "—"}.</>;
    if (accion === "descargó") return <>Descargaste stock de {e ?? "—"}.</>;
  }

  if (log.modulo === "Usuarios") {
    if (accion === "aprobó")  return <>Aprobaste el acceso de {e ?? "—"}.</>;
    if (accion === "revocó")  return <>Revocaste el acceso de {e ?? "—"}.</>;
    if (accion === "eliminó") return <>Eliminaste al usuario {e ?? "—"}.</>;
  }

  if (log.modulo === "Documentos") {
    if (accion === "subió")   return <>Subiste el documento {e ?? "—"}.</>;
    if (accion === "eliminó") return <>Eliminaste el documento {e ?? "—"}.</>;
  }

  if (log.modulo === "Perfil") {
    return <>Actualizaste tu perfil.</>;
  }

  if (log.modulo === "Configuración") {
    return <>Guardaste la configuración de {e ?? "precios"}.</>;
  }

  // Fallback
  const msg = log.mensaje.replace("El usuario " + log.usuario_nombre, "").trim();
  return <>{msg.charAt(0).toUpperCase() + msg.slice(1)}</>;
}

function ActivityItem({ log }: { log: LogActividad }) {
  const [expanded, setExpanded] = useState(false);
  const hasCambios = (log.cambios?.length ?? 0) > 0;
  const accionKey = log.accion.split(" ")[0];
  const badgeClass = ACCION_COLOR[accionKey] ?? "bg-muted text-muted-foreground ring-1 ring-border";

  return (
    <div className="group relative pl-8 pb-8 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-slate-100 group-last:hidden" />
      
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full bg-white border-2 border-slate-200 flex items-center justify-center z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-primary transition-colors" />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
            {accionKey}
          </span>
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-tight">
            • {log.modulo}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            • {formatFecha(log.fecha)}, {formatHora(log.fecha)}
          </span>
        </div>

        <div className="text-sm text-slate-600 leading-relaxed">
          {buildDetalle(log)}
        </div>

        {hasCambios && (
          <div className="mt-1">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors font-medium"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Ocultar cambios" : `Ver ${log.cambios!.length} cambio${log.cambios!.length > 1 ? "s" : ""}`}
            </button>

            {expanded && (
              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                {log.cambios!.map((c) => (
                  <div key={c.campo} className="text-xs text-slate-500 grid grid-cols-[100px_1fr] items-baseline gap-2">
                    <span className="font-medium text-slate-800">{c.etiqueta}:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="line-through opacity-50">{c.anterior || "(vacio)"}</span>
                      <span className="text-primary opacity-70">→</span>
                      <span className="font-semibold text-slate-900">{c.nuevo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ActivityListProps {
  uid: string;
}

export function ActivityList({ uid }: ActivityListProps) {
  const [logs, setLogs] = useState<LogActividad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = suscribirLogsPorUsuario(uid, (data) => {
      // Sort in memory since Firestore orderBy requires composite index
      const sorted = [...data].sort((a, b) => {
        const da = toDate(a.fecha)?.getTime() || 0;
        const db = toDate(b.fecha)?.getTime() || 0;
        return db - da;
      });
      setLogs(sorted);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs text-slate-500 animate-pulse">Cargando tu actividad...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex p-4 rounded-2xl bg-slate-50 text-slate-400 mb-4">
          <History className="h-8 w-8" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Sin actividad registrada</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
          Aquí aparecerán las acciones que realices en el sistema una vez que comiences a trabajar.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-6">
      {logs.map((log) => (
        <ActivityItem key={log.id} log={log} />
      ))}
    </div>
  );
}
