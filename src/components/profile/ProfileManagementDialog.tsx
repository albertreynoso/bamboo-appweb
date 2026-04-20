import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
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
import { Calendar } from "@/components/ui/calendar";
import { 
    Loader2, 
    Calendar as CalendarIcon, 
    Save, 
    User, 
    MapPin, 
    Phone, 
    CreditCard, 
    X,
    Settings
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/AuthContext";
import { getUsuarioByUid, updateUsuario } from "@/services/usuariosService";
import { toast } from "@/hooks/use-toast";
import { capitalizeName } from "@/utils/formatters";
import { useActivityLog } from "@/hooks/useActivityLog";

// 📋 SCHEMA DE VALIDACIÓN
const profileFormSchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    apellidoPaterno: z.string().min(1, "El apellido paterno es requerido"),
    apellidoMaterno: z.string().optional(),
    fechaNacimiento: z.date({
        required_error: "La fecha de nacimiento es requerida",
    }),
    genero: z.enum(["Masculino", "Femenino"], {
        required_error: "Selecciona tu género",
    }),
    dni: z.string()
        .length(8, "El DNI debe tener 8 dígitos")
        .regex(/^\d+$/, "Solo se permiten números"),
    telefono: z.string()
        .length(9, "El teléfono debe tener 9 dígitos")
        .regex(/^\d+$/, "Solo se permiten números"),
    direccion: z.string().min(1, "La dirección es requerida"),
}).superRefine((data, ctx) => {
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 16);
    if (data.fechaNacimiento > minAge) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Debes tener al menos 16 años",
            path: ["fechaNacimiento"],
        });
    }
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface ProfileManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProfileUpdated?: () => void;
}

