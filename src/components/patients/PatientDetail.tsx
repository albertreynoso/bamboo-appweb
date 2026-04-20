import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
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
  CreditCard,
  Hash,
  ChevronDown,
  ChevronUp,
  Save,
  Timer,
  UserCheck,
  Users,
  CalendarPlus,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditPatientDialog from "./PatientDetailEdit";
import { toast } from "@/hooks/use-toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types/appointment";
import { subscribeToAppointmentsByPatient } from "@/services/appointmentService";
import {
  getTreatmentsByPatientId,
  updateTreatment,
  deleteTreatment,
  saveCronogramaDePagos,
  type Treatment,
  type CuotaCronograma,
} from "@/services/treatmentService";
import { getPaymentsByPatientId, type Payment } from "@/services/paymentService";
import { formatCurrency } from "@/utils/formatters";
import TreatmentDialog from "@/components/treatments/TreatmentDialog";
import TreatmentEditDialog from "@/components/treatments/TreatmentEditDialog";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import PaymentDialog from "@/components/payments/PaymentDialog";
import MovimientosRecientes from "@/components/dashboard/RecentMovementsDialog";
import { useActivityLog } from "@/hooks/useActivityLog";

interface PatientWithStats extends Patient {
  fullName: string;
  age: number | null;
  initials: string;
}


