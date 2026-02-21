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
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types/appointment";
import { capitalizeName } from "@/utils/formatters";

const patientFormSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido_paterno: z.string().min(1, "El apellido paterno es requerido"),
  apellido_materno: z.string().min(1, "El apellido materno es requerido"),
  dni_cliente: z
    .string()
    .regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos numéricos"),
  edad: z.number().min(0, "La edad debe ser mayor a 0").optional(),
  fecha_nacimiento: z.date({
    required_error: "La fecha de nacimiento es requerida",
  }),
  sexo: z.enum(["Masculino", "Femenino", "Otro", ""]).optional(),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email inválido")
    .max(50, "El email no puede superar 50 caracteres")
    .or(z.literal("")),
  celular: z
    .string()
    .regex(/^9\d{8}$/, "El celular debe empezar con 9 y tener 9 dígitos"),
  telefono_fijo: z
    .string()
    .regex(/^\d*$/, "Solo se permiten números")
    .optional(),
  direccion: z.string().max(50, "Máximo 50 caracteres").optional(),
  distrito_direccion: z.string().max(50, "Máximo 50 caracteres").optional(),
  lugar_procedencia: z
    .string()
    .max(50, "Máximo 50 caracteres")
    .regex(/^[^\d]*$/, "No se permiten números")
    .optional(),
  estado_civil: z.enum(["Soltero", "Casado", "Divorciado", "Viudo", ""]).optional(),
  ocupacion: z.string().max(50, "Máximo 50 caracteres").optional(),
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
        sexo: patient.sexo || "",
        email: patient.email || "",
        celular: patient.celular || "",
        telefono_fijo: patient.telefono_fijo || "",
        direccion: patient.direccion || "",
        distrito_direccion: patient.distrito_direccion || "",
        lugar_procedencia: patient.lugar_procedencia || "",
        estado_civil: patient.estado_civil || "",
        ocupacion: patient.ocupacion || "",
      });
    }
  }, [patient, open, form]);

  // Función para calcular edad
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

      // Preparar datos actualizados
      const updatedData = {
        nombre: capitalizeName(data.nombre),
        apellido_paterno: capitalizeName(data.apellido_paterno),
        apellido_materno: capitalizeName(data.apellido_materno),
        dni_cliente: data.dni_cliente,
        edad: data.edad || null,
        fecha_nacimiento: data.fecha_nacimiento
          ? Timestamp.fromDate(data.fecha_nacimiento)
          : null,
        sexo: data.sexo || "",
        email: data.email?.toLowerCase() || "",
        celular: data.celular,
        telefono_fijo: data.telefono_fijo || "",
        direccion: data.direccion || "",
        distrito_direccion: data.distrito_direccion || "",
        lugar_procedencia: data.lugar_procedencia || "",
        estado_civil: data.estado_civil || "",
        ocupacion: data.ocupacion || "",
      };

      // Actualizar en Firebase
      const patientRef = doc(db, "pacientes", patient.id);
      await updateDoc(patientRef, updatedData);

      toast({
        title: "✅ Paciente actualizado",
        description: `${data.nombre} ${data.apellido_paterno} ha sido actualizado exitosamente.`,
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

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Paciente</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Información Personal */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información Personal</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombres *</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apellido_paterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido Paterno *</FormLabel>
                      <FormControl>
                        <Input placeholder="Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apellido_materno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido Materno *</FormLabel>
                      <FormControl>
                        <Input placeholder="López" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dni_cliente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="73249876"
                          maxLength={8}
                          {...field}
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
                  name="sexo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Femenino">Femenino</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha_nacimiento"
                  render={({ field }) => {
                    const currentYear = new Date().getFullYear();
                    const [displayDate, setDisplayDate] = useState(
                      field.value || new Date(currentYear - 30, 0)
                    );

                    const handleSelect = (date?: Date) => {
                      field.onChange(date);
                      if (date) {
                        const newAge = calculateAge(date);
                        form.setValue("edad", newAge);
                      }
                    };

                    return (
                      <FormItem>
                        <FormLabel>Fecha de Nacimiento *</FormLabel>
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
                                className="border rounded-md px-2 py-1"
                                value={displayDate.getMonth()}
                                onChange={(e) =>
                                  setDisplayDate(
                                    new Date(displayDate.getFullYear(), parseInt(e.target.value))
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
                                className="border rounded-md px-2 py-1"
                                value={displayDate.getFullYear()}
                                onChange={(e) =>
                                  setDisplayDate(
                                    new Date(parseInt(e.target.value), displayDate.getMonth())
                                  )
                                }
                              >
                                {Array.from({ length: 125 }, (_, i) => currentYear - i).map((y) => (
                                  <option key={y} value={y}>
                                    {y}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={handleSelect}
                              month={displayDate}
                              onMonthChange={setDisplayDate}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="edad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Calculada automáticamente"
                          {...field}
                          value={field.value || ""}
                          readOnly
                          className="bg-muted cursor-not-allowed"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {/* Información de Contacto */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Información de Contacto</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="celular"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celular *</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground select-none">
                            +51
                          </span>
                          <Input
                            placeholder="987654321"
                            className="rounded-l-none"
                            maxLength={10}
                            {...field}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 9);
                              field.onChange(val);
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono_fijo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Fijo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="064453585"
                          {...field}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="paciente@email.com"
                        maxLength={50}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Av. San Carlos 1203" maxLength={50} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="distrito_direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distrito</FormLabel>
                      <FormControl>
                        <Input placeholder="Huancayo" maxLength={50} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            {/* Otros Datos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Otros Datos</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="estado_civil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado Civil</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Soltero">Soltero/a</SelectItem>
                          <SelectItem value="Casado">Casado/a</SelectItem>
                          <SelectItem value="Divorciado">Divorciado/a</SelectItem>
                          <SelectItem value="Viudo">Viudo/a</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ocupacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ocupación</FormLabel>
                      <FormControl>
                        <Input placeholder="Ingeniero, Profesor, etc." maxLength={50} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="lugar_procedencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lugar de Procedencia (Distrito/Region)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Huancayo, Junín"
                        maxLength={50}
                        {...field}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[0-9]/g, "");
                          field.onChange(val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Paciente"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}