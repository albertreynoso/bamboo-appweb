import { useState } from "react";
import GoogleCalendarView from "@/components/calendar/GoogleCalendarView";
import AppointmentDialog from "@/components/calendar/AppointmentDialog";
import { useAppointments } from "@/hooks/useAppointments";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import AppointmentDetailsDialog from "@/components/calendar/AppointmentDetailsDialog";
import AppointmentEditDialog from "@/components/calendar/AppointmentEditDialog";
import { getAppointmentColor } from "@/types/appointment";
import AppointmentRescheduleDialog from "@/components/calendar/AppointmentRescheduleDialog";

// Interfaz para las citas que usa GoogleCalendarView
interface CalendarAppointment {
  id: string;
  time: string;
  patient: string;
  patientId: string;
  dentist: string;
  dentistId: string;
  treatment: string;
  duration: string;
  status: string;
  date: Date;
  notes?: string;
  color: string;
  patientPhone?: string;
  createdBy?: string;
  // Campos para distinguir entre consulta y tratamiento
  isTreatment: boolean;
  treatmentName?: string;
  consultationType?: string;
  // Campos de atención
  atendidoPor?: string;
  duracionReal?: string;
  notasAtencion?: string;
  planificacionSiguienteCita?: string;
  personalConsulta?: { nombre: string; rol: string }[];
}

// Función helper para normalizar estado — devuelve el valor canónico en español
const normalizeStatusToEnglish = (estado: string = ''): string => {
  const statusMap: Record<string, string> = {
    'confirmada': 'confirmada',
    'confirmed': 'confirmada',
    'pendiente': 'pendiente',
    'pending': 'pendiente',
    'atendiendo': 'atendiendo',
    'attending': 'atendiendo',
    'atendida': 'atendida',
    'attended': 'atendida',
    'completada': 'atendida',
    'completed': 'atendida',
    'cancelada': 'cancelada',
    'cancelled': 'cancelada',
    'reprogramada': 'reprogramada',
    'reprogramed': 'reprogramada',
  };
  return statusMap[estado?.toLowerCase() || ''] || 'pendiente';
};

