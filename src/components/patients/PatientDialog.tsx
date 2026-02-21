import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const patientFormSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido_paterno: z.string().min(1, "El apellido paterno es requerido"),
  apellido_materno: z.string().min(1, "El apellido materno es requerido"),
  dni_cliente: z.string().min(8, "El DNI debe tener al menos 8 dígitos"),
  edad: z.number().min(0, "La edad debe ser mayor a 0").optional(),
  fecha_nacimiento: z.date({
    required_error: "La fecha de nacimiento es requerida",
  }),
  sexo: z.enum(["Masculino", "Femenino", "Otro", ""]).optional(),
  email: z.string().email("Email inválido").or(z.literal("")),
  celular: z.string().min(1, "El celular es requerido"),
  telefono_fijo: z.string().optional(),
  direccion: z.string().optional(),
  distrito_direccion: z.string().optional(),
  lugar_procedencia: z.string().optional(),
  estado_civil: z.enum(["Soltero", "Casado", "Divorciado", "Viudo", ""]).optional(),
  ocupacion: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;
interface PatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function PatientDialog({
  open,
  onOpenChange,
  onSuccess,
}: PatientDialogProps) {
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

  const onSubmit = async (data: PatientFormValues) => {
    try {
      setIsSubmitting(true);

      // Preparar datos para Firebase
      const patientData = {
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno,
        dni_cliente: data.dni_cliente,
        edad: data.edad || null,
        fecha_nacimiento: data.fecha_nacimiento ? Timestamp.fromDate(data.fecha_nacimiento) : null,
        sexo: data.sexo || "",
        email: data.email || "",
        celular: data.celular,
        telefono_fijo: data.telefono_fijo || "",
        direccion: data.direccion || "",
        distrito_direccion: data.distrito_direccion || "",
        lugar_procedencia: data.lugar_procedencia || "",
        estado_civil: data.estado_civil || "",
        ocupacion: data.ocupacion || "",
        fecha_creacion: Timestamp.now(),
      };

      // Guardar en Firebase
      await addDoc(collection(db, "pacientes"), patientData);

      toast({
        title: "✅ Paciente creado",
        description: `${data.nombre} ${data.apellido_paterno} ha sido registrado exitosamente.`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error al crear paciente:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo crear el paciente. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Paciente</DialogTitle>
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
                        <Input placeholder="73249876" maxLength={8} {...field} />
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
                          <SelectItem value="Otro">Otro</SelectItem>
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
                        <Input placeholder="987654321" {...field} />
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
                        <Input placeholder="014567890" {...field} />
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
                      <Input type="email" placeholder="paciente@email.com" {...field} />
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
                        <Input placeholder="Av. Principal 123" {...field} />
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
                        <Input placeholder="San Isidro" {...field} />
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
                        <Input placeholder="Ingeniero, Profesor, etc." {...field} />
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
                    <FormLabel>Lugar de Procedencia</FormLabel>
                    <FormControl>
                      <Input placeholder="Lima, Perú" {...field} />
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
                onClick={() => {
                  form.reset();
                  onOpenChange(false);
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Paciente"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}