import { useState, useEffect } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
    Calendar as CalendarIcon,
    Loader2,
    User,
    Phone,
    MapPin,
    Mail,
    Info,
    CreditCard,
    Save,
    X,
    Hash
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types/appointment";
import { capitalizeName } from "@/utils/formatters";
import { useActivityLog } from "@/hooks/useActivityLog";
import { diffObjects } from "@/utils/activityDiff";

// 📋 SCHEMA DE VALIDACIÓN (IDÉNTICO AL DE CREACIÓN PARA CONSISTENCIA)
const patientFormSchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    apellido_paterno: z.string().min(1, "El apellido paterno es requerido"),
    apellido_materno: z.string().min(1, "El apellido materno es requerido"),
    dni_cliente: z
        .string()
        .length(8, "El DNI debe tener 8 dígitos")
        .regex(/^\d+$/, "Solo se permiten números"),
    edad: z.number().min(0, "La edad debe ser mayor a 0").optional(),
    fecha_nacimiento: z.date({
        required_error: "La fecha de nacimiento es requerida",
    }),
    sexo: z.enum(["Masculino", "Femenino", "Otro", ""]),
    email: z.string().email("Email inválido").or(z.literal("")),
    celular: z
        .string()
        .length(9, "El celular debe tener 9 dígitos")
        .regex(/^9\d+$/, "Debe empezar con 9"),
    telefono_fijo: z.string().optional(),
    direccion: z.string().optional(),
    distrito_direccion: z.string().optional(),
    lugar_procedencia: z.string().optional(),
    estado_civil: z.enum(["Soltero", "Casado", "Divorciado", "Viudo", ""]),
    ocupacion: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

interface EditPatientDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patient: Patient | null;
    onSuccess?: () => void;
}

