import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { 
    Loader2, 
    Plus, 
    Trash2, 
    DollarSign, 
    CreditCard, 
    Minus, 
    X, 
    Stethoscope, 
    ClipboardList, 
    Wallet, 
    FileText,
    CheckCircle2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TREATMENT_TYPES } from "@/constants/treatmentConstants";
import { updateTreatment, CuotaCronograma } from "@/services/treatmentService";
import { useActivityLog } from "@/hooks/useActivityLog";
import { formatCurrency, formatNotes, handleNotesKeyDown } from "@/utils/formatters";

// 📋 SCHEMA DE VALIDACIÓN
const budgetItemSchema = z.object({
    cantidad: z.number().min(1, "Cantidad debe ser al menos 1"),
    precio_unitario: z.number().min(0, "Precio no puede ser negativo"),
    descripcion: z.string().min(1, "Descripción es requerida"),
    subitems: z.array(z.object({
        cantidad: z.number().min(1, "Cantidad debe ser al menos 1"),
        precio_unitario: z.number().min(0, "Precio no puede ser negativo"),
        descripcion: z.string().min(1, "Descripción es requerida"),
    })).optional().default([]),
});

const treatmentFormSchema = z.object({
    tratamiento: z.string().min(1, "El tipo de tratamiento es requerido"),
    diagnostico: z.string().min(10, "El diagnóstico debe tener al menos 10 caracteres"),
    cantidad_citas: z.number().min(1, "Debe planificar al menos 1 cita"),
    presupuesto: z.array(budgetItemSchema).min(1, "Debe agregar al menos un ítem al presupuesto"),
    estado: z.enum(["activo", "completado", "cancelado", "pausado"]),
    plan_pago: z.enum(["contado", "dos_cuotas", "personalizado"]).default("contado"),
    cantidad_cuotas: z.number().min(1).max(24).default(3),
    monto_inicial: z.number().min(0).default(0),
});

type TreatmentFormValues = z.infer<typeof treatmentFormSchema>;

interface Treatment {
    id: string;
    tratamiento: string;
    diagnostico: string;
    cantidad_citas_planificadas: number;
    presupuesto: any[];
    total_presupuesto: number;
    monto_abonado: number;
    pago_pendiente: number;
    pagado: boolean;
    estado: string;
    cronograma_pagos?: CuotaCronograma[];
}

interface TreatmentEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    treatment: Treatment | null;
    onSuccess?: () => void;
}

