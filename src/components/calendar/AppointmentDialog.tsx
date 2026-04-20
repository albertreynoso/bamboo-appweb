import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Clock, Search, UserPlus, Loader2, AlertCircle, X, User, ClipboardList, Package } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuthContext } from "@/context/AuthContext";
import { formatNotes, handleNotesKeyDown } from "@/utils/formatters";

import {
    createAppointment,
    getAllAppointments
} from "@/services/appointmentService";
import {
    createPatient,
    getAllPatients,
    findPatientByDNI,
} from "@/services/patientService";
import { Patient } from "@/types/appointment";
import { DURATIONS } from "@/constants/appointmentConstants";
import { useConsultationPrices } from "@/hooks/useConsultationPrices";
import { capitalizeName } from "@/utils/formatters";
import { useActivityLog } from "@/hooks/useActivityLog";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";



// 📋 SCHEMA DE VALIDACIÓN
const appointmentFormSchema = z.object({
    date: z.date({
        required_error: "La fecha es requerida",
    }),
    time: z.string().min(1, "La hora es requerida"),
    patientId: z.string().optional(),
    patientName: z.string().min(1, "El nombre del paciente es requerido"),
    isNewPatient: z.boolean().default(false),
    newPatientDni: z.string().optional(),
    newPatientPhone: z.string().optional(),
    newPatientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
    consultation: z.string().optional(),
    duration: z.string().min(1, "Debe seleccionar una duración"),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.isNewPatient) {
        if (!data.newPatientDni || !/^[1-9][0-9]{7}$/.test(data.newPatientDni)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Ingresar un DNI válido",
                path: ["newPatientDni"],
            });
        }
        if (!data.newPatientPhone || !/^9[0-9]{8}$/.test(data.newPatientPhone)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Ingresar un número de celular válido",
                path: ["newPatientPhone"],
            });
        }
    }
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

interface AppointmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedDate?: Date;
    selectedTime?: string;
    onSuccess?: () => void;
}

