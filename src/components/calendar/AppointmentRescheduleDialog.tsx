// src/components/AppointmentRescheduleDialog.tsx
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
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  CalendarClock,
  User,
  Stethoscope,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { updateAppointment } from "@/services/appointmentService";

// ══════════ SCHEMA — Solo fecha y hora ══════════
const rescheduleSchema = z.object({
  date: z.date({ required_error: "La fecha es requerida" }),
  time: z.string().min(1, "La hora es requerida"),
});

type RescheduleFormValues = z.infer<typeof rescheduleSchema>;

// ══════════ INTERFACES ══════════
interface AppointmentRescheduleDialogProps {
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
  } | null;
  onSuccess?: () => void;
}

export default function AppointmentRescheduleDialog({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: AppointmentRescheduleDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: {
      date: undefined,
      time: "",
    },
  });

  // Resetear form cuando se abre con nueva cita
  useEffect(() => {
    if (appointment && open) {
      const aptDate =
        appointment.date instanceof Date
          ? appointment.date
          : new Date(appointment.date);

      form.reset({
        date: aptDate,
        time: appointment.time,
      });
    }
  }, [appointment, open, form]);

  // Generar slots de tiempo (7:00 AM - 8:00 PM, cada 15 min)
  const generateTimeSlots = () => {
    const slots: { value: string; label: string }[] = [];
    for (let hour = 7; hour <= 20; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        if (hour === 20 && minute > 0) break;
        const timeValue = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        const displayHour = hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? "PM" : "AM";
        slots.push({
          value: timeValue,
          label: `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`,
        });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // ══════════ SUBMIT ══════════
  const onSubmit = async (data: RescheduleFormValues) => {
    if (!appointment) return;

    setLoading(true);

    try {
      await updateAppointment(appointment.id, {
        fecha: data.date,
        hora: data.time,
        estado: "reprogramada" as any,
      });

      toast({
        title: "✅ Cita reprogramada",
        description: `La cita ha sido reprogramada al ${format(data.date, "PPP", { locale: es })} a las ${data.time}.`,
      });

      onOpenChange(false);
      setTimeout(() => {
        onSuccess?.();
      }, 500);
    } catch (error: any) {
      console.error("Error al reprogramar cita:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo reprogramar la cita.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  const originalDate =
    appointment.date instanceof Date
      ? appointment.date
      : new Date(appointment.date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-orange-500" />
            Reprogramar Cita
          </DialogTitle>
        </DialogHeader>

        {/* Info de la cita actual (solo lectura) */}
        <div className="p-3 bg-muted/50 rounded-lg border space-y-1.5">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {appointment.patient}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Stethoscope className="h-3 w-3" />
              {appointment.treatment}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {appointment.duration}
            </span>
          </div>
          <div className="text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span className="font-medium">Fecha original:</span>{" "}
            {format(originalDate, "PPP", { locale: es })} a las{" "}
            {appointment.time}
          </div>
        </div>

        {/* Formulario — solo fecha y hora */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Nueva Fecha */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nueva Fecha *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal h-9 text-sm",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? format(field.value, "dd/MM/yyyy")
                              : "Seleccionar"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
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
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nueva Hora */}
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Nueva Hora *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Hora" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-60">
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

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reprogramando...
                  </>
                ) : (
                  <>
                    <CalendarClock className="mr-2 h-4 w-4" />
                    Reprogramar
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}