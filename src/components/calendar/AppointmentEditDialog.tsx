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
import { CONSULTATION_TYPES, DURATIONS } from "@/constants/appointmentConstants";

const APPOINTMENT_STATUSES = [
    { value: "pendiente", label: "Pendiente" },
    { value: "confirmada", label: "Confirmada" },
    { value: "completada", label: "Completada" },
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
    onSuccess?: () => void;
}

export default function AppointmentEditDialog({
    open,
    onOpenChange,
    appointment,
    onSuccess,
}: AppointmentEditDialogProps) {
    const [loading, setLoading] = useState(false);

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
            'completed': 'completada',
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
                date:         appointment.date,
                time:         appointment.time,
                consultation: appointment.treatment,
                duration:     durationValue,
                status:       normalizeStatus(appointment.status),
                notes:        appointment.notes || "",
            });
        }
    }, [open, appointment, form]);

    // Generar slots de tiempo
    const generateTimeSlots = () => {
        const slots = [];
        for (let hour = 7; hour <= 20; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                const displayHour = hour > 12 ? hour - 12 : hour;
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
                slots.push({ value: timeValue, label: displayTime });
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

            await updateAppointment(appointment.id, updateData);

            toast({
                title: "✅ Cita actualizada",
                description: "Los cambios se han guardado correctamente.",
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
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
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
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder="Selecciona el tipo de consulta" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CONSULTATION_TYPES.map((c) => (
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
                                    <FormLabel className="text-sm">Duración *</FormLabel>
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
                                            value={field.value}
                                            onChange={(e) => {
                                                const text = e.target.value;
                                                const lines = text.split('\n');
                                                const processedLines = lines.map(line => {
                                                    const trimmedLine = line.trim();
                                                    // Si la línea no está vacía y no empieza con viñeta, agregar viñeta
                                                    if (trimmedLine && !trimmedLine.startsWith('•')) {
                                                        return '• ' + trimmedLine.replace(/^[•\-\*]\s*/, '');
                                                    }
                                                    return line;
                                                });
                                                field.onChange(processedLines.join('\n'));
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const textarea = e.currentTarget;
                                                    const cursorPosition = textarea.selectionStart;
                                                    const textBefore = field.value.substring(0, cursorPosition);
                                                    const textAfter = field.value.substring(cursorPosition);
                                                    field.onChange(textBefore + '\n• ' + textAfter);

                                                    // Mover el cursor después de la viñeta
                                                    setTimeout(() => {
                                                        textarea.selectionStart = textarea.selectionEnd = cursorPosition + 3;
                                                    }, 0);
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Botones */}
                        <div className="flex justify-end gap-3 pt-3 border-t">
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
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}