export default function AppointmentDialog({
    open,
    onOpenChange,
    selectedDate,
    selectedTime,
    onSuccess,
}: AppointmentDialogProps) {
    const { prices: consultationTypes, getCostByType } = useConsultationPrices();
    const { user, userProfile } = useAuthContext();
    const userName = userProfile
        ? `${userProfile.nombre.split(' ')[0]} ${userProfile.apellidoPaterno}`
        : user?.displayName || "Sistema";
    // Estados
    const [searchPatient, setSearchPatient] = useState("");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const { log } = useActivityLog();
    const [loadingPatients, setLoadingPatients] = useState(false);
    const [displayMonth, setDisplayMonth] = useState<Date>(selectedDate || new Date());
    const [appointments, setAppointments] = useState<any[]>([]);
    const [validacion, setValidacion] = useState<{ disponible: boolean; mensaje: string }>({
        disponible: true,
        mensaje: ''
    });
    const [activeTreatments, setActiveTreatments] = useState<any[]>([]);
    const [loadingTreatments, setLoadingTreatments] = useState(false);
    const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);

    // Form setup
    const form = useForm<AppointmentFormValues>({
        resolver: zodResolver(appointmentFormSchema),
        defaultValues: {
            date: selectedDate || new Date(),
            time: selectedTime || "",
            patientId: "",
            patientName: "",
            isNewPatient: false,
            newPatientDni: "",
            newPatientPhone: "",
            newPatientEmail: "",
            consultation: "",
            duration: "30",
            notes: "",
        },
    });

    useEffect(() => {
        if (open) {
            form.setValue("date", selectedDate || new Date());
            form.setValue("time", selectedTime || "");
        }
    }, [open, selectedDate, selectedTime, form]);

    // Watch para modo nuevo paciente
    const isNewPatient = form.watch("isNewPatient");
    const watchedDate = form.watch("date");
    const watchedTime = form.watch("time");
    const watchedDuration = form.watch("duration");
    const watchedPatientId = form.watch("patientId");

    // Cargar tratamientos activos cuando se selecciona un paciente
    useEffect(() => {
        if (watchedPatientId && !isNewPatient) {
            loadActiveTreatments(watchedPatientId);
        } else {
            setActiveTreatments([]);
        }
    }, [watchedPatientId, isNewPatient]);

    // ==================== CARGAR PACIENTES Y CITAS ====================
    useEffect(() => {
        if (open) {
            loadPatients();
            loadAppointments();
        }
    }, [open]);

    const loadPatients = async () => {
        setLoadingPatients(true);
        try {
            const patientsData = await getAllPatients();
            setPatients(patientsData || []);
        } catch (error) {
            console.error("Error al cargar pacientes:", error);
            setPatients([]);
            toast({
                title: "⚠️ Advertencia",
                description: "No se pudieron cargar los pacientes.",
                variant: "destructive",
            });
        } finally {
            setLoadingPatients(false);
        }
    };

    const loadAppointments = async () => {
        try {
            const appointmentsData = await getAllAppointments();
            setAppointments(appointmentsData || []);
        } catch (error) {
            console.error("Error al cargar citas:", error);
            setAppointments([]);
        }
    };

    // Cargar tratamientos activos del paciente seleccionado
    const loadActiveTreatments = async (patientId: string) => {
        if (!patientId) {
            setActiveTreatments([]);
            return;
        }

        try {
            setLoadingTreatments(true);
            const treatmentsRef = collection(db, "tratamientos");
            const q = query(
                treatmentsRef,
                where("paciente_id", "==", patientId),
                where("estado", "==", "activo")
            );
            const querySnapshot = await getDocs(q);

            const treatmentsData: any[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                treatmentsData.push({
                    id: doc.id,
                    tratamiento: data.tratamiento || "",
                    pago_pendiente: data.pago_pendiente || 0,
                    total_presupuesto: data.total_presupuesto || 0,
                    monto_abonado: data.monto_abonado || 0,
                });
            });

            setActiveTreatments(treatmentsData);
        } catch (error) {
            console.error("Error al cargar tratamientos:", error);
            setActiveTreatments([]);
        } finally {
            setLoadingTreatments(false);
        }
    };

    // ==================== FUNCIÓN DE VALIDACIÓN DE DISPONIBILIDAD ROBUSTA ====================
    const validarDisponibilidadHorario = useCallback((fecha: Date, hora: string): { disponible: boolean; mensaje: string } => {
        if (!fecha || !hora || !appointments || appointments.length === 0) {
            return { disponible: true, mensaje: '' };
        }

        try {
            // Obtener duración seleccionada (con fallback a 30 min)
            const duracionSeleccionada = parseInt(watchedDuration || '30');

            // Convertir hora a minutos desde medianoche
            const horaInicio = (parseInt(hora.split(':')[0]) * 60) + parseInt(hora.split(':')[1] || '0');
            const horaFin = horaInicio + duracionSeleccionada;

            // Filtrar todas las citas del día seleccionado (excluyendo canceladas)
            const citasDelDia = appointments.filter(apt => {
                try {
                    if (!apt.fecha) return false;

                    // Excluir citas canceladas
                    const status = apt.estado?.toLowerCase() || '';
                    if (status === 'cancelada' || status === 'cancelled') return false;

                    let fechaCita: Date;
                    if (typeof apt.fecha.toDate === 'function') {
                        fechaCita = apt.fecha.toDate();
                    } else if (apt.fecha instanceof Date) {
                        fechaCita = apt.fecha;
                    } else {
                        return false;
                    }

                    return isSameDay(fechaCita, fecha);
                } catch {
                    return false;
                }
            });

            // ══════════════════════════════════════════════════════════
            // VALIDACIÓN POR INTERVALOS DE 30 MINUTOS
            // ══════════════════════════════════════════════════════════

            const intervalosConflictivos: string[] = [];

            // Validar cada intervalo de 30 minutos que cubre la nueva cita
            for (let minuto = horaInicio; minuto < horaFin; minuto += 30) {
                const intervaloInicio = minuto;
                const intervaloFin = Math.min(minuto + 30, horaFin);

                // Contar cuántas citas se solapan con este intervalo de 30 min
                const citasEnIntervalo = citasDelDia.filter(apt => {
                    try {
                        if (!apt.hora || !apt.duracion) return false;

                        const aptInicio = (parseInt(apt.hora.split(':')[0]) * 60) + parseInt(apt.hora.split(':')[1] || '0');
                        const aptFin = aptInicio + parseInt(apt.duracion.toString());

                        // La cita se solapa con el intervalo si hay superposición REAL:
                        // - Empieza antes de que termine el intervalo Y
                        // - Termina DESPUÉS (no en el mismo momento) de que empiece el intervalo
                        // Esto excluye citas que solo "tocan" el borde (ej: 8:00-8:30 NO cuenta para 8:30-9:00)
                        return aptInicio < intervaloFin && aptFin > intervaloInicio;
                    } catch {
                        return false;
                    }
                });

                // Si este intervalo ya tiene 4 citas, está lleno
                if (citasEnIntervalo.length >= 4) {
                    const h = Math.floor(minuto / 60);
                    const m = minuto % 60;
                    intervalosConflictivos.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                }
            }

            if (intervalosConflictivos.length > 0) {
                return {
                    disponible: false,
                    mensaje: `No hay disponibilidad para esta cita. Intervalos llenos: ${intervalosConflictivos.join(', ')}`
                };
            }

            return { disponible: true, mensaje: '' };

        } catch (error) {
            console.error("Error en validación de horario:", error);
            return { disponible: true, mensaje: '' };
        }
    }, [appointments, watchedDuration]);

    // ==================== VALIDAR CUANDO CAMBIE FECHA, HORA O DURACIÓN ====================
    useEffect(() => {
        if (watchedDate && watchedTime) {
            const resultado = validarDisponibilidadHorario(watchedDate, watchedTime);
            setValidacion(resultado);
        } else {
            setValidacion({ disponible: true, mensaje: '' });
        }
    }, [watchedDate, watchedTime, watchedDuration, appointments]);

    // Filtrado de pacientes
    const filteredPatients = patients.filter(p => {
        const fullName = `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno}`.toLowerCase();
        return fullName.includes(searchPatient.toLowerCase()) ||
            p.dni_cliente.includes(searchPatient);
    });

    // FUNCIÓN PARA GENERAR HORAS (7 AM - 12 AM / Medianoche)
    const generateTimeSlots = () => {
        const slots = [];
        for (let hour = 7; hour <= 23; hour++) {
            for (let minute = 0; minute < 60; minute += 15) {
                const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                slots.push({ value: timeValue, label: timeValue });
            }
        }

        return slots;
    };

    const timeSlots = generateTimeSlots();

    // ==================== SEPARAR NOMBRE COMPLETO ====================
    const separateFullName = (fullName: string) => {
        const capitalizedName = capitalizeName(fullName);
        const parts = capitalizedName.split(" ");

        if (parts.length === 1) {
            return { nombre: parts[0], apellido_paterno: "", apellido_materno: "" };
        } else if (parts.length === 2) {
            return { nombre: parts[0], apellido_paterno: parts[1], apellido_materno: "" };
        } else if (parts.length === 3) {
            return { nombre: parts[0], apellido_paterno: parts[1], apellido_materno: parts[2] };
        } else {
            const apellido_materno = parts.pop() || "";
            const apellido_paterno = parts.pop() || "";
            const nombre = parts.join(" ");
            return { nombre, apellido_paterno, apellido_materno };
        }
    };

    // ==================== HANDLER DE SUBMIT ====================
    const onSubmit = async (data: AppointmentFormValues) => {
        // Validar que haya tipo de consulta O tratamiento seleccionado
        if (!selectedTreatmentId && !data.consultation) {
            toast({
                title: "⚠️ Información incompleta",
                description: "Debes seleccionar un tipo de consulta o un tratamiento activo.",
                variant: "destructive",
            });
            return;
        }

        // Validar disponibilidad antes de crear
        if (!validacion.disponible) {
            toast({
                title: "⚠️ Horario no disponible",
                description: validacion.mensaje,
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            let patientId = data.patientId;

            // ========== SI ES NUEVO PACIENTE, CREARLO ==========
            if (data.isNewPatient) {
                // Verificar si el DNI ya existe
                const existingPatient = await findPatientByDNI(data.newPatientDni!);

                if (existingPatient) {
                    toast({
                        title: "⚠️ Paciente ya existe",
                        description: "Ya existe un paciente con ese DNI. Se usará el existente.",
                    });
                    patientId = existingPatient.id!;
                } else {
                    // Separar el nombre completo
                    const { nombre, apellido_paterno, apellido_materno } = separateFullName(data.patientName);

                    // Crear nuevo paciente con datos básicos
                    const newPatientData: Omit<Patient, "id" | "fecha_creacion"> = {
                        nombre,
                        apellido_paterno,
                        apellido_materno,
                        dni_cliente: data.newPatientDni!,
                        celular: data.newPatientPhone!,
                        email: data.newPatientEmail || "",
                        // Campos opcionales con valores por defecto vacíos
                        edad: undefined,
                        sexo: "",
                        direccion: "",
                        distrito_direccion: "",
                        estado_civil: "",
                        telefono_fijo: "",
                        ocupacion: "",
                        lugar_procedencia: "",
                        fecha_nacimiento: undefined,
                    };

                    patientId = await createPatient(newPatientData);

                    toast({
                        title: "✅ Paciente creado",
                        description: `Paciente ${data.patientName} creado exitosamente.`,
                    });
                }
            }

            // ========== VERIFICAR QUE TENEMOS UN PACIENTE ID ==========
            if (!patientId) {
                throw new Error("No se pudo obtener el ID del paciente");
            }

            const capitalizedPatientName = capitalizeName(data.patientName);

            // ========== DETERMINAR TIPO Y COSTO ==========
            let tipo_consulta = "";
            let costo = 0;
            let tratamiento_id = "";
            let tratamiento_nombre = "";

            if (selectedTreatmentId) {
                // Cita para tratamiento - tipo_consulta se deja vacío
                const treatment = activeTreatments.find(t => t.id === selectedTreatmentId);
                if (treatment) {
                    tipo_consulta = ""; // Vacío para tratamientos
                    tratamiento_id = treatment.id;
                    tratamiento_nombre = treatment.tratamiento;
                    costo = 0; // El costo está en el presupuesto del tratamiento
                }
            } else {
                // Cita para consulta normal
                tipo_consulta = data.consultation || "";
                costo = getCostByType(data.consultation || "");
            }

            // ========== CREAR LA CITA CON NUEVA ESTRUCTURA ==========
            const appointmentData: any = {
                // Información básica
                fecha: data.date,
                hora: data.time,
                fecha_creacion: new Date(),

                // Información del paciente
                paciente_id: patientId,
                paciente_nombre: capitalizedPatientName,

                // Tipo de cita
                es_tratamiento: !!selectedTreatmentId,
                tipo_consulta: tipo_consulta,

                // Duración y tiempo
                duracion: data.duration,
                duracion_real: "",
                hora_inicio_atencion: "",
                hora_fin_atencion: "",

                // Personal
                atendido_por: "",

                // Estado y pago
                estado: "pendiente" as const,
                costo: costo,
                pagado: false,

                // Notas
                notas_observaciones: data.notes || "",
            };

            // Si es cita de tratamiento, agregar información adicional
            if (selectedTreatmentId) {
                appointmentData.tratamiento_id = tratamiento_id;
                appointmentData.tratamiento_nombre = tratamiento_nombre;
            }

            const appointmentId = await createAppointment(appointmentData, userName);

            // ========== SI ES CITA DE TRATAMIENTO, ACTUALIZAR EL ARRAY DE CITAS ==========
            if (selectedTreatmentId && appointmentId) {
                try {
                    const treatmentRef = doc(db, "tratamientos", selectedTreatmentId);
                    await updateDoc(treatmentRef, {
                        citas: arrayUnion(appointmentId)
                    });
                } catch (updateError) {
                    console.error("Error al actualizar array de citas en tratamiento:", updateError);
                    // No lanzar error, la cita ya se creó exitosamente
                }
            }

            toast({
                title: "✅ Cita creada exitosamente",
                description: selectedTreatmentId
                    ? `Cita para tratamiento "${tratamiento_nombre}" agendada el ${format(data.date, "PPP", { locale: es })} a las ${data.time}.`
                    : `Cita para ${capitalizedPatientName} agendada el ${format(data.date, "PPP", { locale: es })} a las ${data.time}.`,
            });

            log({
                modulo: "Calendario",
                accion: "creó",
                entidad: "cita",
                entidad_id: appointmentId,
                entidad_nombre: selectedTreatmentId
                    ? tratamiento_nombre
                    : "Consulta",
                paciente_nombre: capitalizedPatientName,
            });

            // Reset y cerrar
            form.reset();
            setSearchPatient("");
            setSelectedTreatmentId(null);
            onOpenChange(false);
            onSuccess?.();

        } catch (error: any) {
            console.error("Error completo:", error);
            toast({
                title: "❌ Error",
                description: error.message || "No se pudo crear la cita. Intenta nuevamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 border-none bg-white rounded-3xl overflow-hidden">
                <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white flex-none relative">
                    <DialogTitle className="text-2xl font-semibold text-slate-900">Nueva Cita</DialogTitle>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 rounded-full h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 pt-1 pb-2">
                    <Form {...form}>
                        <form id="appointment-form" autoComplete="off" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            {/* 🗓️ SECCIÓN 1: FECHA Y HORA */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <CalendarIcon className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Fecha y Horario</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Campo de Fecha */}
                                    <FormField
                                        control={form.control}
                                        name="date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Fecha de la Cita *</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant="outline"
                                                                className={cn(
                                                                    "w-full pl-3 text-left font-normal",
                                                                    !field.value && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    format(field.value, "PPP", { locale: es })
                                                                ) : (
                                                                    <span>Selecciona una fecha</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>

                                                    <PopoverContent className="w-auto p-3" align="start">
                                                        <div className="flex justify-between mb-2 gap-2">
                                                            <select
                                                                className="border rounded-md px-2 py-1 text-xs"
                                                                value={displayMonth.getMonth()}
                                                                onChange={(e) =>
                                                                    setDisplayMonth(
                                                                        new Date(displayMonth.getFullYear(), parseInt(e.target.value))
                                                                    )
                                                                }
                                                            >
                                                                {Array.from({ length: 12 }, (_, i) => (
                                                                    <option key={i} value={i}>
                                                                        {format(new Date(0, i), "MMMM", { locale: es })}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            <select
                                                                className="border rounded-md px-2 py-1 text-xs"
                                                                value={displayMonth.getFullYear()}
                                                                onChange={(e) =>
                                                                    setDisplayMonth(
                                                                        new Date(parseInt(e.target.value), displayMonth.getMonth())
                                                                    )
                                                                }
                                                            >
                                                                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + i - 1).map((y) => (
                                                                    <option key={y} value={y}>
                                                                        {y}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value}
                                                            onSelect={(date) => {
                                                                field.onChange(date);
                                                            }}
                                                            month={displayMonth}
                                                            onMonthChange={setDisplayMonth}
                                                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                                            initialFocus
                                                            locale={es}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Campo de Hora */}
                                    <FormField
                                        control={form.control}
                                        name="time"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Hora *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <Clock className="mr-2 h-4 w-4" />
                                                            <SelectValue placeholder="Selecciona una hora" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="max-h-[300px]">
                                                        {timeSlots.map((slot) => (
                                                            <SelectItem key={slot.value} value={slot.value}>
                                                                {slot.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />

                                                {/* MENSAJE DE ERROR DE DISPONIBILIDAD */}
                                                {!validacion.disponible && (
                                                    <div className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-start gap-2">
                                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                        <span>{validacion.mensaje}</span>
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* 👤 SECCIÓN 2: SELECTOR DE PACIENTE */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <User className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Paciente</h3>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="patientName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Paciente *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    {/* Mostrar campo de búsqueda solo si NO hay paciente seleccionado */}
                                                    {!form.watch("patientId") && !isNewPatient && (
                                                        <>
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="Buscar paciente por nombre o DNI..."
                                                                className="pl-10"
                                                                autoComplete="none"
                                                                value={searchPatient}
                                                                onChange={(e) => {
                                                                    setSearchPatient(e.target.value);
                                                                    form.setValue("isNewPatient", false);
                                                                    form.setValue("patientName", "");
                                                                }}
                                                                disabled={loadingPatients}
                                                            />
                                                            {loadingPatients && (
                                                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                                            )}
                                                        </>
                                                    )}

                                                    {/* Mostrar nombre del paciente seleccionado con opción de cambiar */}
                                                    {(form.watch("patientId") || isNewPatient) && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
                                                                <span className="font-medium">{form.watch("patientName")}</span>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    form.setValue("patientId", "");
                                                                    form.setValue("patientName", "");
                                                                    form.setValue("isNewPatient", false);
                                                                    setSearchPatient("");
                                                                }}
                                                            >
                                                                Cambiar
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </FormControl>

                                            {/* Lista de resultados */}
                                            {searchPatient && !loadingPatients && !form.watch("patientId") && !isNewPatient && (
                                                <div className="mt-2 border rounded-md max-h-[200px] overflow-y-auto bg-card">
                                                    {filteredPatients.length > 0 ? (
                                                        <div className="p-1">
                                                            {filteredPatients.map((patient) => (
                                                                <button
                                                                    key={patient.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const capitalizedName = capitalizeName(
                                                                            `${patient.nombre} ${patient.apellido_paterno} ${patient.apellido_materno}`
                                                                        );
                                                                        form.setValue("patientId", patient.id!);
                                                                        form.setValue("patientName", capitalizedName);
                                                                        form.setValue("isNewPatient", false);
                                                                        setSearchPatient(capitalizedName);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-accent rounded-md transition-colors"
                                                                >
                                                                    <div className="font-medium">
                                                                        {capitalizeName(`${patient.nombre} ${patient.apellido_paterno} ${patient.apellido_materno}`)}
                                                                    </div>
                                                                    <div className="text-sm text-muted-foreground">
                                                                        DNI: {patient.dni_cliente}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="p-4 text-center">
                                                            <p className="text-sm text-muted-foreground mb-3">
                                                                No se encontró paciente con ese nombre o DNI
                                                            </p>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    form.setValue("isNewPatient", true);
                                                                    form.setValue("patientName", searchPatient);
                                                                }}
                                                            >
                                                                <UserPlus className="h-4 w-4 mr-2" />
                                                                Crear nuevo paciente "{searchPatient}"
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Campos condicionales para nuevo paciente */}
                                {isNewPatient && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-primary/5 dark:bg-primary/10 border-primary/20">
                                        <div className="col-span-2">
                                            <p className="text-sm font-medium mb-2">
                                                Completar datos del nuevo paciente
                                            </p>
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="newPatientDni"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>DNI *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="8 dígitos"
                                                            maxLength={8}
                                                            autoComplete="none"
                                                            {...field}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, "");
                                                                if (val.length > 0 && val[0] === '0') return;
                                                                field.onChange(val);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="newPatientPhone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Celular *</FormLabel>
                                                    <FormControl>
                                                        <div className="flex">
                                                            <div className="flex items-center justify-center px-3 border border-r-0 rounded-l-md bg-primary/5 text-sm font-semibold">
                                                                +51
                                                            </div>
                                                            <Input
                                                                placeholder="999888777"
                                                                maxLength={9}
                                                                className="rounded-l-none"
                                                                autoComplete="none"
                                                                {...field}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/\D/g, "");
                                                                    if (val.length > 0 && val[0] !== '9') return;
                                                                    field.onChange(val);
                                                                }}
                                                            />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}

                                {/* Sección de tratamientos activos */}
                                {watchedPatientId && !isNewPatient && (
                                    <>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-sm font-semibold">
                                                Tratamientos Activos
                                            </p>
                                            {loadingTreatments && (
                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                            )}
                                        </div>

                                        {!loadingTreatments && activeTreatments.length === 0 && (
                                            <p className="text-sm text-muted-foreground italic mb-3">
                                                No hay tratamientos activos
                                            </p>
                                        )}

                                        {!loadingTreatments && activeTreatments.length > 0 && (
                                            <div className="space-y-2 mb-4">
                                                {activeTreatments.map((treatment) => {
                                                    const isSelected = selectedTreatmentId === treatment.id;
                                                    return (
                                                        <button
                                                            key={treatment.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedTreatmentId(null);
                                                                } else {
                                                                    setSelectedTreatmentId(treatment.id);
                                                                    form.setValue("duration", "45");
                                                                }
                                                            }}
                                                            className={`w-full text-left p-3 rounded-md border-0.5 transition-all ${isSelected
                                                                ? 'border-green-500 bg-green-100 dark:bg-green-900/40 ring-2 ring-green-500'
                                                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-400'
                                                                }`}
                                                        >
                                                            <div className="flex items-start justify-between">
                                                                <p className="font-medium text-sm">{treatment.tratamiento}</p>
                                                                {isSelected && (
                                                                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
                                                                        Seleccionado
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-xs text-muted-foreground">
                                                                    Pendiente: S/ {treatment.pago_pendiente.toFixed(2)}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    Total: S/ {treatment.total_presupuesto.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* 3️⃣ TIPO DE CONSULTA - Solo si NO hay tratamiento seleccionado */}
                            {!selectedTreatmentId && (
                                <FormField
                                    control={form.control}
                                    name="consultation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                                <FormLabel className="text-right">Tipo de Consulta *</FormLabel>
                                                <div className="space-y-2">
                                                    <Select
                                                        onValueChange={(val) => {
                                                            field.onChange(val);
                                                            form.setValue("duration", "30");
                                                        }}
                                                        value={field.value}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecciona el tipo de consulta" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {consultationTypes.map((item) => (
                                                                <SelectItem key={item.type} value={item.type}>
                                                                    {item.type} - S/ {item.cost}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </div>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            )}

                            {/* 4️⃣ DURACIÓN */}
                            <FormField
                                control={form.control}
                                name="duration"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                                            <FormLabel className="text-right">Duración aprox.*</FormLabel>
                                            <div className="space-y-2">
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Selecciona la duración" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {DURATIONS.map((duration) => (
                                                            <SelectItem key={duration.value} value={duration.value}>
                                                                {duration.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </div>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {/* 5️⃣ NOTAS Y OBSERVACIONES */}
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notas y Observaciones</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Escribe aquí cualquier información adicional sobre la cita"
                                                className="min-h-[100px] resize-none"
                                                {...field}
                                                value={field.value || ""}
                                                onChange={(e) => {
                                                    const formatted = formatNotes(e.target.value);
                                                    field.onChange(formatted);
                                                }}
                                                onKeyDown={(e) => handleNotesKeyDown(e, field.value || "", field.onChange)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </form>
                    </Form>
                </div>

                <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white flex-none">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            onOpenChange(false);
                            form.reset();
                            setSearchPatient("");
                        }}
                        className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-medium"
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="appointment-form"
                        disabled={loading || !validacion.disponible}
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            "Agendar Cita"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}