export default function Calendario() {
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date | null; time: string }>({
    date: null,
    time: ""
  });

  // Cargar citas desde Firebase
  const { appointments, loading, refetch } = useAppointments();
  const show = useMinLoading(loading);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false); // ← NUEVO
  // Convertir las citas de Firebase al formato que espera GoogleCalendarView
  const formattedAppointments: CalendarAppointment[] = appointments.map(apt => ({
    id: apt.id || "",
    time: apt.hora,
    patient: apt.paciente_nombre,
    patientId: apt.paciente_id,
    dentist: apt.atendido_por || "Por asignar",
    dentistId: "D001",
    treatment: apt.tipo_consulta,
    duration: `${apt.duracion} min`,
    status: normalizeStatusToEnglish(apt.estado),
    date: apt.fecha,
    notes: apt.notas_observaciones,
    color: getAppointmentColor(apt.estado),
    createdBy: apt.historial_estados?.[0]?.realizado_por,
    isTreatment: apt.es_tratamiento || false,
    treatmentName: apt.tratamiento_nombre,
    consultationType: apt.tipo_consulta,
    atendidoPor: apt.atendido_por,
    duracionReal: apt.duracion_real,
    notasAtencion: apt.notas_atencion,
    planificacionSiguienteCita: apt.planificacion_siguiente_cita,
    personalConsulta: apt.personal_consulta,
  }));

  // Manejo de clic en slot del calendario
  const handleSlotClick = (date: Date, time: string) => {
    setSelectedSlot({ date, time });
    setShowAppointmentModal(true);
  };

  // Manejo de clic en cita existente
  const handleAppointmentClick = (appointment: CalendarAppointment) => {
    setSelectedAppointment(appointment);
    setShowDetailsModal(true);
  };

  // Callback cuando se crea una cita exitosamente
  const handleAppointmentSuccess = () => {
    refetch(); // Recargar las citas
  };

  // Manejo de edición de cita
  const handleEditAppointment = () => {
    setShowDetailsModal(false);
    setShowEditModal(true);
  };

  // Manejo de reprogramación de cita
  const handleRescheduleAppointment = () => {
    setShowDetailsModal(false);
    setShowRescheduleModal(true);
  };

  // Callback cuando se actualiza/cancela una cita
  const handleDetailsSuccess = async () => {
    try {
      const updatedAppointments = await refetch();

      if (selectedAppointment?.id && updatedAppointments) {
        const updatedAppointment = updatedAppointments.find(
          apt => apt.id === selectedAppointment.id
        );

        if (updatedAppointment) {
          // Convertir al formato CalendarAppointment con datos FRESCOS
          const refreshedAppointment: CalendarAppointment = {
            id: updatedAppointment.id || "",
            time: updatedAppointment.hora,
            patient: updatedAppointment.paciente_nombre,
            patientId: updatedAppointment.paciente_id,
            dentist: updatedAppointment.atendido_por || "Por asignar",
            dentistId: "D001",
            treatment: updatedAppointment.tipo_consulta,
            duration: `${updatedAppointment.duracion} min`, // ⚠️ DURACIÓN ACTUALIZADA
            status: normalizeStatusToEnglish(updatedAppointment.estado),
            date: updatedAppointment.fecha,
            notes: updatedAppointment.notas_observaciones,
            color: getAppointmentColor(updatedAppointment.estado),
            createdBy: updatedAppointment.historial_estados?.[0]?.realizado_por,
            isTreatment: updatedAppointment.es_tratamiento || false,
            treatmentName: updatedAppointment.tratamiento_nombre,
            consultationType: updatedAppointment.tipo_consulta,
            atendidoPor: updatedAppointment.atendido_por,
            duracionReal: updatedAppointment.duracion_real,
            notasAtencion: updatedAppointment.notas_atencion,
            planificacionSiguienteCita: updatedAppointment.planificacion_siguiente_cita,
            personalConsulta: updatedAppointment.personal_consulta,
          };

          setSelectedAppointment(refreshedAppointment);
        } else {
          // Si la cita ya no existe (fue eliminada), limpiar selección
          setSelectedAppointment(null);
          setShowDetailsModal(false);
        }
      }
    } catch (error) {
      console.error("❌ Error al recargar citas:", error);
    }
  };

  if (show) return <PageLoader message="Cargando citas..." />;

  return (
    <div className="h-screen flex flex-col -m-6 lg:-m-8">
      {/* Vista de Calendario tipo Google Calendar */}
      <div className="flex-1 min-h-0">
        <GoogleCalendarView
          appointments={formattedAppointments}
          onSlotClick={handleSlotClick}
          onNewAppointment={() => {
            setSelectedSlot({ date: new Date(), time: "09:00" });
            setShowAppointmentModal(true);
          }}
          onAppointmentClick={handleAppointmentClick}
        />
      </div>

      {/* Modal de Nueva Cita */}
      <AppointmentDialog
        open={showAppointmentModal}
        onOpenChange={setShowAppointmentModal}
        selectedDate={selectedSlot.date || undefined}
        selectedTime={selectedSlot.time}
        onSuccess={handleAppointmentSuccess}
      />

      {/* Modal de Detalles de Cita */}
      <AppointmentDetailsDialog
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        appointment={selectedAppointment}
        onEdit={handleEditAppointment}
        onReschedule={handleRescheduleAppointment}
        onSuccess={handleDetailsSuccess}
      />

      {/* Modal de Edición de Cita */}
      <AppointmentEditDialog
        open={showEditModal}
        onOpenChange={setShowEditModal}
        appointment={selectedAppointment}
        onBack={() => {
          setShowEditModal(false);
          setShowDetailsModal(true);
        }}
        onSuccess={() => {
          refetch();
          setShowEditModal(false);
          setSelectedAppointment(null);
        }}
      />


      {/* Modal de Reprogramación de Cita */}
      <AppointmentRescheduleDialog
        open={showRescheduleModal}
        onOpenChange={setShowRescheduleModal}
        appointment={selectedAppointment}
        onSuccess={() => {
          refetch();
          setShowRescheduleModal(false);
          setSelectedAppointment(null);
        }}
      />
    </div>
  );
}