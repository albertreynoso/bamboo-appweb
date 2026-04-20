// src/components/AppointmentEditDialog.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
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
import { Calendar as CalendarIcon, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { updateAppointment } from "@/services/appointmentService";
import { useAuthContext } from "@/context/AuthContext";
import { DURATIONS } from "@/constants/appointmentConstants";
import { useConsultationPrices } from "@/hooks/useConsultationPrices";
import { formatNotes, handleNotesKeyDown } from "@/utils/formatters";
import { useActivityLog } from "@/hooks/useActivityLog";

const APPOINTMENT_STATUSES = [
    { value: "pendiente", label: "Pendiente" },
    { value: "confirmada", label: "Confirmada" },
    { value: "atendiendo", label: "Atendiendo" },
    { value: "atendida", label: "Atendida" },
    { value: "cancelada", label: "Cancelada" },
    { value: "reprogramada", label: "Reprogramada" },
];

const editAppointmentSchema = z.object({
    date: z.date({
        required_error: "La fecha es requerida",
    }),
    time: z.string().min(1, "La hora es requerida"),
    consultation: z.string().optional(),
    duration: z.string().min(1, "Debe seleccionar una duración"),
    status: z.string().min(1, "Debe seleccionar un estado"),
    notes: z.string().optional(),
});

type EditAppointmentFormValues = z.infer<typeof editAppointmentSchema>;

interface AppointmentEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appointment: {
        id: string;
        date: Date;
        time: string;
        patient: string;
        treatment: string;
        duration: string;
        status: string;
        notes?: string;
    } | null;
    onBack?: () => void;
    onSuccess?: () => void;
}

export default function AppointmentEditDialog({
    open,
    onOpenChange,
    appointment,
    onBack,
    onSuccess,
}: AppointmentEditDialogProps) {
    const { prices: consultationTypes } = useConsultationPrices();
    const { user, userProfile } = useAuthContext();
    const userName = userProfile
        ? `${userProfile.nombre.split(' ')[0]} ${userProfile.apellidoPaterno}`
        : user?.displayName || "Sistema";
    const { log } = useActivityLog();

    const [loading, setLoading] = useState(false);
    const [displayMonth, setDisplayMonth] = useState<Date>(appointment?.date || new Date());

    const form = useForm<EditAppointmentFormValues>({
        resolver: zodResolver(editAppointmentSchema),
        defaultValues: {
            date: new Date(),
            time: "",
            consultation: "",
            duration: "30",
            status: "pendiente",
            notes: "",
        },
    });

    // Normalizar estado de inglés a español
    const normalizeStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
            'confirmed': 'confirmada',
            'pending': 'pendiente',
            'attending': 'atendiendo',
            'attended': 'atendida',
            'completed': 'atendida',
            'completada': 'atendida',
            'cancelled': 'cancelada',
            'reprogramed': 'reprogramada',
        };
        return statusMap[status?.toLowerCase()] || status;
    };

    // Verificar si la cita está reprogramada
    const isRescheduled = appointment ? normalizeStatus(appointment.status) === "reprogramada" : false;

    // Verificar si la cita es de tratamiento (el tipo_consulta empieza con "Tratamiento:")
    const isTreatmentAppointment = appointment?.treatment?.startsWith("Tratamiento:") ?? false;

    // Cargar datos cuando se abre el diálogo
    useEffect(() => {
        if (open && appointment) {
            const durationMatch = appointment.duration.match(/\d+/);
            const durationValue = durationMatch ? durationMatch[0] : "30";

            form.reset({
                date: appointment.date,
                time: appointment.time,
                consultation: appointment.treatment,
                duration: durationValue,
                status: normalizeStatus(appointment.status),
                notes: appointment.notes || "",
            });
        }
    }, [open, appointment, form]);

    // Generar slots de tiempo (7 AM - 11 PM, cada 15 min)
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

    const onSubmit = async (data: EditAppointmentFormValues) => {
        if (!appointment) return;

        setLoading(true);

        try {
            const updateData = {
                fecha: data.date,
                hora: data.time,
                tipo_consulta: data.consultation,
                duracion: data.duration,
                estado: data.status as any,
                notas_observaciones: data.notes || "",
            };

            await updateAppointment(appointment.id, updateData, userName);

            toast({
                title: "✅ Cita actualizada",
                description: "Los cambios se han guardado correctamente.",
            });

            log({
                modulo: "Calendario",
                accion: "editó",
                entidad: "cita",
                entidad_id: appointment!.id,
                entidad_nombre: `cita del ${format(data.date, "d MMM", { locale: es })} a las ${data.time}`,
                paciente_nombre: appointment!.patient,
            });

            onOpenChange(false);

            // Esperar un momento antes de recargar para que Firebase procese
            setTimeout(() => {
                onSuccess?.();
            }, 500);

        } catch (error: any) {
            console.error("Error al actualizar cita:", error);

            toast({
                title: "❌ Error al actualizar",
                description: error.message || "No se pudieron guardar los cambios. Revisa la consola.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!appointment) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                        Editar Cita
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form autoComplete="off" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Información del Paciente - Una sola fila */}
                        <div className="p-3 bg-muted/50 rounded-lg border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Paciente</p>
                            <p className="text-base font-semibold">{appointment.patient}</p>
                        </div>

                        {/* Fecha y Hora */}
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm">Fecha de la Cita *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        disabled={isRescheduled}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal h-10",
                                                            !field.value && "text-muted-foreground",
                                                            isRescheduled && "opacity-60 cursor-not-allowed"
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
                                            {!isRescheduled && (
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
                                            )}
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm">Hora *</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={isRescheduled}
                                        >
                                            <FormControl>
                                                <SelectTrigger
                                                    className={cn(
                                                        "h-10",
                                                        isRescheduled && "opacity-60 cursor-not-allowed"
                                                    )}
                                                >
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
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Tipo de Consulta - Solo si NO es cita de tratamiento */}
                        {!isTreatmentAppointment && (
                            <FormField
                                control={form.control}
                                name="consultation"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm">Tipo de Consulta *</FormLabel>
                                        <Select
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                form.setValue("duration", "30");
                                            }}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder="Selecciona el tipo de consulta" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {consultationTypes.map((c) => (
                                                    <SelectItem key={c.type} value={c.type}>
                                                        {c.type}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Mostrar info del tratamiento si es cita de tratamiento */}
                        {isTreatmentAppointment && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">Tratamiento</p>
                                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                    {appointment.treatment}
                                </p>
                            </div>
                        )}

                        {/* Duración */}
                        <FormField
                            control={form.control}
                            name="duration"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm">Duración aproximada *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-10">
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
                                </FormItem>
                            )}
                        />

                        {/* Notas */}
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

                        {/* Botones */}
                        <div className="flex justify-end gap-3 pt-3 border-t">
                            {!form.formState.isDirty ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        onOpenChange(false);
                                        onBack?.();
                                    }}
                                    disabled={loading}
                                >
                                    Volver
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        disabled={loading}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar Cambios"
                                        )}
                                    </Button>
                                </>
                            )}
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}