export function ProfileManagementDialog({ open, onOpenChange, onProfileUpdated }: ProfileManagementDialogProps) {
    const { user, refreshProfile } = useAuthContext();
    const { log } = useActivityLog();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [displayDate, setDisplayDate] = useState<Date>(new Date(new Date().getFullYear() - 30, 0));

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: {
            nombre: "",
            apellidoPaterno: "",
            apellidoMaterno: "",
            genero: "Masculino",
            dni: "",
            telefono: "",
            direccion: "",
        },
    });

    useEffect(() => {
        if (open && user?.uid) {
            const loadProfile = async () => {
                setLoading(true);
                try {
                    const data = await getUsuarioByUid(user.uid);
                    if (data) {
                        form.reset({
                            nombre: data.nombre || "",
                            apellidoPaterno: data.apellidoPaterno || "",
                            apellidoMaterno: data.apellidoMaterno || "",
                            fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento + 'T00:00:00') : undefined,
                            genero: (data.genero as "Masculino" | "Femenino") || "Masculino",
                            dni: data.dni || "",
                            telefono: data.telefono || "",
                            direccion: data.direccion || "",
                        });

                        if (data.fechaNacimiento) {
                            setDisplayDate(new Date(data.fechaNacimiento + 'T00:00:00'));
                        }
                    }
                } catch (err) {
                    toast({
                        title: "Error",
                        description: "No se pudo cargar la información del perfil.",
                        variant: "destructive",
                    });
                } finally {
                    setLoading(false);
                }
            };
            loadProfile();
        }
    }, [open, user?.uid, form]);

    const onSubmit = async (data: ProfileFormValues) => {
        if (!user) return;
        setSaving(true);
        try {
            await updateUsuario(user.uid, {
                nombre: capitalizeName(data.nombre.trim()),
                apellidoPaterno: capitalizeName(data.apellidoPaterno.trim()),
                apellidoMaterno: data.apellidoMaterno ? capitalizeName(data.apellidoMaterno.trim()) : undefined,
                fechaNacimiento: format(data.fechaNacimiento, "yyyy-MM-dd"),
                genero: data.genero,
                dni: data.dni,
                telefono: data.telefono,
                direccion: capitalizeName(data.direccion.trim()),
            });

            await log({
                modulo: "Perfil",
                accion: "actualizó",
                entidad: "usuario",
                entidad_id: user.uid,
                entidad_nombre: `${data.nombre.trim()} ${data.apellidoPaterno.trim()}`
            });

            toast({
                title: "✅ Perfil actualizado",
                description: "Tu información ha sido guardada exitosamente.",
            });

            if (onProfileUpdated) onProfileUpdated();
            if (refreshProfile) await refreshProfile();

            onOpenChange(false);
        } catch (err) {
            toast({
                title: "❌ Error al guardar",
                description: "No se pudo actualizar el perfil. Intenta de nuevo.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[90vh] p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl bg-white">
                {/* Cabecera Fija */}
                <div className="flex items-center justify-between p-6 border-b bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <Settings className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Configuración de Perfil</h2>
                            <p className="text-sm text-slate-500">Gestiona tu información personal y de contacto</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onOpenChange(false)}
                        className="rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="h-5 w-5 text-slate-500" />
                    </Button>
                </div>

                {/* Cuerpo Scrollable */}
                <div className="flex-1 overflow-y-auto bg-slate-50/30">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center py-24 gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando perfil...</p>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form id="profile-management-form" onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">
                                {/* 👤 SECCIÓN: INFORMACIÓN PERSONAL */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <User className="h-5 w-5 text-primary" />
                                        <h3 className="font-bold tracking-tight text-slate-800">Información Personal</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="nombre"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 font-semibold">Nombre(s) *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="Ej. Juan Gabriel"
                                                            className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4"
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "");
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
                                            name="apellidoPaterno"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 font-semibold">Apellido Paterno *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="Ej. Quispe"
                                                            className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4"
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "");
                                                                field.onChange(val);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="apellidoMaterno"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 font-semibold">Apellido Materno</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="Ej. Mamani"
                                                            className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4"
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, "");
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
                                            name="genero"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 font-semibold">Género *</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4">
                                                                <SelectValue placeholder="Seleccionar" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                            <SelectItem value="Masculino" className="rounded-lg my-1 mx-1">Masculino</SelectItem>
                                                            <SelectItem value="Femenino" className="rounded-lg my-1 mx-1">Femenino</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="fechaNacimiento"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="text-slate-700 font-semibold mb-1">Fecha de Nacimiento *</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full h-11 px-4 text-left font-normal bg-slate-50/50 border-slate-100 rounded-xl hover:bg-slate-100 transition-all focus:ring-2 focus:ring-primary/20",
                                                                    !field.value && "text-slate-400"
                                                                )}
                                                            >
                                                                {field.value ? (
                                                                    <span className="text-slate-700 font-medium">
                                                                        {format(field.value, "PPP", { locale: es })}
                                                                    </span>
                                                                ) : (
                                                                    <span>Selecciona una fecha</span>
                                                                )}
                                                                <CalendarIcon className="ml-auto h-4 w-4 text-primary" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-4 bg-white rounded-2xl shadow-2xl border-slate-100" align="start">
                                                        <div className="flex justify-between mb-3 gap-2 pb-3 border-b border-slate-50">
                                                            <select
                                                                className="border-none bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer hover:bg-slate-200 transition-colors"
                                                                value={displayDate.getMonth()}
                                                                onChange={(e) =>
                                                                    setDisplayDate(new Date(displayDate.getFullYear(), parseInt(e.target.value)))
                                                                }
                                                            >
                                                                {Array.from({ length: 12 }, (_, i) => (
                                                                    <option key={i} value={i}>
                                                                        {format(new Date(0, i), "MMMM", { locale: es })}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                className="border-none bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 focus:ring-0 cursor-pointer hover:bg-slate-200 transition-colors"
                                                                value={displayDate.getFullYear()}
                                                                onChange={(e) =>
                                                                    setDisplayDate(new Date(parseInt(e.target.value), displayDate.getMonth()))
                                                                }
                                                            >
                                                                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                                                                    <option key={y} value={y}>
                                                                        {y}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <Calendar
                                                            mode="single"
                                                            selected={field.value}
                                                            onSelect={field.onChange}
                                                            month={displayDate}
                                                            onMonthChange={setDisplayDate}
                                                            disabled={(date) =>
                                                                date > new Date() || date < new Date("1900-01-01")
                                                            }
                                                            initialFocus
                                                            locale={es}
                                                            className="rounded-xl"
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* 📍 SECCIÓN: DATOS DE CONTACTO */}
                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                                        <Phone className="h-5 w-5 text-primary" />
                                        <h3 className="font-bold tracking-tight text-slate-800">Contacto y Ubicación</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="dni"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 font-semibold flex items-center gap-2">
                                                        <CreditCard className="h-4 w-4 text-slate-400" />
                                                        DNI *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="8 dígitos"
                                                            maxLength={8}
                                                            className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4 font-mono tracking-wider"
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, "").slice(0, 8);
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
                                            name="telefono"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-700 font-semibold flex items-center gap-2">
                                                        <Phone className="h-4 w-4 text-slate-400" />
                                                        Teléfono Celular *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            {...field}
                                                            placeholder="9 dígitos"
                                                            maxLength={9}
                                                            className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4"
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, "").slice(0, 9);
                                                                field.onChange(val);
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="direccion"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-700 font-semibold flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 text-slate-400" />
                                                    Dirección Actual *
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder="Av. Ejemplo 123, Distrito, Provincia"
                                                        className="h-11 bg-slate-50/50 border-slate-100 rounded-xl focus:bg-white focus:ring-primary/20 transition-all px-4"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </form>
                        </Form>
                    )}
                </div>

                {/* Pie de Página Fijo */}
                <div className="p-6 border-t bg-white flex items-center justify-between z-10">
                    <div className="hidden sm:flex items-center gap-2 text-slate-500">
                        <Save className="h-4 w-4" />
                        <span className="text-xs font-medium">Auto-guardado no disponible</span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                            className="flex-1 sm:flex-none rounded-xl font-bold text-slate-500 hover:bg-slate-50 h-11"
                        >
                            Cancelar
                        </Button>
                        <Button
                            form="profile-management-form"
                            type="submit"
                            disabled={saving || loading}
                            className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white font-bold px-8 h-11 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Guardar Perfil
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