export default function TreatmentEditDialog({
    open,
    onOpenChange,
    treatment,
    onSuccess,
}: TreatmentEditDialogProps) {
    const [loading, setLoading] = useState(false);
    const { log } = useActivityLog();

    const form = useForm<TreatmentFormValues>({
        resolver: zodResolver(treatmentFormSchema),
        defaultValues: {
            tratamiento: "",
            diagnostico: "",
            cantidad_citas: 1,
            presupuesto: [
                {
                    cantidad: 1,
                    precio_unitario: 0,
                    descripcion: "",
                    subitems: [],
                },
            ],
            estado: "activo",
            plan_pago: "contado",
            cantidad_cuotas: 3,
            monto_inicial: 0,
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "presupuesto",
    });

    const planPago = form.watch("plan_pago");
    const cantidadCuotas = form.watch("cantidad_cuotas");
    const montoInicial = form.watch("monto_inicial");

    // Cargar datos del tratamiento cuando se abre el modal
    useEffect(() => {
        if (treatment && open) {
            // Determinar el plan de pago basado en el cronograma existente
            let planDetected: "contado" | "dos_cuotas" | "personalizado" = "contado";
            let cuotasDetected = 3;
            let inicialDetected = 0;

            if (treatment.cronograma_pagos && treatment.cronograma_pagos.length > 0) {
                const hasInicial = treatment.cronograma_pagos.some(c => c.numero === 0);
                if (hasInicial) inicialDetected = treatment.cronograma_pagos.find(c => c.numero === 0)?.monto || 0;

                const regularCuotas = treatment.cronograma_pagos.filter(c => c.numero > 0).length;

                if (regularCuotas === 1 && !hasInicial) {
                    planDetected = "contado";
                } else if (regularCuotas === 2) {
                    planDetected = "dos_cuotas";
                } else {
                    planDetected = "personalizado";
                    cuotasDetected = regularCuotas > 0 ? regularCuotas : 3;
                }
            }

            form.reset({
                tratamiento: treatment.tratamiento,
                diagnostico: treatment.diagnostico,
                cantidad_citas: treatment.cantidad_citas_planificadas,
                presupuesto: treatment.presupuesto.length > 0 ? treatment.presupuesto : [
                    {
                        cantidad: 1,
                        precio_unitario: 0,
                        descripcion: "",
                        subitems: [],
                    },
                ],
                estado: treatment.estado as "activo" | "completado" | "cancelado" | "pausado",
                plan_pago: planDetected,
                cantidad_cuotas: cuotasDetected,
                monto_inicial: inicialDetected,
            });
        }
    }, [treatment, open, form]);

    const calculateItemTotalWithSubitems = (index: number) => {
        const item = form.watch(`presupuesto.${index}`);
        if (!item) return 0;

        const subitems = item.subitems || [];

        if (subitems.length > 0) {
            return subitems.reduce((sum, sub) => {
                return sum + ((sub.cantidad || 0) * (sub.precio_unitario || 0));
            }, 0);
        }

        return (item.cantidad || 0) * (item.precio_unitario || 0);
    };

    const calculateGrandTotal = () => {
        const items = form.watch("presupuesto");
        if (!items) return 0;
        return items.reduce((total, _, index) => {
            return total + calculateItemTotalWithSubitems(index);
        }, 0);
    };

    const generateCuotas = (total: number, plan: string, numCuotas: number, inicial: number): CuotaCronograma[] => {
        if (plan === "contado") {
            return [{ numero: 1, monto: total, estado: "pendiente" }];
        }

        const montoAFinanciar = total - inicial;
        if (plan === "dos_cuotas") {
            const mitad = Number((montoAFinanciar / 2).toFixed(2));
            const restante = Number((montoAFinanciar - mitad).toFixed(2));
            const cuotas: CuotaCronograma[] = [];
            if (inicial > 0) cuotas.push({ numero: 0, monto: inicial, estado: "pendiente" });
            cuotas.push({ numero: 1, monto: mitad, estado: "pendiente" });
            cuotas.push({ numero: 2, monto: restante, estado: "pendiente" });
            return cuotas;
        }

        if (plan === "personalizado") {
            const montoCuota = Math.floor(montoAFinanciar / numCuotas);
            const totalBase = montoCuota * numCuotas;
            const diferencia = Number((montoAFinanciar - totalBase).toFixed(2));

            const cuotas: CuotaCronograma[] = [];
            if (inicial > 0) cuotas.push({ numero: 0, monto: inicial, estado: "pendiente" });

            for (let i = 1; i <= numCuotas; i++) {
                const montoFinalCuota = i === numCuotas ? montoCuota + diferencia : montoCuota;
                cuotas.push({
                    numero: i,
                    monto: Number(montoFinalCuota.toFixed(2)),
                    estado: "pendiente"
                });
            }
            return cuotas;
        }

        return [];
    };

    const handleAddItem = () => {
        append({
            cantidad: 1,
            precio_unitario: 0,
            descripcion: "",
            subitems: [],
        });
    };

    const handleAddSubitem = (itemIndex: number) => {
        const currentSubitems = form.watch(`presupuesto.${itemIndex}.subitems`) || [];
        form.setValue(`presupuesto.${itemIndex}.subitems`, [
            ...currentSubitems,
            { cantidad: 1, precio_unitario: 0, descripcion: "" }
        ]);
    };

    const handleRemoveSubitem = (itemIndex: number, subitemIndex: number) => {
        const currentSubitems = form.watch(`presupuesto.${itemIndex}.subitems`) || [];
        const newSubitems = currentSubitems.filter((_, i) => i !== subitemIndex);
        form.setValue(`presupuesto.${itemIndex}.subitems`, newSubitems);
    };

    const onSubmit = async (data: TreatmentFormValues) => {
        if (!treatment) return;

        setLoading(true);

        try {
            const totalPresupuesto = calculateGrandTotal();
            const cronograma = generateCuotas(totalPresupuesto, data.plan_pago, data.cantidad_cuotas, data.monto_inicial);

            await updateTreatment(treatment.id, {
                tratamiento: data.tratamiento,
                diagnostico: data.diagnostico,
                cantidad_citas_planificadas: data.cantidad_citas,
                presupuesto: data.presupuesto,
                total_presupuesto: totalPresupuesto,
                monto_abonado: treatment.monto_abonado || 0,
                estado: data.estado,
                cronograma_pagos: cronograma.length > 0 ? cronograma : undefined,
            });

            log({ modulo: "Tratamientos", accion: "editó", entidad: "tratamiento", entidad_id: treatment.id, entidad_nombre: data.tratamiento });

            toast({
                title: "✅ Tratamiento actualizado",
                description: "El tratamiento ha sido actualizado exitosamente.",
            });

            form.reset();
            onOpenChange(false);
            onSuccess?.();

        } catch (error: any) {
            console.error("Error al actualizar tratamiento:", error);
            toast({
                title: "❌ Error",
                description: error.message || "No se pudo actualizar el tratamiento. Intenta nuevamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden flex flex-col rounded-3xl border-none shadow-2xl bg-white">
                {/* Cabecera Fija */}
                <div className="flex items-center justify-between p-6 border-b bg-white z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl">
                            <Stethoscope className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Editar Tratamiento</h2>
                            <p className="text-sm text-slate-500">Plan de tratamiento para {treatment?.tratamiento}</p>
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
                <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50/30">
                    <Form {...form}>
                        <form id="treatment-edit-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            
                            {/* Sección 1: Detalles Generales */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-50">
                                    <ClipboardList className="h-5 w-5 text-primary" />
                                    <h3 className="font-bold tracking-tight">Detalles del Tratamiento</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="tratamiento"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-700 font-semibold">Tipo de Tratamiento *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-slate-50/50 border-slate-100 h-11 rounded-xl focus:ring-primary/20">
                                                            <SelectValue placeholder="Selecciona el tratamiento" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                        {TREATMENT_TYPES.map((type) => (
                                                            <SelectItem key={type} value={type} className="rounded-lg my-1 mx-1">
                                                                {type}
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
                                        name="estado"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-slate-700 font-semibold">Estado del Tratamiento</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="bg-slate-50/50 border-slate-100 h-11 rounded-xl focus:ring-primary/20 capitalize">
                                                            <SelectValue placeholder="Estado..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                        {["activo", "completado", "cancelado", "pausado"].map((estado) => (
                                                            <SelectItem key={estado} value={estado} className="rounded-lg my-1 mx-1 capitalize">
                                                                {estado}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="diagnostico"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-700 font-semibold">Diagnóstico *</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Describe el diagnóstico detallado..."
                                                    className="min-h-[120px] bg-slate-50/50 border-slate-100 rounded-2xl resize-none focus:ring-primary/20 p-4"
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

                            {/* Sección 2: Presupuesto */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-50">
                                    <div className="flex items-center gap-2 text-slate-800">
                                        <Wallet className="h-5 w-5 text-primary" />
                                        <h3 className="font-bold tracking-tight">Presupuesto Detallado</h3>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddItem}
                                        className="rounded-xl border-primary/20 text-primary hover:bg-primary/5 h-9"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Agregar Item
                                    </Button>
                                </div>

                                <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <div className="min-w-[700px]">
                                            <div className="grid grid-cols-[80px_130px_1fr_130px_80px] gap-2 px-4 py-3 bg-slate-50 border-b text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                <div>Cant.</div>
                                                <div>P. Unitario</div>
                                                <div>Descripción</div>
                                                <div className="text-right">Importe</div>
                                                <div className="text-center">Acc.</div>
                                            </div>

                                            <div className="divide-y divide-slate-50">
                                                {fields.map((field, index) => {
                                                    const subitems = form.watch(`presupuesto.${index}.subitems`) || [];
                                                    const hasSubitems = subitems.length > 0;

                                                    return (
                                                        <div key={field.id} className="group">
                                                            <div className="grid grid-cols-[80px_130px_1fr_130px_80px] gap-2 px-4 py-3 items-center hover:bg-slate-50/30 transition-colors">
                                                                <FormField
                                                                    control={form.control}
                                                                    name={`presupuesto.${index}.cantidad`}
                                                                    render={({ field }) => (
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                min="1"
                                                                                className="h-9 bg-white border-slate-200 rounded-lg text-center"
                                                                                {...field}
                                                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                                                                disabled={hasSubitems}
                                                                            />
                                                                        </FormControl>
                                                                    )}
                                                                />

                                                                {!hasSubitems ? (
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`presupuesto.${index}.precio_unitario`}
                                                                        render={({ field }) => (
                                                                            <FormControl>
                                                                                <div className="relative">
                                                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">S/</span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        step="0.01"
                                                                                        className="h-9 pl-7 bg-white border-slate-200 rounded-lg"
                                                                                        {...field}
                                                                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                                    />
                                                                                </div>
                                                                            </FormControl>
                                                                        )}
                                                                    />
                                                                ) : (
                                                                    <div className="text-[10px] text-primary font-medium text-center bg-primary/5 py-1 px-2 rounded-lg">
                                                                        Ver Subítems
                                                                    </div>
                                                                )}

                                                                <FormField
                                                                    control={form.control}
                                                                    name={`presupuesto.${index}.descripcion`}
                                                                    render={({ field }) => (
                                                                        <FormControl>
                                                                            <Input
                                                                                placeholder="Ej. Limpieza Dental..."
                                                                                className="h-9 bg-white border-slate-200 rounded-lg"
                                                                                {...field}
                                                                            />
                                                                        </FormControl>
                                                                    )}
                                                                />

                                                                <div className="text-right font-bold text-slate-700 text-sm">
                                                                    {formatCurrency(calculateItemTotalWithSubitems(index))}
                                                                </div>

                                                                <div className="flex gap-1 justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => handleAddSubitem(index)}
                                                                        className="h-8 w-8 text-primary hover:bg-primary/5 rounded-lg"
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                    </Button>

                                                                    {fields.length > 1 && (
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => remove(index)}
                                                                            className="h-8 w-8 text-destructive hover:bg-destructive/5 rounded-lg"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Subítems nested */}
                                                            {subitems.map((subitem, subIndex) => (
                                                                <div key={subIndex} className="grid grid-cols-[80px_130px_1fr_130px_80px] gap-2 px-4 py-2 bg-slate-50/50 border-t border-slate-100/50 items-center">
                                                                    <div className="pl-4">
                                                                        <Input
                                                                            type="number"
                                                                            min="1"
                                                                            className="h-8 bg-white border-slate-200 rounded-md text-xs text-center"
                                                                            value={subitem.cantidad}
                                                                            onChange={(e) => {
                                                                                const newSubitems = [...subitems];
                                                                                newSubitems[subIndex] = { ...newSubitems[subIndex], cantidad: parseInt(e.target.value) || 1 };
                                                                                form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="relative">
                                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">S/</span>
                                                                        <Input
                                                                            type="number"
                                                                            min="0"
                                                                            className="h-8 pl-7 bg-white border-slate-200 rounded-md text-xs"
                                                                            value={subitem.precio_unitario}
                                                                            onChange={(e) => {
                                                                                const newSubitems = [...subitems];
                                                                                newSubitems[subIndex] = { ...newSubitems[subIndex], precio_unitario: parseFloat(e.target.value) || 0 };
                                                                                form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-1 h-3 rounded-full bg-slate-300 ml-2" />
                                                                        <Input
                                                                            className="h-8 bg-white border-slate-200 rounded-md text-xs italic text-slate-500"
                                                                            value={subitem.descripcion}
                                                                            onChange={(e) => {
                                                                                const newSubitems = [...subitems];
                                                                                newSubitems[subIndex] = { ...newSubitems[subIndex], descripcion: e.target.value };
                                                                                form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="text-right text-xs font-semibold text-slate-500">
                                                                        {formatCurrency((subitem.cantidad || 0) * (subitem.precio_unitario || 0))}
                                                                    </div>
                                                                    <div className="flex justify-center">
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => handleRemoveSubitem(index, subIndex)}
                                                                            className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-destructive/5"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="bg-slate-100/50 p-4 flex justify-between items-center border-t-2 border-slate-200">
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Presupuesto</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-primary/10 rounded-lg">
                                                        <DollarSign className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <span className="text-lg font-black text-slate-900 leading-none">
                                                        {formatCurrency(calculateGrandTotal())}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 3: Plan de Pagos */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-50">
                                    <Wallet className="h-5 w-5 text-primary" />
                                    <h3 className="font-bold tracking-tight">Cronograma de Pagos</h3>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="plan_pago"
                                    render={({ field }) => (
                                        <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
                                            {[
                                                { id: "contado", label: "Al Contado", icon: CheckCircle2 },
                                                { id: "dos_cuotas", label: "Dos Cuotas", icon: CreditCard },
                                                { id: "personalizado", label: "Personalizado", icon: ClipboardList },
                                            ].map((plan) => {
                                                const Icon = plan.icon;
                                                const active = field.value === plan.id;
                                                return (
                                                    <button
                                                        key={plan.id}
                                                        type="button"
                                                        onClick={() => field.onChange(plan.id)}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                            active 
                                                            ? "bg-white text-primary shadow-sm ring-1 ring-slate-200" 
                                                            : "text-slate-500 hover:bg-white/50"
                                                        }`}
                                                    >
                                                        <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-slate-400"}`} />
                                                        {plan.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                />

                                {(planPago === "dos_cuotas" || planPago === "personalizado") && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                        <FormField
                                            control={form.control}
                                            name="monto_inicial"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-slate-600 font-bold text-xs">Monto Inicial (opcional)</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">S/</span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-11 pl-9 bg-white border-slate-200 rounded-xl focus:ring-primary/20 font-bold text-slate-700"
                                                                {...field}
                                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        {planPago === "personalizado" && (
                                            <FormField
                                                control={form.control}
                                                name="cantidad_cuotas"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-slate-600 font-bold text-xs">Número de Cuotas</FormLabel>
                                                        <div className="flex items-center justify-between h-11 px-4 bg-white border border-slate-200 rounded-xl">
                                                            <button
                                                                type="button"
                                                                onClick={() => field.onChange(Math.max(1, field.value - 1))}
                                                                className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                                                            >
                                                                <Minus className="h-4 w-4 text-slate-500" />
                                                            </button>
                                                            <span className="font-bold text-slate-900">{field.value}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => field.onChange(Math.min(24, field.value + 1))}
                                                                className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                                                            >
                                                                <Plus className="h-4 w-4 text-slate-500" />
                                                            </button>
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Vista previa del cronograma */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen de Cuotas</span>
                                    </div>
                                    <div className="rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                                        {generateCuotas(calculateGrandTotal(), planPago, cantidadCuotas, montoInicial).map((cuota, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                        cuota.numero === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        {cuota.numero === 0 ? "INI" : cuota.numero}
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-600">
                                                        {cuota.numero === 0 ? "Monto Inicial" : `Cuota ${cuota.numero}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <span className="text-sm font-black text-slate-900 leading-none">
                                                        {formatCurrency(cuota.monto)}
                                                    </span>
                                                    <div className="w-24 flex justify-end">
                                                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[9px] font-black uppercase tracking-wider border border-amber-100">
                                                            {treatment?.cronograma_pagos?.find(c => c.numero === cuota.numero)?.estado || "Pendiente"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </form>
                    </Form>
                </div>

                {/* Pie de Página Fijo */}
                <div className="p-6 border-t bg-white flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        <span className="text-sm font-semibold text-slate-600">Actualizar planificación</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                onOpenChange(false);
                                form.reset();
                            }}
                            disabled={loading}
                            className="rounded-xl font-bold text-slate-500 hover:bg-slate-50"
                        >
                            Cancelar
                        </Button>
                        <Button
                            form="treatment-edit-form"
                            type="submit"
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-11 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70"
                        >
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
                </div>
            </DialogContent>
        </Dialog>
    );
}