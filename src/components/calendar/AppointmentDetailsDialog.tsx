import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarClock,
  Edit,
  Loader2,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Activity,
  ClipboardCheck,
  Calendar as CalendarIcon,
  UserCheck,
  Timer,
  FileText,
  CalendarPlus,
  Users,
  User,
  Phone,
  Clock,
  Stethoscope,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuthContext } from "@/context/AuthContext";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import { updateAppointment, cancelAppointment } from "@/services/appointmentService";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
  APPOINTMENT_STATUS_CONFIG,
  NORMALIZE_STATUS,
  type StatusKey,
} from "@/constants/appointmentConstants";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppointmentDetails {
  id: string;
  time: string;
  patient: string;
  patientId: string;
  patientPhone?: string;
  treatment: string;
  duration: string;
  status: string;
  date: Date;
  notes?: string;
  createdBy?: string;
  isTreatment?: boolean;
  treatmentName?: string;
  // Campos de atención
  atendidoPor?: string;
  duracionReal?: string;
  notasAtencion?: string;
  planificacionSiguienteCita?: string;
  personalConsulta?: { nombre: string; rol: string }[];
}

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDetails | null;
  onEdit?: () => void;
  onReschedule?: () => void;
  onSuccess?: () => void;
}

// ── Time slots ────────────────────────────────────────────────────────────────
function generateTimeSlots() {
  const slots: { value: string; label: string }[] = [];
  for (let hour = 7; hour <= 23; hour++) {
    for (const minute of [0, 15, 30, 45]) {
      if (hour === 23 && minute > 30) break;
      const value = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const period = hour >= 12 ? "PM" : "AM";
      slots.push({ value, label: `${displayHour}:${minute.toString().padStart(2, "0")} ${period}` });
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

// ── Component ─────────────────────────────────────────────────────────────────
export default function AppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onReschedule,
  onSuccess,
}: AppointmentDetailsDialogProps) {
  const { user, userProfile } = useAuthContext();
  const userName = userProfile
    ? `${userProfile.nombre.split(' ')[0]} ${userProfile.apellidoPaterno}`
    : user?.displayName || "Sistema";
  const { log } = useActivityLog();

  const [currentStatus, setCurrentStatus] = useState<StatusKey>("pendiente");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status change dropdown state
  const [pendingStatusChange, setPendingStatusChange] = useState<"confirmada" | "atendiendo" | "atendida" | "cancelada" | null>(null);
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);

  // Reschedule section state
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (appointment && open) {
      setCurrentStatus(NORMALIZE_STATUS[appointment.status?.toLowerCase() || ''] ?? "pendiente");
      // Pre-fill reschedule with current values
      const aptDate = appointment.date instanceof Date ? appointment.date : new Date(appointment.date);
      setRescheduleDate(aptDate);
      setRescheduleTime(appointment.time);
      setRescheduleOpen(false);
    }
  }, [appointment, open]);

  if (!appointment) return null;

  const isRescheduled = currentStatus === "reprogramada";
  const isFinal = currentStatus === "atendida" || currentStatus === "cancelada";
  const statusCfg = APPOINTMENT_STATUS_CONFIG[currentStatus];
  const appointmentDate = appointment.date instanceof Date ? appointment.date : new Date(appointment.date);

  // ── Status change handlers ─────────────────────────────────────────────────
  const handleStatusChangeRequest = (status: "confirmada" | "atendiendo" | "atendida" | "cancelada") => {
    setPendingStatusChange(status);
    setShowStatusChangeDialog(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!pendingStatusChange || !appointment?.id) return;
    try {
      setUpdatingStatus(true);
      await updateAppointment(appointment.id, { estado: pendingStatusChange }, userName);
      log({ modulo: "Calendario", accion: "cambió estado de", entidad: "cita", entidad_id: appointment.id, entidad_nombre: APPOINTMENT_STATUS_CONFIG[pendingStatusChange].label, paciente_nombre: appointment.patient });
      toast({
        title: "Estado actualizado",
        description: `La cita fue marcada como ${APPOINTMENT_STATUS_CONFIG[pendingStatusChange].label.toLowerCase()}.`,
        variant: pendingStatusChange === "cancelada" ? "destructive" : "success",
      });
      setShowStatusChangeDialog(false);
      onOpenChange(false);
      if (onSuccess) await onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo actualizar el estado.", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
      setPendingStatusChange(null);
    }
  };

  const handleConfirmCancellation = async () => {
    try {
      setUpdatingStatus(true);
      await updateAppointment(appointment.id, { estado: "cancelada" }, userName);
      log({ modulo: "Calendario", accion: "canceló", entidad: "cita", entidad_id: appointment.id, entidad_nombre: appointment.patient, paciente_nombre: appointment.patient });
      toast({ title: "Cita cancelada", description: "La cita fue cancelada exitosamente.", variant: "destructive" });
      setShowCancelDialog(false);
      onOpenChange(false);
      if (onSuccess) await onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudo cancelar la cita.", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteAppointment = async () => {
    try {
      setDeleting(true);
      await cancelAppointment(appointment.id);
      log({ modulo: "Calendario", accion: "eliminó", entidad: "cita", entidad_id: appointment.id, entidad_nombre: appointment.patient, paciente_nombre: appointment.patient });
      toast({ title: "Cita eliminada", description: "La cita fue eliminada exitosamente.", variant: "destructive" });
      setShowDeleteDialog(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la cita.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Reschedule handler ─────────────────────────────────────────────────────
  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast({ title: "Datos incompletos", description: "Selecciona una fecha y hora.", variant: "warning" });
      return;
    }
    try {
      setRescheduling(true);
      await updateAppointment(appointment.id, {
        fecha: rescheduleDate,
        hora: rescheduleTime,
        estado: "reprogramada" as any,
      }, userName);
      log({ modulo: "Calendario", accion: "reprogramó", entidad: "cita", entidad_id: appointment.id, entidad_nombre: appointment.patient, paciente_nombre: appointment.patient });
      toast({
        title: "Cita reprogramada",
        description: `Reprogramada al ${format(rescheduleDate, "PPP", { locale: es })} a las ${rescheduleTime}.`,
        variant: "warning",
      });
      setRescheduleOpen(false);
      onOpenChange(false);
      if (onSuccess) await onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudo reprogramar la cita.", variant: "destructive" });
    } finally {
      setRescheduling(false);
    }
  };

  // Dropdown options — filter out the current status
  const statusChangeOptions = [
    { key: "confirmada" as const, label: "Confirmar", icon: CheckCircle2, colorClass: "text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50" },
    { key: "atendiendo" as const, label: "Atendiendo", icon: Activity, colorClass: "text-slate-600 focus:text-slate-600 focus:bg-slate-50" },
    { key: "atendida" as const, label: "Atendida", icon: ClipboardCheck, colorClass: "text-slate-500 focus:text-slate-500 focus:bg-slate-50" },
    { key: "cancelada" as const, label: "Cancelar", icon: XCircle, colorClass: "text-red-500 focus:text-red-500 focus:bg-red-50" },
  ].filter((opt) => opt.key !== currentStatus);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* p-0 + overflow-hidden para que el inner flex controle el layout */}
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="flex flex-col max-h-[90vh]">

            {/* Header fijo */}
            <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 flex-shrink-0">
              <DialogTitle className="text-2xl font-semibold text-slate-900">
                Detalles de cita
              </DialogTitle>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ring-1 ${statusCfg.pill}`}>
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  statusCfg.dot,
                  currentStatus === "atendiendo" && "animate-glow-pulse"
                )} />
                {statusCfg.label}
              </span>
            </div>

            {/* Contenido — crece y solo hace scroll si es estrictamente necesario */}
            <div className="overflow-y-auto min-h-0 px-6 pb-4">
              <div className="space-y-3">

                {/* Paciente */}
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <User className="h-4 w-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Paciente</p>
                    <p className="text-sm font-semibold">{appointment.patient}</p>
                  </div>
                </div>

                {/* Fecha y Hora */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="text-sm font-semibold">{format(appointmentDate, "PPP", { locale: es })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Hora</p>
                      <p className="text-sm font-semibold">{appointment.time}</p>
                    </div>
                  </div>
                </div>

                {/* Celular y Consulta */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Celular</p>
                      <p className="text-sm font-semibold">{appointment.patientPhone || "No registrado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <Stethoscope className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {appointment.isTreatment ? "Tratamiento" : "Consulta"}
                      </p>
                      <p className="text-sm font-semibold">
                        {appointment.isTreatment ? appointment.treatmentName : appointment.treatment}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Duración y Creado por */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duración estimada</p>
                      <p className="text-sm font-semibold">{appointment.duration}</p>
                    </div>
                  </div>
                  {appointment.createdBy && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                      <User className="h-4 w-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Creado por</p>
                        <p className="text-sm font-semibold">{appointment.createdBy}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notas generales */}
                {appointment.notes && (
                  <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Notas</p>
                      <p className="text-sm font-semibold whitespace-pre-line mt-0.5">{appointment.notes}</p>
                    </div>
                  </div>
                )}

                {/* ── Sección de atención ────────────────────────────────── */}
                {currentStatus === "atendida" && (
                  <div className="border-t pt-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      Información de atención
                    </p>

                    {/* Personal */}
                    {appointment.personalConsulta && appointment.personalConsulta.length > 0 ? (
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                        <Users className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1.5">Personal</p>
                          <div className="space-y-1">
                            {appointment.personalConsulta.map((p, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <p className="text-sm font-semibold">{p.nombre}</p>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{p.rol}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Atendido por</p>
                          <p className="text-sm font-semibold">{appointment.atendidoPor || "No registrado"}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                      <Timer className="h-4 w-4 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Duración real</p>
                        <p className="text-sm font-semibold">
                          {appointment.duracionReal && appointment.duracionReal !== "0"
                            ? `${appointment.duracionReal} min`
                            : "No registrada"}
                        </p>
                      </div>
                    </div>

                    {appointment.notasAtencion && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Notas de cita</p>
                          <p className="text-sm font-semibold whitespace-pre-line mt-0.5">{appointment.notasAtencion}</p>
                        </div>
                      </div>
                    )}

                    {appointment.planificacionSiguienteCita && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                        <CalendarPlus className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Planificación siguiente cita</p>
                          <p className="text-sm font-semibold whitespace-pre-line mt-0.5">{appointment.planificacionSiguienteCita}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Reprogramar — oculto en estados finales */}
                {!isFinal && !isRescheduled && (
                  <Collapsible open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                    <div className="border-t pt-3">
                      <CollapsibleTrigger className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium">Reprogramar cita</span>
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200",
                            rescheduleOpen && "rotate-180"
                          )}
                        />
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                      <div className="pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Nueva fecha */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">Nueva fecha</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-10 w-full justify-start text-left font-normal text-sm",
                                    !rescheduleDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="h-4 w-4 mr-2 opacity-50" />
                                  {rescheduleDate ? format(rescheduleDate, "PPP", { locale: es }) : "Seleccionar"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={rescheduleDate}
                                  onSelect={setRescheduleDate}
                                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                  initialFocus
                                  locale={es}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Nueva hora */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">Nueva hora</span>
                            <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                              <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="Seleccionar hora" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                {TIME_SLOTS.map((slot) => (
                                  <SelectItem key={slot.value} value={slot.value} className="text-sm">
                                    {slot.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={handleReschedule}
                            disabled={rescheduling || !rescheduleDate || !rescheduleTime}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            {rescheduling ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CalendarClock className="h-4 w-4 mr-2" />
                            )}
                            {rescheduling ? "Guardando..." : "Guardar cambios"}
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </div>

            {/* Footer fijo */}
            <div className="border-t px-6 py-4 flex items-center justify-between flex-shrink-0">
              {/* Izquierda — destructivo */}
              <div>
                {isRescheduled ? (
                  <button
                    onClick={() => setShowCancelDialog(true)}
                    className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Cancelar cita
                  </button>
                ) : !isFinal ? (
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    Eliminar cita
                  </button>
                ) : null}
              </div>

              {/* Derecha — Editar + Cambiar estado */}
              <div className="flex items-center gap-3">
                {onEdit && !isFinal && (
                  <Button variant="outline" onClick={onEdit} disabled={updatingStatus}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                )}
                {!isRescheduled && !isFinal && statusChangeOptions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button disabled={updatingStatus}>
                        {updatingStatus ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Cambiando...
                          </>
                        ) : (
                          <>
                            Cambiar estado
                            <ChevronDown className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px] p-1">
                      {statusChangeOptions.map((opt) => {
                        const Icon = opt.icon;
                        return (
                          <DropdownMenuItem
                            key={opt.key}
                            onClick={() => handleStatusChangeRequest(opt.key)}
                            className={cn(
                              "text-sm cursor-pointer font-bold py-2 px-3 rounded-md transition-colors",
                              opt.colorClass
                            )}
                          >
                            <Icon className="h-4 w-4 mr-2" />
                            {opt.label}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm status change (via dropdown) */}
      {pendingStatusChange && (
        <ConfirmationDialog
          open={showStatusChangeDialog}
          onOpenChange={(open) => {
            setShowStatusChangeDialog(open);
            if (!open) setPendingStatusChange(null);
          }}
          onConfirm={handleConfirmStatusChange}
          title={`¿Marcar como ${APPOINTMENT_STATUS_CONFIG[pendingStatusChange].label}?`}
          description={`Se cambiará el estado de la cita de ${appointment.patient} (${format(appointmentDate, "PPP", { locale: es })} a las ${appointment.time}) a "${APPOINTMENT_STATUS_CONFIG[pendingStatusChange].label}".`}
          confirmText={`Sí, marcar como ${APPOINTMENT_STATUS_CONFIG[pendingStatusChange].label.toLowerCase()}`}
          cancelText="Cancelar"
          loadingText="Guardando..."
          variant={pendingStatusChange === "cancelada" ? "destructive" : "default"}
          loading={updatingStatus}
        />
      )}

      {/* Confirm cancel — for rescheduled appointments */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleConfirmCancellation}
        title="¿Cancelar esta cita?"
        description={`¿Estás seguro de que deseas cancelar la cita de ${appointment.patient} programada para el ${format(appointmentDate, "PPP", { locale: es })} a las ${appointment.time}?`}
        confirmText="Sí, cancelar cita"
        cancelText="No, mantener cita"
        loadingText="Cancelando..."
        variant="destructive"
        loading={updatingStatus}
      />

      {/* Confirm delete */}
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteAppointment}
        title="¿Eliminar cita?"
        description={`¿Estás seguro de que deseas eliminar la cita de ${appointment.patient} programada para el ${format(appointmentDate, "PPP", { locale: es })} a las ${appointment.time}? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar cita"
        cancelText="No, mantener cita"
        loadingText="Eliminando..."
        variant="destructive"
        loading={deleting}
      />
    </>
  );
}
