import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Clock,
  User,
  FileText,
  Timer,
  Phone,
  CalendarClock,
  Edit,
  Stethoscope,
  UserCheck,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useAuthContext } from "@/context/AuthContext";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import { updateAppointment, cancelAppointment } from "@/services/appointmentService";
import {
  APPOINTMENT_STATUS_CONFIG,
  NORMALIZE_STATUS,
  type StatusKey,
} from "@/constants/appointmentConstants";

const CHANGE_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: "confirmada", label: "Confirmar" },
  { key: "completada", label: "Completar" },
  { key: "pendiente", label: "Pendiente" },
  { key: "cancelada", label: "Cancelar" },
];

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
}

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AppointmentDetails | null;
  onEdit?: () => void;
  onReschedule?: () => void;
  onSuccess?: () => void;
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[14px] font-semibold ">
        {label}
      </span>
      <span className="text-sm font-normal">
        {value}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AppointmentDetailsDialog({
  open,
  onOpenChange,
  appointment,
  onEdit,
  onReschedule,
  onSuccess,
}: AppointmentDetailsDialogProps) {
  const { user } = useAuthContext();
  const [currentStatus, setCurrentStatus] = useState<StatusKey>("pendiente");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (appointment && open) {
      setCurrentStatus(
        NORMALIZE_STATUS[appointment.status.toLowerCase()] ?? "pendiente"
      );
    }
  }, [appointment, open]);

  if (!appointment) return null;

  const isRescheduled = currentStatus === "reprogramada";
  const isFinal = currentStatus === "completada" || currentStatus === "cancelada";
  const statusCfg = APPOINTMENT_STATUS_CONFIG[currentStatus];
  const appointmentDate =
    appointment.date instanceof Date ? appointment.date : new Date(appointment.date);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: StatusKey) => {
    if (!appointment?.id) return;
    if (newStatus === "cancelada") {
      setShowCancelDialog(true);
      return;
    }
    try {
      setUpdatingStatus(true);
      await updateAppointment(
        appointment.id,
        { estado: newStatus },
        user?.displayName || "Sistema"
      );
      toast({
        title: "Estado actualizado",
        description: `La cita fue marcada como ${APPOINTMENT_STATUS_CONFIG[newStatus].label.toLowerCase()}.`,
      });
      onOpenChange(false);
      if (onSuccess) await onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el estado.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleConfirmCancellation = async () => {
    try {
      setUpdatingStatus(true);
      await updateAppointment(
        appointment.id,
        { estado: "cancelada" },
        user?.displayName || "Sistema"
      );
      toast({ title: "Cita cancelada", description: "La cita fue cancelada exitosamente." });
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
      toast({ title: "Cita eliminada", description: "La cita fue eliminada exitosamente." });
      setShowDeleteDialog(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar la cita.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-border/60">
          {/* Thin color accent */}
          <div className="h-[3px] w-full flex-shrink-0" style={{ backgroundColor: statusCfg.hex }} />

          {/* Header */}
          <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3">
            <DialogHeader className="space-y-0.5">
              <span className="text-xl font-semibold text-foreground">
                Detalles de cita
              </span>
            </DialogHeader>

            {/* Status pill */}
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 flex-shrink-0 mt-0.5 ${statusCfg.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
          </div>

          {/* Info grid */}
          <div className="px-6 py-4 border-t border-border/40 grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoRow label="Hora" value={appointment.time} />
            <InfoRow label="Paciente" value={appointment.patient} />
            <InfoRow label="Celular" value={appointment.patientPhone || "No registrado"} />
            <InfoRow label="Consulta" value={appointment.treatment} />
            <InfoRow label="Duración" value={appointment.duration} />
            {appointment.createdBy && (
              <InfoRow label="Creado por" value={appointment.createdBy} />
            )}
            {appointment.notes && (
              <div className="col-span-2">
                <InfoRow label="Notas" value={appointment.notes} />
              </div>
            )}
          </div>

          {/* Status change — hidden for reprogramada */}
          {!isRescheduled && (
            <div className="px-6 py-4 border-t border-border/40">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50 mb-2.5">
                Cambiar estado
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHANGE_OPTIONS.map((opt) => {
                  const cfg = APPOINTMENT_STATUS_CONFIG[opt.key];
                  const isActive = currentStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleStatusChange(opt.key)}
                      disabled={updatingStatus}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ring-1 disabled:opacity-60 ${isActive
                        ? cfg.pill
                        : "bg-muted/50 text-muted-foreground ring-transparent hover:ring-border/40 hover:bg-muted"
                        }`}
                    >
                      {updatingStatus && isActive ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between">
            {/* Destructive — left */}
            <div>
              {isRescheduled ? (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors"
                >
                  Cancelar cita
                </button>
              ) : !isFinal ? (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-[12px] font-medium text-red-500 hover:text-red-600 transition-colors"
                >
                  Eliminar cita
                </button>
              ) : null}
            </div>

            {/* Edit / Reschedule — right */}
            <div className="flex items-center gap-2">
              {onEdit && !isFinal && (
                <Button size="sm" variant="outline" onClick={onEdit} className="h-8 text-xs">
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Editar
                </Button>
              )}
              {currentStatus === "pendiente" && !isRescheduled && onReschedule && (
                <Button
                  size="sm"
                  onClick={onReschedule}
                  className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
                  Reprogramar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm cancel */}
      <ConfirmationDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={handleConfirmCancellation}
        title="¿Cancelar esta cita?"
        description={`¿Estás seguro de que deseas cancelar la cita de ${appointment.patient} programada para el ${format(appointmentDate, "PPP", { locale: es })} a las ${appointment.time}?`}
        confirmText="Sí, cancelar cita"
        cancelText="No, mantener cita"
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
        variant="destructive"
        loading={deleting}
      />
    </>
  );
}