export default function EditPatientDialog({
    open,
    onOpenChange,
    patient,
    onSuccess,
}: EditPatientDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { log } = useActivityLog();
    const [displayDate, setDisplayDate] = useState<Date>(new Date());

    const form = useForm<PatientFormValues>({
        resolver: zodResolver(patientFormSchema),
        defaultValues: {
            nombre: "",
            apellido_paterno: "",
            apellido_materno: "",
            dni_cliente: "",
            edad: undefined,
            fecha_nacimiento: undefined,
            sexo: "",
            email: "",
            celular: "",
            telefono_fijo: "",
            direccion: "",
            distrito_direccion: "",
            lugar_procedencia: "",
            estado_civil: "",
            ocupacion: "",
        },
    });

    // Cargar datos del paciente cuando se abre el modal
    useEffect(() => {
        if (patient && open) {
            form.reset({
                nombre: patient.nombre || "",
                apellido_paterno: patient.apellido_paterno || "",
                apellido_materno: patient.apellido_materno || "",
                dni_cliente: patient.dni_cliente || "",
                edad: patient.edad || undefined,
                fecha_nacimiento: patient.fecha_nacimiento || undefined,
                sexo: (patient.sexo as any) || "",
                email: patient.email || "",
                celular: patient.celular || "",
                telefono_fijo: patient.telefono_fijo || "",
                direccion: patient.direccion || "",
                distrito_direccion: patient.distrito_direccion || "",
                lugar_procedencia: patient.lugar_procedencia || "",
                estado_civil: (patient.estado_civil as any) || "",
                ocupacion: patient.ocupacion || "",
            });
            if (patient.fecha_nacimiento) {
                setDisplayDate(patient.fecha_nacimiento);
            }
        }
    }, [patient, open, form]);

    const calculateAge = (date: Date) => {
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
            age--;
        }
        return age;
    };

    const onSubmit = async (data: PatientFormValues) => {
        if (!patient?.id) {
            toast({
                title: "❌ Error",
                description: "No se puede actualizar el paciente sin ID.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const updatedData = {
                nombre: capitalizeName(data.nombre.trim()),
                apellido_paterno: capitalizeName(data.apellido_paterno.trim()),
                apellido_materno: capitalizeName(data.apellido_materno.trim()),
                dni_cliente: data.dni_cliente,
                edad: data.edad || null,
                fecha_nacimiento: data.fecha_nacimiento
                    ? Timestamp.fromDate(data.fecha_nacimiento)
                    : null,
                sexo: data.sexo || "",
                email: data.email?.toLowerCase().trim() || "",
                celular: data.celular,
                telefono_fijo: data.telefono_fijo || "",
                direccion: capitalizeName(data.direccion?.trim() || ""),
                distrito_direccion: capitalizeName(data.distrito_direccion?.trim() || ""),
                lugar_procedencia: capitalizeName(data.lugar_procedencia?.trim() || ""),
                estado_civil: data.estado_civil || "",
                ocupacion: capitalizeName(data.ocupacion?.trim() || ""),
            };

            await updateDoc(doc(db, "pacientes", patient.id), updatedData);

            toast({
                title: "✅ Paciente actualizado",
                description: `${updatedData.nombre} ${updatedData.apellido_paterno} ha sido actualizado con éxito.`,
            });

            // Registrar actividad con diferencias
            const cambios = diffObjects(
                {
                    nombre: patient.nombre,
                    apellido_paterno: patient.apellido_paterno,
                    celular: patient.celular,
                    email: patient.email,
                    direccion: patient.direccion,
                    distrito_direccion: patient.distrito_direccion,
                    estado_civil: patient.estado_civil,
                    ocupacion: patient.ocupacion,
                    sexo: patient.sexo,
                },
                {
                    nombre: updatedData.nombre,
                    apellido_paterno: updatedData.apellido_paterno,
                    celular: updatedData.celular,
                    email: updatedData.email,
                    direccion: updatedData.direccion,
                    distrito_direccion: updatedData.distrito_direccion,
                    estado_civil: updatedData.estado_civil,
                    ocupacion: updatedData.ocupacion,
                    sexo: updatedData.sexo,
                },
                {
                    nombre: "Nombre",
                    apellido_paterno: "Apellido",
                    celular: "Celular",
                    email: "Email",
                    direccion: "Dirección",
                    distrito_direccion: "Distrito",
                    estado_civil: "Estado civil",
                    ocupacion: "Ocupación",
                    sexo: "Sexo",
                }
            );

            await log({
                modulo: "Pacientes",
                accion: "editó",
                entidad: "paciente",
                entidad_id: patient.id,
                entidad_nombre: `${updatedData.nombre} ${updatedData.apellido_paterno}`,
                cambios,
            });

            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error("Error al actualizar paciente:", error);
            toast({
                title: "❌ Error",
                description: "No se pudo actualizar el paciente. Intenta de nuevo.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 border-none bg-white rounded-3xl overflow-hidden">
                <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white flex-none relative">
                    <DialogTitle className="text-2xl font-semibold text-slate-900">Editar Paciente</DialogTitle>
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
                        <form id="edit-patient-form" autoComplete="off" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* 👤 SECCIÓN: INFORMACIÓN PERSONAL */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                <User className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Información Personal</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name="nombre"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Nombre(s) *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Ej. Juan"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(capitalizeName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "")))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="apellido_paterno"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Apellido Paterno *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Ej. Pérez"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(capitalizeName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "")))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="apellido_materno"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Apellido Materno *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Ej. López"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(capitalizeName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "")))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="dni_cliente"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">
                                                DNI *
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="8 dígitos"
                                                    maxLength={8}
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, "");
                                                        if (val.length > 0 && val[0] === "0") return;
                                                        field.onChange(val);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sexo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Sexo</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all">
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Masculino">Masculino</SelectItem>
                                                    <SelectItem value="Femenino">Femenino</SelectItem>
                                                    <SelectItem value="Otro">Otro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="edad"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">
                                                Edad
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    readOnly
                                                    placeholder="Autocalculada"
                                                    className="h-11 bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-semibold"
                                                    value={field.value || ""}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="fecha_nacimiento"
                                render={({ field }) => {
                                    const currentYear = new Date().getFullYear();
                                    return (
                                        <FormItem className="flex flex-col">
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Fecha de Nacimiento *</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full h-11 pl-3 text-left font-normal bg-slate-50 border-slate-200 rounded-xl hover:bg-slate-100 transition-all",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP", { locale: es })
                                                            ) : (
                                                                <span>Selecciona una fecha</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50 text-primary" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-3 bg-white" align="start">
                                                    <div className="flex justify-between mb-2 gap-2 pb-2 border-b border-slate-100">
                                                        <select
                                                            className="border-none bg-slate-100 rounded-md px-2 py-1 text-xs font-medium focus:ring-0"
                                                            value={displayDate.getMonth()}
                                                            onChange={(e) => setDisplayDate(new Date(displayDate.getFullYear(), parseInt(e.target.value)))}
                                                        >
                                                            {Array.from({ length: 12 }, (_, i) => (
                                                                <option key={i} value={i}>
                                                                    {format(new Date(0, i), "MMMM", { locale: es })}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <select
                                                            className="border-none bg-slate-100 rounded-md px-2 py-1 text-xs font-medium focus:ring-0"
                                                            value={displayDate.getFullYear()}
                                                            onChange={(e) => setDisplayDate(new Date(parseInt(e.target.value), displayDate.getMonth()))}
                                                        >
                                                            {Array.from({ length: 125 }, (_, i) => currentYear - i).map((y) => (
                                                                <option key={y} value={y}>{y}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={(date) => {
                                                            field.onChange(date);
                                                            if (date) form.setValue("edad", calculateAge(date));
                                                        }}
                                                        month={displayDate}
                                                        onMonthChange={setDisplayDate}
                                                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                        initialFocus
                                                        locale={es}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>

                        {/* 📍 SECCIÓN: DATOS DE CONTACTO */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                <Phone className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Contacto y Ubicación</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name="celular"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Celular *</FormLabel>
                                            <FormControl>
                                                <div className="flex group focus-within:ring-2 focus-within:ring-primary/20 rounded-xl transition-all">
                                                    <div className="flex items-center justify-center px-4 border border-r-0 border-slate-200 bg-slate-100/50 text-slate-500 text-sm font-bold rounded-l-xl">
                                                        +51
                                                    </div>
                                                    <Input
                                                        {...field}
                                                        placeholder="999888777"
                                                        maxLength={9}
                                                        className="h-11 bg-slate-50 border-slate-200 rounded-l-none rounded-r-xl focus:bg-white transition-all"
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/\D/g, "");
                                                            if (val.length > 0 && val[0] !== "9") return;
                                                            field.onChange(val);
                                                        }}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="telefono_fijo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Teléfono Fijo</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Ej. 014567890"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-700 font-medium text-[13px]">
                                            Email
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="email"
                                                placeholder="paciente@email.com"
                                                className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[11px]" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="direccion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">
                                                Dirección
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Av. Ejemplo 123"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="distrito_direccion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Distrito</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="San Isidro"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* ℹ️ SECCIÓN: OTROS DATOS */}
                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                <Info className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Otros Datos</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <FormField
                                    control={form.control}
                                    name="estado_civil"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Estado Civil</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all">
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Soltero">Soltero/a</SelectItem>
                                                    <SelectItem value="Casado">Casado/a</SelectItem>
                                                    <SelectItem value="Divorciado">Divorciado/a</SelectItem>
                                                    <SelectItem value="Viudo">Viudo/a</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="ocupacion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-medium text-[13px]">Ocupación</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    placeholder="Ej. Ingeniero"
                                                    className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                    onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="lugar_procedencia"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-700 font-medium text-[13px]">Lugar de Procedencia</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                placeholder="Ej. Lima, Perú"
                                                className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:bg-white transition-all"
                                                onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[11px]" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        </form>
                    </Form>
                </div>

                <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white flex-none">
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 min-w-[120px] rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-medium"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="edit-patient-form"
                        className="h-11 min-w-[170px] rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-all shadow-md shadow-primary/20 active:scale-[0.98]"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Actualizando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Actualizar Paciente
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}