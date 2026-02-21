import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  Activity,
  Edit,
  ArrowLeft,
  DollarSign,
  Calendar,
  Clock,
  Plus,
  Loader2,
  User,
  Briefcase,
  Heart,
  Home,
  Stethoscope,
  Trash2,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EditPatientDialog from "./PatientDetailEdit";
import { toast } from "@/hooks/use-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types/appointment";
import { getAppointmentsByPatientId } from "@/services/appointmentService";
import {
  getTreatmentsByPatientId,
  deleteTreatment,
  type Treatment,
} from "@/services/treatmentService";
import { getPaymentsByPatientId, type Payment } from "@/services/paymentService";
import { formatCurrency } from "@/utils/formatters";
import TreatmentDialog from "@/components/treatments/TreatmentDialog";
import TreatmentEditDialog from "@/components/treatments/TreatmentEditDialog";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import PaymentDialog from "@/components/payments/PaymentDialog";
import MovimientosRecientes from "@/components/dashboard/RecentMovementsDialog";

interface PatientWithStats extends Patient {
  fullName: string;
  age: number | null;
  initials: string;
}


export default function PacienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientWithStats | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(true);
  const [isTreatmentDialogOpen, setIsTreatmentDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"tratamientos" | "consultas">("tratamientos");
  //Estados de pago
  const [pagos, setPagos] = useState<Payment[]>([]);
  const [loadingPagos, setLoadingPagos] = useState(true);

  //Estados de edicion de tratamiento
  const [isEditTreatmentDialogOpen, setIsEditTreatmentDialogOpen] = useState(false);
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [treatmentToDelete, setTreatmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<"consulta" | "tratamiento" | undefined>(undefined);
  const [selectedPaymentReferenceId, setSelectedPaymentReferenceId] = useState<string | undefined>(undefined);

  const [isCitaDetailOpen, setIsCitaDetailOpen] = useState(false);
  const [selectedCitaDetail, setSelectedCitaDetail] = useState<any | null>(null);

  const calculateAge = (fechaNacimiento: Date | undefined): number | null => {
    if (!fechaNacimiento) return null;
    const today = new Date();
    const birthDate = fechaNacimiento instanceof Date ? fechaNacimiento : new Date(fechaNacimiento);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const fetchPatient = async () => {
    if (!id) {
      setError("ID de paciente no válido");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const patientRef = doc(db, "pacientes", id);
      const patientSnap = await getDoc(patientRef);

      if (!patientSnap.exists()) {
        setError("Paciente no encontrado");
        setLoading(false);
        return;
      }

      const data = patientSnap.data();
      const fechaNacimiento = data.fecha_nacimiento?.toDate();
      const fechaCreacion = data.fecha_creacion?.toDate() || new Date();
      const fullName = `${data.nombre || ""} ${data.apellido_paterno || ""} ${data.apellido_materno || ""}`.trim();
      const age = data.edad || calculateAge(fechaNacimiento);
      const initials = `${data.nombre?.[0] || ""}${data.apellido_paterno?.[0] || ""}`.toUpperCase();

      const patientData: PatientWithStats = {
        id: patientSnap.id,
        nombre: data.nombre || "",
        apellido_paterno: data.apellido_paterno || "",
        apellido_materno: data.apellido_materno || "",
        dni_cliente: data.dni_cliente || "",
        celular: data.celular || "",
        telefono_fijo: data.telefono_fijo || "",
        email: data.email || "",
        fecha_nacimiento: fechaNacimiento,
        edad: age,
        sexo: data.sexo || "",
        estado_civil: data.estado_civil || "",
        direccion: data.direccion || "",
        distrito_direccion: data.distrito_direccion || "",
        lugar_procedencia: data.lugar_procedencia || "",
        ocupacion: data.ocupacion || "",
        fecha_creacion: fechaCreacion,
        fullName,
        age,
        initials,
      };

      setPatient(patientData);
    } catch (err) {
      console.error("Error al obtener paciente:", err);
      setError("Error al cargar los datos del paciente");
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    if (!id) return;
    try {
      setLoadingAppointments(true);
      const appointmentsData = await getAppointmentsByPatientId(id);
      const processedAppointments = appointmentsData.map((apt: any) => ({
        ...apt,
        fecha: apt.fecha?.toDate ? apt.fecha.toDate() : new Date(apt.fecha),
        fecha_creacion: apt.fecha_creacion?.toDate ? apt.fecha_creacion.toDate() : new Date(apt.fecha_creacion),
      }));
      setAppointments(processedAppointments);
    } catch (error) {
      console.error("Error al cargar citas:", error);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const fetchTreatments = async () => {
    if (!id) return;
    try {
      setLoadingTreatments(true);
      const treatmentsData = await getTreatmentsByPatientId(id);
      setTreatments(treatmentsData);
    } catch (error) {
      console.error("Error al cargar tratamientos:", error);
    } finally {
      setLoadingTreatments(false);
    }
  };

  const fetchPagos = async () => {
    if (!id) return;
    try {
      setLoadingPagos(true);
      const pagosData = await getPaymentsByPatientId(id);
      setPagos(pagosData);
    } catch (error) {
      console.error("Error al cargar pagos:", error);
    } finally {
      setLoadingPagos(false);
    }
  };

  useEffect(() => {
    fetchPatient();
    if (id) {
      fetchAppointments();
      fetchTreatments();
      fetchPagos();
    }
  }, [id]);

  const handleEditSuccess = () => {
    fetchPatient();
  };

  const handleTreatmentSuccess = () => {
    fetchTreatments();
  };

  const handleDeleteTreatment = async () => {
    if (!treatmentToDelete) return;

    try {
      setIsDeleting(true);
      await deleteTreatment(treatmentToDelete);
      toast({
        title: "✅ Tratamiento eliminado",
        description: "El tratamiento ha sido eliminado permanentemente.",
      });
      fetchTreatments();
      setIsDeleteDialogOpen(false);
      setTreatmentToDelete(null);
    } catch (error) {
      console.error("Error al eliminar tratamiento:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo eliminar el tratamiento.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (estado: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      confirmada: { label: "Confirmada", variant: "default" },
      pendiente: { label: "Pendiente", variant: "secondary" },
      completada: { label: "Completada", variant: "outline" },
      cancelada: { label: "Cancelada", variant: "destructive" },
      reprogramada: { label: "Reprogramada", variant: "secondary" },
    };
    const config = statusConfig[estado] || { label: estado, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTreatmentStatusBadge = (estado: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      activo: { label: "Activo", variant: "default" },
      completado: { label: "Completado", variant: "outline" },
      cancelado: { label: "Cancelado", variant: "destructive" },
      pausado: { label: "Pausado", variant: "secondary" },
    };
    const config = statusConfig[estado] || { label: estado, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };


  const getConsultas = () => {
    const citasEnTratamientos = new Set(treatments.flatMap(t => t.citas || []));
    return appointments.filter(apt => !citasEnTratamientos.has(apt.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando información del paciente...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Error</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || "No se pudo cargar la información del paciente"}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/pacientes")}>
                  Volver a Pacientes
                </Button>
                <Button size="sm" onClick={fetchPatient}>
                  Reintentar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const FinancialTab = () => {
    // Filtrar consultas no pagadas (solo confirmadas o completadas son cobrables)
    const estadosCobrables = ["confirmada", "completada"];
    const consultasPendientes = appointments.filter(apt => !apt.pagado && apt.costo > 0 && estadosCobrables.includes(apt.estado?.toLowerCase()));

    // Filtrar tratamientos no pagados completamente
    const tratamientosPendientes = treatments.filter(t => !t.pagado && t.total_presupuesto > 0);

    // Calcular totales
    const totalPendienteConsultas = consultasPendientes.reduce((sum, apt) => sum + (apt.costo || 0), 0);
    const totalPendienteTratamientos = tratamientosPendientes.reduce((sum, t) => sum + t.pago_pendiente, 0);
    const totalPagadoTratamientos = tratamientosPendientes.reduce((sum, t) => sum + t.monto_abonado, 0);
    const totalPendiente = totalPendienteConsultas + totalPendienteTratamientos;
    const totalPagado = totalPagadoTratamientos;
    const totalGeneral = totalPendiente + totalPagado;

    return (
      <div className="space-y-6">
        {/* Resumen financiero */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pendiente</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {formatCurrency(totalPendiente)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagado</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(totalPagado)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(totalGeneral)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna izquierda - Presupuestos y Tratamientos pendientes */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Presupuestos y Tratamientos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {loadingTreatments || loadingAppointments ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Cargando información...</p>
                  </div>
                ) : (
                  <>
                    {/* Tratamientos pendientes */}
                    {tratamientosPendientes.length > 0 && (
                      <div className="space-y-3">
                        {tratamientosPendientes.map((treatment) => (
                          <div key={treatment.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-semibold text-foreground">
                                  {treatment.tratamiento}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {treatment.diagnostico}
                                </p>
                              </div>
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                                En progreso
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-semibold text-foreground">
                                  {formatCurrency(treatment.total_presupuesto)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pagado:</span>
                                <span className="font-semibold text-green-600">
                                  {formatCurrency(treatment.monto_abonado)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Pendiente:</span>
                                <span className="font-semibold text-yellow-600">
                                  {formatCurrency(treatment.pago_pendiente)}
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedTreatment(treatment);
                                  setIsEditTreatmentDialogOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedPaymentType("tratamiento");
                                  setSelectedPaymentReferenceId(treatment.id);
                                  setIsPaymentDialogOpen(true);
                                }}
                              >
                                Registrar Pago
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Consultas pendientes */}
                    {consultasPendientes.length > 0 && (
                      <div className="space-y-3">
                        {tratamientosPendientes.length > 0 && (
                          <Separator className="my-4" />
                        )}
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Consultas Pendientes de Pago
                        </h4>
                        {consultasPendientes.map((apt) => (
                          <div key={apt.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-semibold text-foreground">
                                  {apt.tipo_consulta}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(apt.fecha).toLocaleDateString('es-PE', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })} • {apt.hora}
                                </p>
                              </div>
                              <span className="font-semibold text-yellow-600">
                                {formatCurrency(apt.costo)}
                              </span>
                            </div>

                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setSelectedPaymentType("consulta");
                                setSelectedPaymentReferenceId(apt.id);
                                setIsPaymentDialogOpen(true);
                              }}
                            >
                              Registrar Pago
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {tratamientosPendientes.length === 0 && consultasPendientes.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <DollarSign className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="font-semibold text-foreground">
                          No hay pagos pendientes
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Todos los tratamientos y consultas están al día
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha - Historial de Transacciones */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5" />
                  Historial de Transacciones
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {loadingPagos ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Cargando historial...</p>
                  </div>
                ) : pagos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Activity className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="font-semibold text-foreground">
                      No hay transacciones registradas
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Los pagos realizados aparecerán aquí
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pagos.map((pago) => (
                      <div key={pago.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <h4 className="font-semibold text-foreground">
                              {pago.concepto || pago.referencia_nombre}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {pago.fecha.toLocaleDateString('es-PE', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              })} • {pago.metodo_pago}
                            </p>
                          </div>
                          <span className="font-semibold text-lg text-foreground">
                            {formatCurrency(pago.monto)}
                          </span>
                        </div>

                        <Badge
                          variant="default"
                          className="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                        >
                          Completado
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const TreatmentsTab = () => {
    const consultas = getConsultas();

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2">

            <Button
              variant={viewMode === "tratamientos" ? "default" : "outline"}
              onClick={() => setViewMode("tratamientos")}
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              Tratamientos ({treatments.length})
            </Button>
            <Button
              variant={viewMode === "consultas" ? "default" : "outline"}
              onClick={() => setViewMode("consultas")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Consultas ({consultas.length})
            </Button>
          </div>
          <Button size="sm" onClick={() => setIsTreatmentDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Tratamiento
          </Button>
        </div>

        {viewMode === "consultas" && (
          <>
            {loadingAppointments ? (
              <Card>
                <CardContent className="p-12">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Cargando consultas...</p>
                  </div>
                </CardContent>
              </Card>
            ) : consultas.length === 0 ? (
              <Card>
                <CardContent className="p-12">
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-foreground">
                        No hay consultas individuales
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Las consultas que no estén asociadas a un tratamiento aparecerán aquí
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {consultas.map((appointment) => (
                  <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-shrink-0">
                          <div className="bg-primary/10 rounded-lg p-4 text-center min-w-[100px]">
                            <div className="text-2xl font-bold text-primary">
                              {new Date(appointment.fecha).getDate()}
                            </div>
                            <div className="text-xs text-muted-foreground uppercase">
                              {new Date(appointment.fecha).toLocaleDateString('es-PE', {
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm font-medium">{appointment.hora}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-grow space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-lg text-foreground">
                                {appointment.tipo_consulta}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                {getStatusBadge(appointment.estado)}
                                <span className="text-xs text-muted-foreground">
                                  • Duración: {appointment.duracion} min
                                </span>
                              </div>
                            </div>
                            {appointment.costo && appointment.costo > 0 && (
                              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-2 flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                    Costo
                                  </p>
                                  <p className="text-lg font-bold text-green-700 dark:text-green-300">
                                    S/ {appointment.costo}
                                  </p>
                                </div>
                              </div>
                            )}

                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {appointment.atendido_por && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span>Atendido por: {appointment.atendido_por}</span>
                              </div>
                            )}
                            {appointment.duracion_real && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>Duración real: {appointment.duracion_real} min</span>
                              </div>
                            )}
                            {appointment.hora_inicio_atencion && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Activity className="h-4 w-4" />
                                <span>
                                  Atención: {appointment.hora_inicio_atencion}
                                  {appointment.hora_fin_atencion && ` - ${appointment.hora_fin_atencion}`}
                                </span>
                              </div>
                            )}
                          </div>
                          {appointment.notas_observaciones && (
                            <div className="bg-muted/50 rounded-lg p-3 mt-2">
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Notas:
                                  </p>
                                  <p className="text-sm text-foreground">
                                    {appointment.notas_observaciones}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === "tratamientos" && (
          <>
            {loadingTreatments ? (
              <Card>
                <CardContent className="p-12">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Cargando tratamientos...</p>
                  </div>
                </CardContent>
              </Card>
            ) : treatments.length === 0 ? (
              <Card>
                <CardContent className="p-12">
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <Stethoscope className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-foreground">
                        No hay tratamientos registrados
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Los planes de tratamiento del paciente aparecerán aquí
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {treatments.map((treatment) => (
                  <Card key={treatment.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="border-b bg-muted/30">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Stethoscope className="h-5 w-5 text-primary" />
                            <CardTitle className="text-xl">
                              {treatment.tratamiento}
                            </CardTitle>
                            {getTreatmentStatusBadge(treatment.estado)}
                            {/* BADGE ESTADO PAGO*/}
                            {treatment.pagado && (
                              <Badge variant="default" className="bg-green-600">
                                Pagado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Creado el {treatment.fecha_creacion.toLocaleDateString('es-PE', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Presupuesto Total</p>
                            <p className="text-2xl font-bold text-primary">
                              {formatCurrency(treatment.total_presupuesto)}
                            </p>
                          </div>
                        </div>

                      </div>

                    </CardHeader>

                    <CardContent className="p-6 space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                          Diagnóstico
                        </h4>
                        <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg">
                          {treatment.diagnostico}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                          Citas
                        </h4>
                        {(() => {
                          const citasDelTratamiento = (treatment.citas || [])
                            .map((citaId: string) => appointments.find(apt => apt.id === citaId))
                            .filter(Boolean);

                          if (citasDelTratamiento.length === 0) {
                            return (
                              <p className="text-sm text-muted-foreground italic">
                                No hay citas registradas para este tratamiento
                              </p>
                            );
                          }

                          return (
                            <div className="border rounded-lg overflow-hidden">
                              <div className="bg-muted/50 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                                <div className="col-span-1">N° Cita</div>
                                <div className="col-span-3">Fecha</div>
                                <div className="col-span-2">Hora</div>
                                <div className="col-span-2">Atendido por</div>
                                <div className="col-span-2">Duración</div>
                                <div className="col-span-2 text-right">Detalle</div>
                              </div>
                              {citasDelTratamiento.map((cita: any, idx: number) => {
                                const fechaCita = cita.fecha instanceof Date ? cita.fecha : new Date(cita.fecha);
                                return (
                                  <div key={cita.id} className="px-4 py-3 grid grid-cols-12 gap-2 border-t items-center">
                                    <div className="col-span-1 font-medium text-sm">{idx + 1}</div>
                                    <div className="col-span-3 text-sm font-medium">
                                      {fechaCita.toLocaleDateString('es-PE', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </div>
                                    <div className="col-span-2 text-sm font-medium">{cita.hora}</div>
                                    <div className="col-span-2 text-sm text-muted-foreground">
                                      {cita.atendido_por || "—"}
                                    </div>
                                    <div className="col-span-2 text-sm">{cita.duracion ? `${cita.duracion} min` : "—"}</div>
                                    <div className="col-span-2 text-right">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedCitaDetail(cita);
                                          setIsCitaDetailOpen(true);
                                        }}
                                      >
                                        <Eye className="h-4 w-4 mr-1" />
                                        Detalle
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3">
                          Presupuesto Detallado
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/50 px-4 py-2 grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                            <div className="col-span-1">Cant.</div>
                            <div className="col-span-7">Descripción</div>
                            <div className="col-span-2 text-right">P. Unit.</div>
                            <div className="col-span-2 text-right">Total</div>
                          </div>
                          {treatment.presupuesto.map((item, idx) => (
                            <div key={idx}>
                              <div className="px-4 py-3 grid grid-cols-12 gap-2 border-t items-center">
                                <div className="col-span-1 font-medium">{item.cantidad}</div>
                                <div className="col-span-7 text-sm">{item.descripcion}</div>
                                <div className="col-span-2 text-right text-sm">
                                  {item.subitems && item.subitems.length > 0
                                    ? "-"
                                    : formatCurrency(item.precio_unitario)
                                  }
                                </div>
                                <div className="col-span-2 text-right font-medium">
                                  {formatCurrency(
                                    item.subitems && item.subitems.length > 0
                                      ? item.subitems.reduce((sum: number, sub: any) =>
                                        sum + (sub.cantidad * sub.precio_unitario), 0)
                                      : item.cantidad * item.precio_unitario
                                  )}
                                </div>
                              </div>
                              {item.subitems && item.subitems.length > 0 && (
                                item.subitems.map((subitem: any, subIdx: number) => (
                                  <div
                                    key={subIdx}
                                    className="px-4 py-2 grid grid-cols-12 gap-2 bg-muted/20 border-t items-center"
                                  >
                                    <div className="col-span-1 text-sm text-muted-foreground pl-4">
                                      {subitem.cantidad}
                                    </div>
                                    <div className="col-span-7 text-sm text-muted-foreground flex items-center gap-2">
                                      <span className="text-muted-foreground">↳</span>
                                      {subitem.descripcion}
                                    </div>
                                    <div className="col-span-2 text-right text-sm text-muted-foreground">
                                      {formatCurrency(subitem.precio_unitario)}
                                    </div>
                                    <div className="col-span-2 text-right text-sm font-medium text-muted-foreground">
                                      {formatCurrency(subitem.cantidad * subitem.precio_unitario)}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTreatmentToDelete(treatment.id);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTreatment(treatment);
                            setIsEditTreatmentDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>

                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {(viewMode === "consultas" && consultas.length > 0) ||
          (viewMode === "tratamientos" && treatments.length > 0) ? (
          <Card className="bg-muted/30">
            <CardContent className="p-6">
              {viewMode === "consultas" ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{consultas.length}</p>
                    <p className="text-xs text-muted-foreground">Total consultas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">
                      {consultas.filter(a => a.estado === "pendiente").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {consultas.filter(a => a.estado === "completada").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Completadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {consultas.filter(a => a.estado === "confirmada").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Confirmadas</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{treatments.length}</p>
                    <p className="text-xs text-muted-foreground">Total tratamientos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {treatments.filter(t => t.estado === "activo").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Activos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {treatments.filter(t => t.estado === "completado").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Completados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(treatments.reduce((sum, t) => sum + t.total_presupuesto, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">Presupuesto total</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/pacientes">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Pacientes
          </Button>
        </Link>
      </div>

      <div className="p-6 lg:p-8 bg-background rounded-lg border">
        {(() => {
          const optionalFields = [
            patient.email,
            patient.celular,
            patient.direccion,
            patient.distrito_direccion,
            patient.lugar_procedencia,
            patient.estado_civil,
            patient.ocupacion,
            patient.sexo,
            patient.fecha_nacimiento,
          ];
          const filled = optionalFields.filter(f => f && String(f).trim() !== "").length;
          const total = optionalFields.length;
          const pct = Math.round((filled / total) * 100);
          const isComplete = pct === 100;

          const size = 76;
          const strokeWidth = 7;
          const radius = (size - strokeWidth) / 2;
          const circumference = 2 * Math.PI * radius;
          const dashOffset = circumference - (pct / 100) * circumference;
          const ringColor = isComplete ? "#22c55e" : "#eab308";

          return (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-primary">
                    {patient.initials}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap place-items-center gap-4">
                    <h1 className="text-3xl font-bold text-foreground">
                      {patient.fullName}
                    </h1>
                    {isComplete && (
                      <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs">
                        Perfil completo
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2">

                    <span className="text-sm text-muted-foreground">
                      DNI: {patient.dni_cliente}
                    </span>
                    {patient.age && (
                      <span className="text-sm text-muted-foreground">
                        {patient.age} años
                      </span>
                    )}
                  </div>
                  {patient.ocupacion && (
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <span className="text-sm text-muted-foreground">
                          {patient.celular}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {patient.ocupacion}
                        </span>
                      </div>



                    </div>
                  )}
                </div>

                {/* Gráfico circular - solo cuando el perfil NO está completo */}
                {!isComplete && (
                  <div className="flex flex-col items-center ml-4 self-start">
                    <div className="relative" style={{ width: size, height: size }}>
                      <svg width={size} height={size} className="-rotate-90">
                        <circle
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={strokeWidth}
                          strokeOpacity={0.2}
                        />
                        <circle
                          cx={size / 2}
                          cy={size / 2}
                          r={radius}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={strokeWidth}
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.5s ease" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[13px] font-bold" style={{ color: ringColor }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón */}
              <Button
                variant={isComplete ? "outline" : "default"}
                size="sm"
                onClick={() => setIsEditDialogOpen(true)}
                className={isComplete ? "md:ml-auto" : "md:ml-auto bg-amber-400 hover:bg-amber-500 text-white border-0"}
              >
                <Edit className="h-4 w-4 mr-2 shrink-0" />
                {isComplete ? "Editar" : "Completar datos"}
              </Button>
            </div>
          );
        })()}

        <Separator className="my-6" />

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="general">Información General</TabsTrigger>
            <TabsTrigger value="movimientos">Historial</TabsTrigger>
            <TabsTrigger value="treatments">Tratamientos</TabsTrigger>
            <TabsTrigger value="financial">Finanzas</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Información de Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patient.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{patient.email}</p>
                      </div>
                    </div>
                  )}
                  {patient.celular && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Celular</p>
                        <p className="text-sm font-medium">{patient.celular}</p>
                      </div>
                    </div>
                  )}
                  {patient.telefono_fijo && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Teléfono Fijo</p>
                        <p className="text-sm font-medium">{patient.telefono_fijo}</p>
                      </div>
                    </div>
                  )}
                  {!patient.email && !patient.celular && !patient.telefono_fijo && (
                    <p className="text-sm text-muted-foreground">
                      No hay información de contacto registrada
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Dirección
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patient.direccion && (
                    <div className="flex items-start gap-3">
                      <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Dirección</p>
                        <p className="text-sm font-medium">{patient.direccion}</p>
                      </div>
                    </div>
                  )}
                  {patient.distrito_direccion && (
                    <div className="flex items-start gap-3">
                      <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Distrito</p>
                        <p className="text-sm font-medium">{patient.distrito_direccion}</p>
                      </div>
                    </div>
                  )}
                  {patient.lugar_procedencia && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Lugar de Procedencia</p>
                        <p className="text-sm font-medium">{patient.lugar_procedencia}</p>
                      </div>
                    </div>
                  )}
                  {!patient.direccion && !patient.lugar_procedencia && (
                    <p className="text-sm text-muted-foreground">
                      No hay información de dirección registrada
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Datos Personales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patient.fecha_nacimiento && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha de Nacimiento</p>
                        <p className="text-sm font-medium">
                          {patient.fecha_nacimiento.toLocaleDateString('es-PE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                  {patient.estado_civil && (
                    <div className="flex items-start gap-3">
                      <Heart className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Estado Civil</p>
                        <p className="text-sm font-medium">{patient.estado_civil}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha de Registro</p>
                      <p className="text-sm font-medium">
                        {patient.fecha_creacion.toLocaleDateString('es-PE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Información Adicional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">DNI</p>
                      <p className="text-sm font-medium">{patient.dni_cliente}</p>
                    </div>
                    {patient.edad && (
                      <div>
                        <p className="text-xs text-muted-foreground">Edad</p>
                        <p className="text-sm font-medium">{patient.edad} años</p>
                      </div>
                    )}
                    {patient.sexo && (
                      <div>
                        <p className="text-xs text-muted-foreground">Sexo</p>
                        <p className="text-sm font-medium">{patient.sexo}</p>
                      </div>
                    )}
                    {patient.ocupacion && (
                      <div>
                        <p className="text-xs text-muted-foreground">Ocupación</p>
                        <p className="text-sm font-medium">{patient.ocupacion}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="movimientos">
            <MovimientosRecientes
              appointments={appointments}
              pagos={pagos}
              loadingAppointments={loadingAppointments}
              loadingPagos={loadingPagos}
            />
          </TabsContent>

          <TabsContent value="treatments">
            <TreatmentsTab />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialTab />
          </TabsContent>

        </Tabs>
      </div>

      <EditPatientDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        patient={patient}
        onSuccess={handleEditSuccess}
      />

      <TreatmentDialog
        open={isTreatmentDialogOpen}
        onOpenChange={setIsTreatmentDialogOpen}
        patientId={patient.id!}
        patientName={patient.fullName}
        onSuccess={handleTreatmentSuccess}
      />
      <TreatmentEditDialog
        open={isEditTreatmentDialogOpen}
        onOpenChange={setIsEditTreatmentDialogOpen}
        treatment={selectedTreatment}
        onSuccess={handleTreatmentSuccess}
      />
      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setTreatmentToDelete(null);
          }
        }}
        onConfirm={handleDeleteTreatment}
        title="¿Eliminar tratamiento?"
        description="Esta acción marcará el tratamiento como cancelado. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={isDeleting}
      />
      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) {
            setSelectedPaymentType(undefined);
            setSelectedPaymentReferenceId(undefined);
          }
        }}
        onSuccess={() => {
          fetchTreatments();
          fetchAppointments();
          fetchPagos();
        }}
        preselectedPatientId={patient?.id}
        preselectedPatientName={patient?.fullName}
        preselectedType={selectedPaymentType}
        preselectedReferenceId={selectedPaymentReferenceId}
      />

      {/* Modal de detalle de cita de tratamiento */}
      <Dialog open={isCitaDetailOpen} onOpenChange={setIsCitaDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Cita</DialogTitle>
          </DialogHeader>
          {selectedCitaDetail && (() => {
            const cita = selectedCitaDetail;
            const fechaCita = cita.fecha instanceof Date ? cita.fecha : new Date(cita.fecha);
            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha</p>
                      <p className="text-sm font-semibold">
                        {fechaCita.toLocaleDateString('es-PE', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Hora</p>
                      <p className="text-sm font-semibold">{cita.hora}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <User className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Atendido por</p>
                      <p className="text-sm font-semibold">{cita.atendido_por || "No registrado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duración estimada</p>
                      <p className="text-sm font-semibold">{cita.duracion ? `${cita.duracion} min` : "No registrado"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Activity className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <div className="mt-1">{getStatusBadge(cita.estado)}</div>
                  </div>
                </div>

                {(cita.hora_inicio_atencion || cita.duracion_real) && (
                  <div className="grid grid-cols-2 gap-3">
                    {cita.hora_inicio_atencion && (
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">Horario de atención</p>
                        <p className="text-sm font-semibold">
                          {cita.hora_inicio_atencion}
                          {cita.hora_fin_atencion && ` - ${cita.hora_fin_atencion}`}
                        </p>
                      </div>
                    )}
                    {cita.duracion_real && (
                      <div className="p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">Duración real</p>
                        <p className="text-sm font-semibold">{cita.duracion_real} min</p>
                      </div>
                    )}
                  </div>
                )}

                {cita.notas_observaciones && (
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Notas y observaciones</p>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{cita.notas_observaciones}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}