export default function PacienteDetalle() {
  const { log } = useActivityLog();
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
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [treatmentToDelete, setTreatmentToDelete] = useState<string | null>(null);
  const [treatmentToCancel, setTreatmentToCancel] = useState<Treatment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<"consulta" | "tratamiento" | undefined>(undefined);
  const [selectedPaymentReferenceId, setSelectedPaymentReferenceId] = useState<string | undefined>(undefined);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "general";
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });
  const [finanzasView, setFinanzasView] = useState<"tratamientos" | "consultas">("tratamientos");
  const [isCitaDetailOpen, setIsCitaDetailOpen] = useState(false);
  const [selectedCitaDetail, setSelectedCitaDetail] = useState<any | null>(null);
  const [citaDetailType, setCitaDetailType] = useState<"cita" | "consulta">("cita");
  const [expandedTreatments, setExpandedTreatments] = useState<Set<string>>(new Set());

  const toggleTreatmentExpansion = (treatmentId: string) => {
    setExpandedTreatments(prev => {
      const next = new Set(prev);
      if (next.has(treatmentId)) {
        next.delete(treatmentId);
      } else {
        next.add(treatmentId);
      }
      return next;
    });
  };


  // Generate installments, rounding to integers, adjusting last to match exact total
  const generateCuotas = (total: number, n: number): number[] => {
    if (n <= 0) return [];
    const base = Math.round(total / n);
    const cuotas = Array(n).fill(base);
    const diff = total - cuotas.reduce((a, b) => a + b, 0);
    cuotas[n - 1] += diff;
    return cuotas;
  };

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

  // fetchAppointments — reemplazado por suscripción en tiempo real en useEffect

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
      // Citas — suscripción en tiempo real
      setLoadingAppointments(true);
      const unsubscribe = subscribeToAppointmentsByPatient(
        id,
        (data) => {
          setAppointments(data);
          setLoadingAppointments(false);
        },
        () => setLoadingAppointments(false)
      );

      fetchTreatments();
      fetchPagos();

      return () => unsubscribe();
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
      const treatmentName = treatments.find(t => t.id === treatmentToDelete)?.tratamiento;
      await deleteTreatment(treatmentToDelete);
      log({ modulo: "Tratamientos", accion: "eliminó", entidad: "tratamiento", entidad_id: treatmentToDelete, entidad_nombre: treatmentName, paciente_nombre: patient?.fullName });
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

  const handleCancelTreatment = async () => {
    if (!treatmentToCancel) return;

    try {
      setIsCancelling(true);
      await updateTreatment(treatmentToCancel.id!, {
        ...treatmentToCancel,
        estado: "cancelado",
        monto_abonado: treatmentToCancel.monto_abonado || 0,
        total_presupuesto: treatmentToCancel.total_presupuesto || 0,
        cantidad_citas_planificadas: treatmentToCancel.cantidad_citas_planificadas || 0,
        presupuesto: treatmentToCancel.presupuesto || [],
        diagnostico: treatmentToCancel.diagnostico || "",
        tratamiento: treatmentToCancel.tratamiento || ""
      } as any);

      toast({
        title: "✅ Tratamiento cancelado",
        description: "El tratamiento ha sido cancelado y no puede reactivarse.",
      });
      fetchTreatments();
      setIsCancelDialogOpen(false);
      setTreatmentToCancel(null);
    } catch (error) {
      console.error("Error al cancelar tratamiento:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo cancelar el tratamiento.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (estado: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      confirmada: { label: "Confirmada", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80" },
      pendiente: { label: "Pendiente", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80" },
      atendiendo: { label: "Atendiendo", className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80" },
      atendida: { label: "Atendida", className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80" },
      completada: { label: "Atendida", className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80" },
      cancelada: { label: "Cancelada", className: "bg-red-50 text-red-700 ring-1 ring-red-200/80" },
      reprogramada: { label: "Reprogramada", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80" },
    };
    const config = statusConfig[estado] || { label: estado, className: "bg-muted text-muted-foreground ring-1 ring-border" };
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", config.className)}>
        {config.label}
      </span>
    );
  };

  const getTreatmentStatusBadge = (estado: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      activo: { label: "Activo", variant: "default" },
      completado: { label: "Completado", variant: "outline" },
      cancelado: { label: "Cancelado", variant: "destructive" },
      pausado: { label: "Pausado", variant: "secondary" },
      pausada: { label: "Pausado", variant: "secondary" },
      cancelada: { label: "Cancelado", variant: "destructive" },
    };
    const config = statusConfig[estado] || { label: estado, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };


  const getConsultas = () => {
    const citasEnTratamientos = new Set(treatments.flatMap(t => t.citas || []));
    const tratamientoIds = new Set(treatments.map(t => t.id));
    return appointments.filter(apt =>
      !citasEnTratamientos.has(apt.id) &&
      !(apt.tratamiento_id && tratamientoIds.has(apt.tratamiento_id))
    );
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

  const GeneralTab = () => {
    return (
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
    );
  };

  const FinancialTab = () => {
    const estadosCobrables = ["confirmada", "atendiendo", "atendida", "completada"];
    const todosLosTratamientos = treatments.filter(t => t.total_presupuesto > 0 && !t.pagado && t.estado !== "cancelado" && t.estado !== "cancelada");
    const todasLasConsultas = appointments.filter(apt => apt.costo > 0 && !apt.pagado && estadosCobrables.includes(apt.estado?.toLowerCase()));

    const totalPendiente =
      todosLosTratamientos.reduce((sum, t) => sum + (t.pagado ? 0 : t.pago_pendiente), 0) +
      todasLasConsultas.reduce((sum, apt) => sum + (apt.pagado ? 0 : apt.costo || 0), 0);
    const totalPagado =
      todosLosTratamientos.reduce((sum, t) => sum + t.monto_abonado, 0) +
      todasLasConsultas.reduce((sum, apt) => sum + (apt.pagado ? apt.costo || 0 : 0), 0);
    const totalGeneral = totalPendiente + totalPagado;

    const PANEL_H = "58vh";

    return (
      <div className="space-y-5">
        {/* Resumen financiero — barra compacta horizontal */}
        <div className="flex items-stretch divide-x divide-border/70 bg-card rounded-xl border border-border/70 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-4 flex-1">
            <div className="p-2 rounded-lg bg-orange-50 flex-none">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-orange-600 leading-none">{formatCurrency(totalPendiente)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">Pendiente</p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-6 py-4 flex-1">
            <div className="p-2 rounded-lg bg-emerald-50 flex-none">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600 leading-none">{formatCurrency(totalPagado)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">Pagado</p>
            </div>
          </div>
          <div className="flex items-center gap-4 px-6 py-4 flex-1">
            <div className="p-2 rounded-lg bg-blue-50 flex-none">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600 leading-none">{formatCurrency(totalGeneral)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium uppercase tracking-wide">Total</p>
            </div>
          </div>
        </div>

        {/* Paneles principales */}
        <div className="rounded-3xl border border-slate-100 bg-slate-50/30 overflow-hidden shadow-inner">
          {/* Header del contenedor — selector + botón general */}
          <div className="p-4 bg-white/40 border-b border-slate-100/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center bg-muted/60 rounded-xl p-1 gap-1 border border-border/40">
              <button
                onClick={() => setFinanzasView("tratamientos")}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${finanzasView === "tratamientos"
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                <Stethoscope className={`h-4 w-4 ${finanzasView === "tratamientos" ? "text-primary" : "text-muted-foreground"}`} />
                Tratamientos ({todosLosTratamientos.length})
              </button>
              <button
                onClick={() => setFinanzasView("consultas")}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${finanzasView === "consultas"
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                <Calendar className={`h-4 w-4 ${finanzasView === "consultas" ? "text-primary" : "text-muted-foreground"}`} />
                Consultas ({todasLasConsultas.length})
              </button>
            </div>
            <Button
              size="sm"
              className="bg-[#00665a] hover:bg-[#004d44] text-white"
              onClick={() => {
                setSelectedPaymentType(undefined);
                setSelectedPaymentReferenceId(undefined);
                setIsPaymentDialogOpen(true);
              }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Realizar Pago
            </Button>
          </div>

          {/* Dos columnas iguales */}
          <div className="grid grid-cols-2 divide-x divide-slate-100">

            {/* Columna izquierda — Presupuestos */}
            <div className="flex flex-col overflow-hidden" style={{ height: PANEL_H }}>
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white/30 flex items-center gap-2 flex-shrink-0">
                {finanzasView === "tratamientos"
                  ? <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                  : <Calendar className="h-3.5 w-3.5 text-slate-400" />
                }
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {finanzasView === "tratamientos" ? "Presupuestos de Tratamiento" : "Presupuestos de Consulta"}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-2">
                  {loadingTreatments || loadingAppointments ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Cargando...</p>
                    </div>
                  ) : finanzasView === "tratamientos" ? (
                    todosLosTratamientos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                        <DollarSign className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm font-semibold text-slate-500">Sin tratamientos</p>
                        <p className="text-xs text-muted-foreground">Los tratamientos con presupuesto aparecerán aquí</p>
                      </div>
                    ) : (
                      todosLosTratamientos.map((treatment) => (
                        <Card key={treatment.id} className="border-slate-100 overflow-hidden shadow-none">
                          <div className="px-3 py-2.5 flex items-center gap-3">
                            {/* Icono */}
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Stethoscope className="h-4 w-4 text-primary" />
                            </div>
                            {/* Nombre + badge */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-slate-700 text-sm truncate">{treatment.tratamiento}</h3>
                              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100 mt-0.5">Con deuda</span>
                            </div>
                            {/* Grid de valores — columnas de ancho fijo */}
                            <div className="flex-shrink-0 flex gap-2 text-right">
                              <div className="w-[68px]">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Abonado</p>
                                <p className="text-xs font-bold text-emerald-600">{formatCurrency(treatment.monto_abonado)}</p>
                              </div>
                              <div className="w-[68px]">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Pendiente</p>
                                <p className="text-xs font-bold text-amber-500">{formatCurrency(treatment.pago_pendiente)}</p>
                              </div>
                              <div className="w-[60px]">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Total</p>
                                <p className="text-xs font-bold text-slate-800">{formatCurrency(treatment.total_presupuesto)}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )
                  ) : (
                    todasLasConsultas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                        <DollarSign className="h-10 w-10 text-muted-foreground/40" />
                        <p className="text-sm font-semibold text-slate-500">Sin consultas</p>
                        <p className="text-xs text-muted-foreground">Las consultas con costo aparecerán aquí</p>
                      </div>
                    ) : (
                      todasLasConsultas.map((apt) => {
                        const fechaApt = apt.fecha instanceof Date ? apt.fecha : new Date(apt.fecha);
                        return (
                          <Card key={apt.id} className="border-slate-100 overflow-hidden shadow-none">
                            <div className="px-3 py-2.5 flex items-center gap-3">
                              {/* Icono */}
                              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <Calendar className="h-4 w-4 text-blue-500" />
                              </div>
                              {/* Nombre + fecha */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-700 text-sm truncate">{apt.tipo_consulta}</h3>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {fechaApt.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} · {apt.hora}
                                </p>
                              </div>
                              {/* Total */}
                              <div className="flex-shrink-0 text-right">
                                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">Total</p>
                                <p className="text-xs font-bold text-slate-800">{formatCurrency(apt.costo)}</p>
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Columna derecha — Historial de pagos */}
            <div className="flex flex-col overflow-hidden" style={{ height: PANEL_H }}>
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white/30 flex items-center gap-2 flex-shrink-0">
                <Activity className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Historial de Pagos</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-2">
                  {loadingPagos ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Cargando historial...</p>
                    </div>
                  ) : pagos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                      <Activity className="h-10 w-10 text-muted-foreground/40" />
                      <p className="text-sm font-semibold text-slate-500">Sin transacciones</p>
                      <p className="text-xs text-muted-foreground">Los pagos realizados aparecerán aquí</p>
                    </div>
                  ) : (
                    pagos.map((pago) => (
                      <div key={pago.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50/60 transition-colors">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          pago.tipo === "tratamiento" ? "bg-primary/10" : "bg-blue-50"
                        )}>
                          {pago.tipo === "tratamiento"
                            ? <Stethoscope className="h-4 w-4 text-primary" />
                            : <Calendar className="h-4 w-4 text-blue-500" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-700 truncate">{pago.concepto || pago.referencia_nombre}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {(() => {
                              const d = pago.fecha instanceof Date ? pago.fecha : new Date(pago.fecha);
                              const wd = d.toLocaleDateString('es-PE', { weekday: 'short' });
                              const mo = d.toLocaleDateString('es-PE', { month: 'short' });
                              const time = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
                              return `${wd}, ${d.getDate()} ${mo} de ${d.getFullYear()} - ${time}`;
                            })()} · {pago.metodo_pago}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(pago.monto)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const TreatmentsTab = () => {
    const consultas = getConsultas();

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-100 bg-slate-50/30 overflow-hidden shadow-inner flex flex-col">
          {/* Integrated Header */}
          <div className="p-4 bg-white/40 border-b border-slate-100/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center bg-muted/60 rounded-xl p-1 gap-1 border border-border/40">
              <button
                onClick={() => setViewMode("tratamientos")}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${viewMode === "tratamientos"
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <Stethoscope className={`h-4 w-4 ${viewMode === "tratamientos" ? "text-primary" : "text-muted-foreground"}`} />
                Tratamientos ({treatments.length})
              </button>
              <button
                onClick={() => setViewMode("consultas")}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 ${viewMode === "consultas"
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                <Calendar className={`h-4 w-4 ${viewMode === "consultas" ? "text-primary" : "text-muted-foreground"}`} />
                Consultas ({consultas.length})
              </button>
            </div>
            <Button size="sm" onClick={() => setIsTreatmentDialogOpen(true)} className="bg-[#00665a] hover:bg-[#004d44] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Tratamiento
            </Button>
          </div>

          <ScrollArea className="h-[65vh]">
            <div className="p-6">
              {viewMode === "consultas" && (
                <>
                  {loadingAppointments ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Cargando consultas...</p>
                    </div>
                  ) : consultas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">No hay consultas individuales</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Las consultas que no estén asociadas a un tratamiento aparecerán aquí
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {consultas.map((appointment) => {
                        const fecha = appointment.fecha instanceof Date
                          ? appointment.fecha
                          : new Date(appointment.fecha);
                        const iconStyle: Record<string, { bg: string; text: string }> = {
                          confirmada: { bg: "bg-emerald-50", text: "text-emerald-600" },
                          pendiente: { bg: "bg-amber-50", text: "text-amber-600" },
                          atendiendo: { bg: "bg-slate-100", text: "text-slate-500" },
                          atendida: { bg: "bg-slate-100", text: "text-slate-500" },
                          completada: { bg: "bg-slate-100", text: "text-slate-500" },
                          cancelada: { bg: "bg-red-50", text: "text-red-500" },
                          reprogramada: { bg: "bg-orange-50", text: "text-orange-500" },
                        };
                        const style = iconStyle[appointment.estado] || iconStyle.pendiente;
                        return (
                          <Card
                            key={appointment.id}
                            className="hover:shadow-md transition-all duration-200 border-slate-100 overflow-hidden cursor-pointer"
                            onClick={() => {
                              setSelectedCitaDetail(appointment);
                              setCitaDetailType("consulta");
                              setIsCitaDetailOpen(true);
                            }}
                          >
                            <div className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", style.bg)}>
                                  <Calendar className={cn("h-5 w-5", style.text)} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-700">{appointment.tipo_consulta}</h3>
                                    {getStatusBadge(appointment.estado)}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                      {fecha.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                    <span className="text-[11px] text-muted-foreground">·</span>
                                    <span className="text-[11px] text-muted-foreground">{appointment.hora}</span>
                                    <span className="text-[11px] text-muted-foreground">·</span>
                                    <span className="text-[11px] text-muted-foreground">{appointment.duracion} min</span>
                                  </div>
                                </div>
                              </div>
                              {appointment.costo && appointment.costo > 0 && (
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Costo</p>
                                  <p className="text-sm font-bold text-primary">{formatCurrency(appointment.costo)}</p>
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {viewMode === "tratamientos" && (
                <>
                  {loadingTreatments ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Cargando tratamientos...</p>
                    </div>
                  ) : treatments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                      <Stethoscope className="h-12 w-12 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">No hay tratamientos registrados</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Los planes de tratamiento aparecerán aquí
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {treatments.map((treatment) => {
                        const isExpanded = expandedTreatments.has(treatment.id!);
                        return (
                          <Card key={treatment.id} className="hover:shadow-md transition-all duration-200 border-slate-100 overflow-hidden">
                            <div
                              className={cn(
                                "p-4 cursor-pointer transition-colors flex items-center justify-between",
                                isExpanded ? "bg-white border-b" : "hover:bg-white"
                              )}
                              onClick={() => toggleTreatmentExpansion(treatment.id!)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                  isExpanded ? "bg-primary text-white" : "bg-primary/10 text-primary"
                                )}>
                                  <Stethoscope className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-slate-700">{treatment.tratamiento}</h3>
                                    {getTreatmentStatusBadge(treatment.estado)}
                                    {treatment.pagado && (
                                      <Badge variant="default" className="bg-green-600 h-5 px-1.5 text-[10px]">
                                        Pagado
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground font-medium">
                                    {treatment.fecha_creacion.toLocaleDateString('es-PE', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
                                  <p className="text-sm font-bold text-primary">
                                    {formatCurrency(treatment.total_presupuesto)}
                                  </p>
                                </div>
                                <div className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {isExpanded && (
                              <CardContent className="p-6 space-y-6 bg-white animate-in fade-in slide-in-from-top-2 duration-200">
                                {/* Diagnóstico */}
                                <div className="space-y-2">
                                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Diagnóstico
                                  </h4>
                                  <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                                    {treatment.diagnostico}
                                  </div>
                                </div>

                                {/* Citas */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Citas del tratamiento
                                  </h4>
                                  {(() => {
                                    const citasIdsSet = new Set(treatment.citas || []);
                                    const citasDelTratamiento = appointments.filter(apt =>
                                      citasIdsSet.has(apt.id) || apt.tratamiento_id === treatment.id
                                    );

                                    if (citasDelTratamiento.length === 0) {
                                      return (
                                        <p className="text-xs text-muted-foreground italic pl-1">
                                          No hay citas registradas
                                        </p>
                                      );
                                    }

                                    return (
                                      <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50/50 px-4 py-2 grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b">
                                          <div className="col-span-1">N°</div>
                                          <div className="col-span-4">Fecha</div>
                                          <div className="col-span-3">Atendido por</div>
                                          <div className="col-span-2">Duración</div>
                                          <div className="col-span-2 text-right">Acción</div>
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                          {citasDelTratamiento.map((cita: any, idx: number) => {
                                            const fechaCita = cita.fecha instanceof Date ? cita.fecha : new Date(cita.fecha);
                                            return (
                                              <div key={cita.id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/30 transition-colors">
                                                <div className="col-span-1 text-xs font-bold text-slate-400">{idx + 1}</div>
                                                <div className="col-span-4">
                                                  <p className="text-xs font-bold text-slate-700">
                                                    {fechaCita.toLocaleDateString('es-PE', {
                                                      day: '2-digit', month: 'short', year: 'numeric'
                                                    })}
                                                  </p>
                                                  <p className="text-[10px] text-muted-foreground">{cita.hora}</p>
                                                </div>
                                                <div className="col-span-3 text-xs text-slate-600 truncate">
                                                  {cita.atendido_por || "—"}
                                                </div>
                                                <div className="col-span-2 text-xs text-slate-600">
                                                  {cita.duracion ? `${cita.duracion}m` : "—"}
                                                </div>
                                                <div className="col-span-2 text-right">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-[10px] text-primary hover:text-primary hover:bg-primary/5"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSelectedCitaDetail(cita);
                                                      setIsCitaDetailOpen(true);
                                                    }}
                                                  >
                                                    <Eye className="h-3 w-3 mr-1" />
                                                    Detalle
                                                  </Button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Presupuesto Detallado */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Presupuesto Detallado
                                  </h4>
                                  <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <div className="bg-slate-50/50 px-4 py-2 grid grid-cols-12 gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b">
                                      <div className="col-span-1 tracking-tighter">Cant.</div>
                                      <div className="col-span-7">Descripción</div>
                                      <div className="col-span-2 text-right">Unit.</div>
                                      <div className="col-span-2 text-right">Total</div>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                      {treatment.presupuesto.map((item, idx) => (
                                        <div key={idx}>
                                          <div className="px-4 py-3 grid grid-cols-12 gap-4 items-center">
                                            <div className="col-span-1 text-xs font-bold text-slate-400">{item.cantidad}</div>
                                            <div className="col-span-7 text-xs font-medium text-slate-700">{item.descripcion}</div>
                                            <div className="col-span-2 text-right text-[11px] text-slate-500">
                                              {item.subitems && item.subitems.length > 0 ? "-" : formatCurrency(item.precio_unitario)}
                                            </div>
                                            <div className="col-span-2 text-right text-xs font-bold text-slate-700">
                                              {formatCurrency(
                                                item.subitems && item.subitems.length > 0
                                                  ? item.subitems.reduce((sum: number, sub: any) => sum + (sub.cantidad * sub.precio_unitario), 0)
                                                  : item.cantidad * item.precio_unitario
                                              )}
                                            </div>
                                          </div>
                                          {item.subitems?.map((subitem: any, subIdx: number) => (
                                            <div key={subIdx} className="px-4 py-2 grid grid-cols-12 gap-4 bg-slate-50/50 items-center">
                                              <div className="col-span-1 text-[11px] text-slate-400 pl-2">{subitem.cantidad}</div>
                                              <div className="col-span-7 text-[11px] text-slate-500 pl-2">↳ {subitem.descripcion}</div>
                                              <div className="col-span-2 text-right text-[10px] text-slate-400">
                                                {formatCurrency(subitem.precio_unitario)}
                                              </div>
                                              <div className="col-span-2 text-right text-[11px] font-medium text-slate-500">
                                                {formatCurrency(subitem.cantidad * subitem.precio_unitario)}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="bg-slate-50 border-t-2 border-slate-200 px-4 py-3 grid grid-cols-12 gap-4 items-center">
                                      <div className="col-span-1" />
                                      <div className="col-span-7 text-xs font-bold text-slate-600 uppercase tracking-wider">Total</div>
                                      <div className="col-span-2" />
                                      <div className="col-span-2 text-right text-xs font-bold text-slate-800">
                                        {formatCurrency(treatment.total_presupuesto)}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Cronograma de Pagos */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    Cronograma de Pagos
                                  </h4>
                                  {treatment.cronograma_pagos && treatment.cronograma_pagos.length > 0 ? (
                                    <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-inner bg-slate-50/30">
                                      <div className="bg-slate-50/50 px-4 py-2 grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b">
                                        <div className="col-span-1">N°</div>
                                        <div className="col-span-8 text-right">Monto</div>
                                        <div className="col-span-3 text-right pr-2">Estado</div>
                                      </div>

                                      <div className="bg-white/40 divide-y divide-slate-100">
                                        {treatment.cronograma_pagos.map((cuota, i) => (
                                          <div key={i} className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/30 transition-colors">
                                            <div className="col-span-1 text-xs font-bold text-slate-400">
                                              {cuota.numero === 0 ? "★" : cuota.numero}
                                            </div>
                                            <div className="col-span-8 text-right text-xs font-bold text-slate-700">
                                              {formatCurrency(cuota.monto)}
                                            </div>
                                            <div className="col-span-3 flex justify-end">
                                              <Badge
                                                variant="secondary"
                                                className={cn(
                                                  "text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider",
                                                  cuota.estado === "pagado"
                                                    ? "bg-green-50 text-green-600 border-green-100"
                                                    : "bg-amber-50 text-amber-600 border-amber-100"
                                                )}
                                              >
                                                {cuota.estado}
                                              </Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                                      <p className="text-xs text-muted-foreground italic mb-3">No se ha definido un cronograma de pagos</p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-[11px]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTreatment(treatment);
                                          setIsEditTreatmentDialogOpen(true);
                                        }}
                                      >
                                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                                        Definir Cronograma
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Acciones del tratamiento */}
                                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px] border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTreatmentToDelete(treatment.id);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                    Eliminar
                                  </Button>

                                  {treatment.estado !== "cancelado" && treatment.estado !== "cancelada" && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 text-[11px] border-slate-200 text-slate-500 hover:bg-slate-50"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Activity className="h-3.5 w-3.5 mr-1.5" />
                                          Cambiar estado
                                          <ChevronDown className="h-3 w-3 ml-1.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        {treatment.estado === "pausada" || treatment.estado === "pausado" ? (
                                          <DropdownMenuItem
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await updateTreatment(treatment.id!, {
                                                  ...treatment,
                                                  estado: "activo",
                                                  monto_abonado: treatment.monto_abonado || 0,
                                                  total_presupuesto: treatment.total_presupuesto || 0,
                                                  cantidad_citas_planificadas: treatment.cantidad_citas_planificadas || 0,
                                                  presupuesto: treatment.presupuesto || [],
                                                  diagnostico: treatment.diagnostico || "",
                                                  tratamiento: treatment.tratamiento || ""
                                                } as any);
                                                toast({ title: "Estado actualizado", description: "Tratamiento activado" });
                                                fetchTreatments();
                                              } catch (error) {
                                                toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
                                              }
                                            }}
                                          >
                                            Activar
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                await updateTreatment(treatment.id!, {
                                                  ...treatment,
                                                  estado: "pausado",
                                                  monto_abonado: treatment.monto_abonado || 0,
                                                  total_presupuesto: treatment.total_presupuesto || 0,
                                                  cantidad_citas_planificadas: treatment.cantidad_citas_planificadas || 0,
                                                  presupuesto: treatment.presupuesto || [],
                                                  diagnostico: treatment.diagnostico || "",
                                                  tratamiento: treatment.tratamiento || ""
                                                } as any);
                                                toast({ title: "Estado actualizado", description: "Tratamiento pausado" });
                                                fetchTreatments();
                                              } catch (error) {
                                                toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
                                              }
                                            }}
                                          >
                                            Pausado
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          className="text-red-500 focus:text-red-600"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTreatmentToCancel(treatment);
                                            setIsCancelDialogOpen(true);
                                          }}
                                        >
                                          Cancelado
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}

                                  <Button
                                    size="sm"
                                    className="h-8 text-[11px] bg-[#00665a] hover:bg-[#004d44]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTreatment(treatment);
                                      setIsEditTreatmentDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                                    Editar
                                  </Button>
                                </div>
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  const PatientHeader = () => {
    const optionalFields = [
      patient!.email,
      patient!.celular,
      patient!.direccion,
      patient!.distrito_direccion,
      patient!.lugar_procedencia,
      patient!.estado_civil,
      patient!.ocupacion,
      patient!.sexo,
      patient!.fecha_nacimiento,
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
      <div className="p-0">
        <div>
          <Link to="/pacientes">
            <Button variant="ghost" size="sm" className="-ml-2 h-7 text-[10px] text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-wider">
              <ArrowLeft className="h-3 w-3 mr-1" />
              Volver
            </Button>
          </Link>
        </div>

        <Separator className="my-6" />

        <div className="md:w-[80%] mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b border-slate-50 pb-0">
            <div className="flex items-center gap-5 min-w-0">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-inner">
                <span className="text-2xl font-bold text-primary">
                  {patient!.initials}
                </span>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-3xl font-bold text-foreground leading-tight m-0">
                    {patient!.fullName}
                  </h1>
                  {isComplete && (
                    <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs">
                      Perfil completo
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    DNI: {patient!.dni_cliente}
                  </span>
                  {patient!.age && (
                    <span className="text-sm text-muted-foreground">
                      {patient!.age} años
                    </span>
                  )}
                </div>

                {(patient!.celular || patient!.ocupacion) && (
                  <div className="flex flex-wrap items-center gap-3">
                    {patient!.celular && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {patient!.celular}
                        </span>
                      </div>
                    )}
                    {patient!.ocupacion && (
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {patient!.ocupacion}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-background rounded-3xl overflow-hidden">
        {PatientHeader()}

        <Separator className="my-6" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="general">Información General</TabsTrigger>
            <TabsTrigger value="movimientos">Historial</TabsTrigger>
            <TabsTrigger value="treatments">Tratamientos</TabsTrigger>
            <TabsTrigger value="financial">Finanzas</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {GeneralTab()}
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
            {TreatmentsTab()}
          </TabsContent>

          <TabsContent value="financial">
            {FinancialTab()}
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
        description="Esta acción eliminará permanentemente el tratamiento y todos sus datos relacionados. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={isDeleting}
      />
      <ConfirmationDialog
        open={isCancelDialogOpen}
        onOpenChange={(open) => {
          setIsCancelDialogOpen(open);
          if (!open) {
            setTreatmentToCancel(null);
          }
        }}
        onConfirm={handleCancelTreatment}
        title="¿Cancelar tratamiento?"
        description="Esta acción es irreversible. Una vez cancelado, el tratamiento no podrá volver a activarse."
        confirmText="Confirmar Cancelación"
        cancelText="Volver"
        variant="destructive"
        loading={isCancelling}
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
          fetchPagos();
          fetchPatient();
        }}
        preselectedPatientId={patient?.id}
        preselectedPatientName={patient?.fullName}
        preselectedType={selectedPaymentType}
        preselectedReferenceId={selectedPaymentReferenceId}
      />

      {/* Modal de detalle de cita de tratamiento */}
      <Dialog open={isCitaDetailOpen} onOpenChange={setIsCitaDetailOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {selectedCitaDetail && (() => {
            const cita = selectedCitaDetail;
            const fechaCita = cita.fecha instanceof Date ? cita.fecha : new Date(cita.fecha);
            const estadoNorm = cita.estado?.toLowerCase() || '';
            const isAtendida = estadoNorm === 'atendida' || estadoNorm === 'completada';
            const creadoPor = cita.historial_estados?.[0]?.realizado_por;
            return (
              <div className="flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 flex-shrink-0">
                  <DialogTitle className="text-xl font-semibold">
                    {citaDetailType === "consulta" ? "Detalle de Consulta" : "Detalle de Cita"}
                  </DialogTitle>
                  <div className="mt-1">{getStatusBadge(cita.estado)}</div>
                </div>

                {/* Contenido */}
                <div className="overflow-y-auto min-h-0 px-6 pb-6">
                  <div className="space-y-3">

                    {/* Fecha y Hora */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Fecha</p>
                          <p className="text-sm font-semibold">
                            {fechaCita.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Hora</p>
                          <p className="text-sm font-semibold">{cita.hora}</p>
                        </div>
                      </div>
                    </div>

                    {/* Celular y Consulta/Tratamiento */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Celular</p>
                          <p className="text-sm font-semibold">{patient?.celular || "No registrado"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <Stethoscope className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {cita.es_tratamiento ? "Tratamiento" : "Consulta"}
                          </p>
                          <p className="text-sm font-semibold">
                            {cita.es_tratamiento ? (cita.tratamiento_nombre || cita.tipo_consulta) : cita.tipo_consulta}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Duración estimada y Creado por */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                        <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Duración estimada</p>
                          <p className="text-sm font-semibold">{cita.duracion ? `${cita.duracion} min` : "No registrado"}</p>
                        </div>
                      </div>
                      {creadoPor && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                          <User className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Creado por</p>
                            <p className="text-sm font-semibold">{creadoPor}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notas generales */}
                    {cita.notas_observaciones && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Notas</p>
                          <p className="text-sm font-semibold whitespace-pre-line mt-0.5">{cita.notas_observaciones}</p>
                        </div>
                      </div>
                    )}

                    {/* Sección de atención */}
                    {isAtendida && (
                      <div className="border-t pt-3 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5" />
                          Información de atención
                        </p>

                        {/* Personal */}
                        {cita.personal_consulta && cita.personal_consulta.length > 0 ? (
                          <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                            <Users className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground mb-1.5">Personal</p>
                              <div className="space-y-1">
                                {cita.personal_consulta.map((p: any, i: number) => (
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
                              <p className="text-sm font-semibold">{cita.atendido_por || "No registrado"}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                          <Timer className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Duración real</p>
                            <p className="text-sm font-semibold">
                              {cita.duracion_real && cita.duracion_real !== "0"
                                ? `${cita.duracion_real} min`
                                : "No registrada"}
                            </p>
                          </div>
                        </div>

                        {cita.notas_atencion && (
                          <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                            <FileText className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Notas de cita</p>
                              <p className="text-sm font-semibold whitespace-pre-line mt-0.5">{cita.notas_atencion}</p>
                            </div>
                          </div>
                        )}

                        {cita.planificacion_siguiente_cita && (
                          <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                            <CalendarPlus className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs text-muted-foreground">Planificación siguiente cita</p>
                              <p className="text-sm font-semibold whitespace-pre-line mt-0.5">{cita.planificacion_siguiente_cita}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}