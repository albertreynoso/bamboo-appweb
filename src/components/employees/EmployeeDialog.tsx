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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Calendar as CalendarIcon, ChevronDown, User, Briefcase, Phone, MapPin, CreditCard, FileText, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { createEmployee } from "@/services/employeeService";
import { EMPLOYEE_TYPES, Employee } from "@/types/employee";
import { capitalizeName, formatNotes, handleNotesKeyDown } from "@/utils/formatters";
import { useActivityLog } from "@/hooks/useActivityLog";

const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/;

const employeeFormSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .regex(soloLetras, "Solo se permiten letras"),
  apellido_paterno: z
    .string()
    .min(1, "El apellido paterno es requerido")
    .regex(soloLetras, "Solo se permiten letras"),
  apellido_materno: z
    .string()
    .min(1, "El apellido materno es requerido")
    .regex(soloLetras, "Solo se permiten letras"),
  dni_empleado: z
    .string()
    .regex(/^[1-9][0-9]{7}$/, "Ingresar un DNI válido"),
  edad: z.string().optional(),
  fecha_nacimiento: z.string().min(1, "La fecha de nacimiento es requerida"),
  genero: z.enum(["Masculino", "Femenino", "Otro", ""]).optional(),
  numero_telefonico: z
    .string()
    .regex(/^9[0-9]{8}$/, "Ingresar un número de celular válido"),
  direccion: z.string().optional(),
  tipo_empleado_id: z.string().min(1, "El tipo de empleado es requerido"),
  fecha_contratacion: z.string().min(1, "La fecha de contratación es requerida"),
  salario: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().min(1, "El salario es requerido")
  ),
  activo: z.boolean().default(true),
  notas: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EmployeeDialog({
  open,
  onOpenChange,
  onSuccess,
}: EmployeeDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { log } = useActivityLog();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      dni_empleado: "",
      edad: "",
      fecha_nacimiento: "",
      genero: "",
      numero_telefonico: "",
      direccion: "",
      tipo_empleado_id: "",
      fecha_contratacion: "",
      salario: "" as any,
      activo: true,
      notas: "",
    },
  });

  // Calcula la edad a partir de una fecha en formato YYYY-MM-DD
  const calculateAge = (birthDate: string): string => {
    if (!birthDate) return "";
    const birth = new Date(birthDate + "T00:00:00");
    if (isNaN(birth.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age.toString();
  };

  const onSubmit = async (data: EmployeeFormValues) => {
    try {
      setIsSubmitting(true);

      await createEmployee({
        nombre: data.nombre,
        apellido_paterno: data.apellido_paterno,
        apellido_materno: data.apellido_materno,
        dni_empleado: data.dni_empleado,
        edad: data.edad || calculateAge(data.fecha_nacimiento),
        fecha_nacimiento: data.fecha_nacimiento,
        genero: (data.genero as Employee["genero"]) || "",
        numero_telefonico: data.numero_telefonico,
        direccion: data.direccion || "",
        tipo_empleado_id: data.tipo_empleado_id as Employee["tipo_empleado_id"],
        fecha_contratacion: data.fecha_contratacion,
        salario: data.salario,
        activo: data.activo,
        notas: data.notas || "",
      });

      toast({
        title: "✅ Empleado creado",
        description: `${data.nombre} ${data.apellido_paterno} ha sido registrado exitosamente.`,
      });

      log({
        modulo: "Empleados",
        accion: "creó",
        entidad: "empleado",
        entidad_nombre: `${data.nombre} ${data.apellido_paterno}`,
      });

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error al crear empleado:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo crear el empleado. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) form.reset();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 border-none bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white flex-none relative">
          <DialogTitle className="text-2xl font-semibold text-slate-900">
            Nuevo Empleado
          </DialogTitle>
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

        <div className="flex-1 overflow-y-auto px-8 py-1 custom-scrollbar">
          <Form {...form}>
            <form id="employee-form" autoComplete="off" onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              {/* Información Personal */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Información Personal</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nombres *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej. Juan"
                            className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all"
                            autoComplete="new-password"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                capitalizeName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ""))
                              )
                            }
                          />
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
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Apellido Paterno *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej. Pérez"
                            className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all"
                            autoComplete="new-password"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                capitalizeName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ""))
                              )
                            }
                          />
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
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Apellido Materno *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej. López"
                            className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all"
                            autoComplete="new-password"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                capitalizeName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]/g, ""))
                              )
                            }
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
                    name="dni_empleado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">DNI*</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="457842358"
                            maxLength={8}
                            className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all font-mono tracking-widest"
                            autoComplete="none"
                            {...field}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              if (val.length > 0 && val[0] === "0") return;
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
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Género</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/20 transition-all">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            <SelectItem value="Masculino" className="rounded-lg mb-1">Masculino</SelectItem>
                            <SelectItem value="Femenino" className="rounded-lg mb-1">Femenino</SelectItem>
                            <SelectItem value="Otro" className="rounded-lg mb-1">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fecha_nacimiento"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha de Nacimiento *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal h-11 bg-slate-50 border-slate-200 rounded-xl hover:bg-slate-100 transition-all",
                                  !field.value && "text-slate-400"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value + "T00:00:00"), "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 text-slate-400" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3 rounded-2xl border-slate-100 shadow-2xl" align="start">
                            {(() => {
                              const currentYear = new Date().getFullYear();
                              const dateValue = field.value ? new Date(field.value + 'T00:00:00') : undefined;
                              // eslint-disable-next-line react-hooks/rules-of-hooks
                              const [displayMonth, setDisplayMonth] = useState(dateValue || new Date(currentYear - 30, 0));

                              return (
                                <>
                                  <div className="flex justify-between mb-3 gap-2">
                                    <select
                                      className="border rounded-lg px-2 py-1.5 text-xs bg-slate-50 border-slate-200 focus:ring-2 ring-primary/20 outline-none"
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
                                      className="border rounded-lg px-2 py-1.5 text-xs bg-slate-50 border-slate-200 focus:ring-2 ring-primary/20 outline-none font-bold"
                                      value={displayMonth.getFullYear()}
                                      onChange={(e) =>
                                        setDisplayMonth(
                                          new Date(parseInt(e.target.value), displayMonth.getMonth())
                                        )
                                      }
                                    >
                                      {Array.from({ length: 100 }, (_, i) => currentYear - i).map((y) => (
                                        <option key={y} value={y}>
                                          {y}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <Calendar
                                    mode="single"
                                    selected={dateValue}
                                    onSelect={(date) => {
                                      if (date) {
                                        const y = date.getFullYear();
                                        const m = String(date.getMonth() + 1).padStart(2, '0');
                                        const d = String(date.getDate()).padStart(2, '0');
                                        const formatted = `${y}-${m}-${d}`;
                                        field.onChange(formatted);
                                        const age = calculateAge(formatted);
                                        if (age) form.setValue("edad", age);
                                      }
                                    }}
                                    month={displayMonth}
                                    onMonthChange={setDisplayMonth}
                                    disabled={(date) =>
                                      date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                    className="rounded-xl"
                                  />
                                </>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="edad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Edad</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Calculada..."
                            {...field}
                            readOnly
                            className="h-11 bg-slate-100 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed italic"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Información de Contacto */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Información de Contacto</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="numero_telefonico"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Celular *</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 group-focus-within:text-primary transition-colors pr-3 border-r border-slate-200">
                              <span className="text-xs font-bold">+51</span>
                            </div>
                            <Input
                              placeholder="999 888 777"
                              maxLength={9}
                              className="h-11 pl-16 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all font-mono tracking-wider"
                              autoComplete="none"
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "");
                                if (val.length > 0 && val[0] !== "9") return;
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
                    name="direccion"
                    render={({ field }) => (
                      <FormItem className="md:col-span-1">
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Dirección</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="Ej. Av. Principal 123"
                              className="h-11 pl-10 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all"
                              autoComplete="none"
                              {...field}
                              onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Información Laboral */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Información Laboral</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="tipo_empleado_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Cargo / Especialidad *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/20 transition-all">
                              <SelectValue placeholder="Selecciona cargo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                            {EMPLOYEE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value} className="rounded-lg mb-1">
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fecha_contratacion"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Fecha de Ingreso *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal h-11 bg-slate-50 border-slate-200 rounded-xl hover:bg-slate-100 transition-all",
                                  !field.value && "text-slate-400"
                                )}
                              >
                                {field.value ? (
                                  format(new Date(field.value + "T00:00:00"), "PPP", { locale: es })
                                ) : (
                                  <span>Seleccionar fecha</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 text-slate-400" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3 rounded-2xl border-slate-100 shadow-2xl" align="start">
                            {(() => {
                              const currentYear = new Date().getFullYear();
                              const dateValue = field.value ? new Date(field.value + 'T00:00:00') : undefined;
                              // eslint-disable-next-line react-hooks/rules-of-hooks
                              const [displayMonth, setDisplayMonth] = useState(dateValue || new Date());

                              return (
                                <>
                                  <div className="flex justify-between mb-3 gap-2">
                                    <select
                                      className="border rounded-lg px-2 py-1.5 text-xs bg-slate-50 border-slate-200 focus:ring-2 ring-primary/20 outline-none"
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
                                      className="border rounded-lg px-2 py-1.5 text-xs bg-slate-50 border-slate-200 focus:ring-2 ring-primary/20 outline-none font-bold"
                                      value={displayMonth.getFullYear()}
                                      onChange={(e) =>
                                        setDisplayMonth(
                                          new Date(parseInt(e.target.value), displayMonth.getMonth())
                                        )
                                      }
                                    >
                                      {Array.from({ length: 20 }, (_, i) => currentYear - 10 + i).map((y) => (
                                        <option key={y} value={y}>
                                          {y}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <Calendar
                                    mode="single"
                                    selected={dateValue}
                                    onSelect={(date) => {
                                      if (date) {
                                        const y = date.getFullYear();
                                        const m = String(date.getMonth() + 1).padStart(2, '0');
                                        const d = String(date.getDate()).padStart(2, '0');
                                        field.onChange(`${y}-${m}-${d}`);
                                      }
                                    }}
                                    month={displayMonth}
                                    onMonthChange={setDisplayMonth}
                                    initialFocus
                                    className="rounded-xl"
                                  />
                                </>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="salario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Salario Mensual *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded bg-slate-200/50 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-slate-600">S/</span>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="h-11 pl-12 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all font-semibold"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="activo"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border border-slate-100 p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors mt-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </FormControl>
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-bold text-slate-700">Empleado Activo</FormLabel>
                          <p className="text-[10px] text-slate-500 uppercase tracking-tight">
                            Habilita el acceso y gestión vigente
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Notas Adicionales
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Escribe observaciones relevantes aquí..."
                          className="h-28 bg-slate-50 border-slate-200 rounded-2xl focus-visible:ring-primary/20 transition-all resize-none shadow-inner"
                          {...field}
                          onChange={(e) => {
                            const formattedValue = formatNotes(e.target.value);
                            field.onChange(formattedValue);
                          }}
                          onKeyDown={(e) => handleNotesKeyDown(e, field.value || "", field.onChange)}
                        />
                      </FormControl>
                      <FormMessage />
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
            onClick={() => {
              form.reset();
              onOpenChange(false);
            }}
            disabled={isSubmitting}
            className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-medium"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="employee-form"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Registrar Empleado"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
