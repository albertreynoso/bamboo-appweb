import { useParams, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  Edit,
  ArrowLeft,
  Calendar,
  User,
  Briefcase,
  Home,
  Clock,
  DollarSign,
  Loader2,
  CreditCard,
  Hash,
  Save,
  CalendarClock,
  Sun,
  Sunset,
  ChevronDown,
  Plus,
  ImageIcon,
  Trash2,
  ExternalLink,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import EmployeeEditDialog from "@/components/employees/EmployeeEditDialog";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";
import { useActivityLog } from "@/hooks/useActivityLog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HorarioSemanal, { HORARIO_VACIO } from "@/components/employees/HorarioSemanal";
import DocumentoUploadDialog from "@/components/employees/DocumentoUploadDialog";
import {
  suscribirDocumentos,
  eliminarDocumento,
  EmpleadoDocumento,
} from "@/services/documentosService";
import { toast } from "@/hooks/use-toast";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, getRoleFromType, HorarioValue } from "@/types/employee";

interface EmployeeWithStats extends Employee {
  fullName: string;
  initials: string;
}

const ROLE_COLORS: Record<string, string> = {
  "Odontólogo": "bg-blue-50 text-blue-700 ring-1 ring-blue-200/80",
  "Asistente": "bg-violet-50 text-violet-700 ring-1 ring-violet-200/80",
  "Recepcionista": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80",
  "Administrativo": "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80",
  "Personal de servicio": "bg-slate-50 text-slate-700 ring-1 ring-slate-200/80",
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatSalary(salary?: number): string {
  if (salary == null) return "—";
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(salary);
}

export default function EmpleadoDetalle() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "general";
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  const [employee, setEmployee] = useState<EmployeeWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { log } = useActivityLog();
  const [horario, setHorario] = useState<HorarioValue>(HORARIO_VACIO);
  const [horarioOriginal, setHorarioOriginal] = useState<HorarioValue>(HORARIO_VACIO);
  const [savingHorario, setSavingHorario] = useState(false);
  const [documentos, setDocumentos] = useState<EmpleadoDocumento[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const fetchEmployee = async () => {
    if (!id) {
      setError("ID de empleado no válido");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const snap = await getDoc(doc(db, "personal", id));
      if (!snap.exists()) {
        setError("Empleado no encontrado");
        setLoading(false);
        return;
      }
      const data = snap.data() as Employee;
      const fullName = `${data.nombre} ${data.apellido_paterno} ${data.apellido_materno}`.trim();
      const initials = `${data.nombre?.[0] || ""}${data.apellido_paterno?.[0] || ""}`.toUpperCase();
      setEmployee({ ...data, id: snap.id, fullName, initials });
      const h = { ...HORARIO_VACIO, ...(data.horario ?? {}) };
      setHorario(h);
      setHorarioOriginal(h);
    } catch (err) {
      console.error("Error al obtener empleado:", err);
      setError("Error al cargar los datos del empleado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const handleDeleteEmployee = async () => {
    if (!employee?.id) return;
    setDeleting(true);
    try {
      const { deleteEmployee } = await import("@/services/employeeService");
      await deleteEmployee(employee.id);
      toast({ title: "Empleado eliminado", description: `${employee.fullName} ha sido eliminado correctamente.` });
      log({ modulo: "Empleados", accion: "eliminó", entidad: "empleado", entidad_id: employee.id, entidad_nombre: employee.fullName });
      window.history.back();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el empleado.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    const unsub = suscribirDocumentos(id, setDocumentos);
    return unsub;
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando información del empleado...</p>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Error</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || "No se pudo cargar la información del empleado"}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/empleados">Volver a Empleados</Link>
                </Button>
                <Button size="sm" onClick={fetchEmployee}>Reintentar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleClass = ROLE_COLORS[employee.tipo_empleado_id] ?? "bg-muted text-muted-foreground ring-1 ring-border";

  /* ── Header ── */
  const EmployeeHeader = () => (
    <div className="p-0">
      <div>
        <Link to="/empleados">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-[10px] text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-wider"
          >
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
              <span className="text-2xl font-bold text-primary">{employee.initials}</span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-3xl font-bold text-foreground leading-tight m-0">
                  {employee.fullName}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
                    roleClass
                  )}
                >
                  {getRoleFromType(employee.tipo_empleado_id)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold",
                    employee.activo ? "text-emerald-600" : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      employee.activo ? "bg-emerald-500" : "bg-muted-foreground"
                    )}
                  />
                  {employee.activo ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">DNI: {employee.dni_empleado}</span>
                {employee.edad && (
                  <span className="text-sm text-muted-foreground">{employee.edad} años</span>
                )}
              </div>

              {employee.numero_telefonico && (
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{employee.numero_telefonico}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
            >
              <Edit className="h-4 w-4 mr-2 shrink-0" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="h-4 w-4 mr-2 shrink-0" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Tab: Información Personal ── */
  const GeneralTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Contacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Información de Contacto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {employee.numero_telefonico ? (
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Teléfono</p>
                <p className="text-sm font-medium">{employee.numero_telefonico}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay información de contacto registrada</p>
          )}
        </CardContent>
      </Card>

      {/* Dirección */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Dirección
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {employee.direccion ? (
            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Dirección</p>
                <p className="text-sm font-medium">{employee.direccion}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay dirección registrada</p>
          )}
        </CardContent>
      </Card>

      {/* Datos Personales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {employee.fecha_nacimiento && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Fecha de Nacimiento</p>
                <p className="text-sm font-medium">{formatDate(employee.fecha_nacimiento)}</p>
              </div>
            </div>
          )}
          {employee.genero && (
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Género</p>
                <p className="text-sm font-medium">{employee.genero}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">DNI</p>
                <p className="text-sm font-medium">{employee.dni_empleado || "—"}</p>
              </div>
            </div>
            {employee.edad && (
              <div className="flex items-start gap-3">
                <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Edad</p>
                  <p className="text-sm font-medium">{employee.edad} años</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información Laboral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Información Laboral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Cargo</p>
              <p className="text-sm font-medium">{getRoleFromType(employee.tipo_empleado_id) || "—"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Fecha de Contratación</p>
              <p className="text-sm font-medium">{formatDate(employee.fecha_contratacion)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Salario</p>
              <p className="text-sm font-medium">{formatSalary(employee.salario)}</p>
            </div>
          </div>
          {employee.notas && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm font-medium whitespace-pre-line">{employee.notas}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  /* ── Tab: Horario ── */
  const DIAS_LABORALES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;

  const aplicarPreset = (preset: "mañana" | "tarde" | "completo") => {
    setHorario((prev) => {
      const next = { ...prev };
      DIAS_LABORALES.forEach((dia) => {
        next[dia] = {
          mañana: preset === "mañana" || preset === "completo",
          tarde:  preset === "tarde"  || preset === "completo",
        };
      });
      return next;
    });
  };

  const horarioCambiado = JSON.stringify(horario) !== JSON.stringify(horarioOriginal);

  const saveHorario = async () => {
    if (!employee?.id) return;
    setSavingHorario(true);
    try {
      await updateDoc(doc(db, "personal", employee.id), { horario });
      setHorarioOriginal({ ...horario });
      toast({ title: "Horario guardado", description: "Los turnos han sido actualizados correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el horario.", variant: "destructive" });
    } finally {
      setSavingHorario(false);
    }
  };

  const HorarioTab = () => (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="h-5 w-5" />
            Turnos semanales
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Selecciona los turnos activos para cada día de la semana.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 h-8 shrink-0"
          disabled={!horarioCambiado || savingHorario}
          onClick={saveHorario}
        >
          {savingHorario ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {savingHorario ? "Guardando..." : "Guardar"}
        </Button>
      </CardHeader>
      <CardContent className="pt-5">
        {/* Presets — esquina superior izquierda */}
        <div className="flex items-center gap-2 mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                Aplicar a todos
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Selección rápida
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => aplicarPreset("mañana")} className="gap-2 text-sm cursor-pointer">
                <Sun className="h-4 w-4 text-amber-500" />
                Turno mañana
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => aplicarPreset("tarde")} className="gap-2 text-sm cursor-pointer">
                <Sunset className="h-4 w-4 text-orange-500" />
                Turno tarde
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => aplicarPreset("completo")} className="gap-2 text-sm cursor-pointer">
                <CalendarClock className="h-4 w-4 text-primary" />
                Horario completo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <HorarioSemanal value={horario} onChange={setHorario} />
        {horarioCambiado && (
          <p className="text-xs text-amber-600 font-medium mt-4 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Hay cambios sin guardar
          </p>
        )}
      </CardContent>
    </Card>
  );

  /* ── Tab: Documentos ── */
  const handleDeleteDocumento = async (doc: EmpleadoDocumento) => {
    if (!employee?.id || !doc.id) return;
    setDeletingDocId(doc.id);
    try {
      await eliminarDocumento(employee.id, doc);
      toast({ title: "Documento eliminado" });
      log({ modulo: "Documentos", accion: "eliminó", entidad: "documento", entidad_nombre: doc.titulo, entidad_id: doc.id });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el documento.", variant: "destructive" });
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const DocumentosTab = () => (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-5 w-5" />
            Documentos del empleado
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Adjunta contratos, certificados u otros archivos del empleado.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 h-8 shrink-0"
          onClick={() => setIsUploadDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir documento
        </Button>
      </CardHeader>

      <CardContent className="pt-5">
        {/* Lista vacía */}
        {documentos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="p-4 rounded-2xl bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Sin documentos adjuntos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Sube contratos, certificados u otros archivos del empleado
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsUploadDialogOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Añadir primer documento
            </Button>
          </div>
        )}

        {/* Grid de documentos */}
        {documentos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {documentos.map((documento) => {
              const esPDF = documento.archivo_tipo === "pdf";
              const isDeleting = deletingDocId === documento.id;

              return (
                <div
                  key={documento.id}
                  className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden flex flex-col"
                >
                  {documento.archivo_tipo === "imagen" ? (
                    <div className="h-32 bg-muted overflow-hidden">
                      <img
                        src={documento.archivo_url}
                        alt={documento.titulo}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-32 bg-red-50 flex flex-col items-center justify-center gap-1.5">
                      <FileText className="h-8 w-8 text-red-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">PDF</span>
                    </div>
                  )}

                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
                      {documento.titulo}
                    </p>
                    {documento.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                        {documento.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-auto pt-2">
                      {esPDF
                        ? <FileText className="h-3 w-3 text-red-400 shrink-0" />
                        : <ImageIcon className="h-3 w-3 text-blue-400 shrink-0" />
                      }
                      <span className="text-[10px] text-muted-foreground truncate">
                        {documento.archivo_nombre}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {formatSize(documento.tamaño)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">
                      {documento.fecha_subida.toLocaleDateString("es-PE", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center border-t border-border/40 divide-x divide-border/40">
                    <a
                      href={documento.archivo_url.replace("/upload/", "/upload/fl_attachment/")}
                      download={documento.archivo_nombre}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </a>
                    <a
                      href={documento.archivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver
                    </a>
                    <button
                      onClick={() => handleDeleteDocumento(documento)}
                      disabled={isDeleting}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
                    >
                      {isDeleting
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                      {isDeleting ? "Eliminando..." : "Eliminar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="bg-background rounded-3xl overflow-hidden">
        {EmployeeHeader()}

        <Separator className="my-6" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="general">Información Personal</TabsTrigger>
            <TabsTrigger value="horario">Horario</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {GeneralTab()}
          </TabsContent>

          <TabsContent value="horario">
            {HorarioTab()}
          </TabsContent>

          <TabsContent value="documentos">
            {DocumentosTab()}
          </TabsContent>
        </Tabs>
      </div>

      <EmployeeEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        employee={employee}
        onSuccess={fetchEmployee}
      />

      {employee?.id && (
        <DocumentoUploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          empleadoId={employee.id}
          onSuccess={() => {}}
        />
      )}

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Eliminar empleado"
        description={`¿Estás seguro de que deseas eliminar a ${employee?.fullName}? Esta acción no se puede deshacer.`}
        confirmText={deleting ? "Eliminando..." : "Eliminar"}
        onConfirm={handleDeleteEmployee}
        variant="destructive"
      />
    </div>
  );
}
