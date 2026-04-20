import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, DollarSign, CreditCard, ChevronLeft, Minus, X, Stethoscope, ClipboardList, Wallet, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TREATMENT_TYPES } from "@/constants/treatmentConstants";
import { createTreatment, CuotaCronograma } from "@/services/treatmentService";
import { useActivityLog } from "@/hooks/useActivityLog";
import { cn } from "@/lib/utils";
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
    plan_pago: z.enum(["contado", "dos_cuotas", "personalizado"]).default("contado"),
    cantidad_cuotas: z.number().min(1).max(24).default(3),
    monto_inicial: z.number().min(0).default(0),
});

type TreatmentFormValues = z.infer<typeof treatmentFormSchema>;

interface TreatmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientId: string;
    patientName: string;
    onSuccess?: () => void;
}

export default function TreatmentDialog({
    open,
    onOpenChange,
    patientId,
    patientName,
    onSuccess,
}: TreatmentDialogProps) {
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
        return items.reduce((total, item, index) => {
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
        setLoading(true);

        try {
            const totalPresupuesto = calculateGrandTotal();
            const cronograma = generateCuotas(totalPresupuesto, data.plan_pago, data.cantidad_cuotas, data.monto_inicial);

            await createTreatment({
                tratamiento: data.tratamiento,
                diagnostico: data.diagnostico,
                cantidad_citas_planificadas: data.cantidad_citas,
                presupuesto: data.presupuesto,
                total_presupuesto: totalPresupuesto,
                paciente_id: patientId,
                paciente_nombre: patientName,
                cronograma_pagos: cronograma,
            });

            log({ modulo: "Tratamientos", accion: "creó", entidad: "tratamiento", entidad_nombre: data.tratamiento, paciente_nombre: patientName });

            toast({
                title: "✅ Tratamiento creado exitosamente",
                description: `Tratamiento de ${data.tratamiento} para ${patientName} ha sido registrado con un presupuesto de ${formatCurrency(totalPresupuesto)}.`,
            });

            form.reset();
            onOpenChange(false);
            onSuccess?.();

        } catch (error: any) {
            console.error("Error al crear tratamiento:", error);
            toast({
                title: "❌ Error",
                description: error.message || "No se pudo crear el tratamiento. Intenta nuevamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        Nuevo Tratamiento para {patientName}
                    </DialogTitle>
                    <DialogDescription>
                        Registra los detalles del plan de tratamiento y presupuesto.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 py-4">
                        {/* SECCIÓN 1: DATOS GENERALES */}
                        <div className="space-y-6">
                            <div className="pb-2 border-b">
                                <h3 className="text-lg font-semibold text-slate-900">Información del Tratamiento</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="tratamiento"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tipo de Tratamiento *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-12 bg-slate-50 border-slate-200 rounded-xl focus:ring-primary/20 transition-all font-medium">
                                                        <SelectValue placeholder="Selecciona el tratamiento" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                                                    {TREATMENT_TYPES.map((type) => (
                                                        <SelectItem key={type} value={type} className="rounded-lg py-3 font-medium transition-colors">
                                                            {type}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="cantidad_citas"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Citas Estimadas *</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        placeholder="Ej: 8"
                                                        className="pl-11 h-12 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all font-medium text-lg"
                                                        {...field}
                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage className="text-[10px] font-bold" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="diagnostico"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Diagnóstico y Observaciones *</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Describe el estado actual y el objetivo del tratamiento..."
                                                className="min-h-[120px] bg-slate-50 border-slate-200 rounded-2xl focus-visible:ring-primary/20 transition-all resize-none p-4 text-slate-700 leading-relaxed"
                                                {...field}
                                                onChange={(e) => {
                                                    const formattedValue = formatNotes(e.target.value);
                                                    field.onChange(formattedValue);
                                                }}
                                                onKeyDown={(e) => handleNotesKeyDown(e, field.value || "", field.onChange)}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px] font-bold" />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* SECCIÓN 2: PRESUPUESTO */}
                        <div className="space-y-6">
                            <div className="pb-2 border-b">
                                <h3 className="text-lg font-semibold text-slate-900">Plan de Tratamiento y Presupuesto</h3>
                            </div>
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-primary" />
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Servicios</h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddItem}
                                    className="h-9 px-4 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-bold text-xs uppercase tracking-wider shadow-sm transition-all"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-2" />
                                    Nuevo Ítem
                                </Button>
                            </div>

                            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <div className="grid grid-cols-[80px_130px_1fr_130px_80px] gap-2 p-4 bg-slate-50 border-b border-slate-200 font-black text-[10px] uppercase tracking-[0.1em] text-slate-500">
                                    <div className="pl-2">CANT.</div>
                                    <div>P. UNIT.</div>
                                    <div>DESCRIPCIÓN DEL SERVICIO</div>
                                    <div className="text-right">IMPORTE</div>
                                    <div className="text-center">OPC.</div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {fields.map((field, index) => {
                                        const subitems = form.watch(`presupuesto.${index}.subitems`) || [];
                                        const hasSubitems = subitems.length > 0;

                                        return (
                                            <div key={field.id} className="group animate-in fade-in duration-300">
                                                <div className="grid grid-cols-[80px_130px_1fr_130px_80px] gap-2 p-3 items-center hover:bg-slate-50/50 transition-colors">
                                                    <FormField
                                                        control={form.control}
                                                        name={`presupuesto.${index}.cantidad`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        className="h-10 bg-white border-slate-200 rounded-xl font-bold text-center group-hover:border-primary/30 transition-all"
                                                                        {...field}
                                                                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                                                        onFocus={(e) => e.target.select()}
                                                                        disabled={hasSubitems}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {!hasSubitems ? (
                                                        <FormField
                                                            control={form.control}
                                                            name={`presupuesto.${index}.precio_unitario`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <div className="relative group/input">
                                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">S/</span>
                                                                            <Input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                className="h-10 pl-7 bg-white border-slate-200 rounded-xl font-bold group-hover:border-primary/30 transition-all "
                                                                                {...field}
                                                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                                onFocus={(e) => e.target.select()}
                                                                            />
                                                                        </div>
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ) : (
                                                        <div className="text-[10px] font-black text-primary uppercase tracking-widest text-center px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">
                                                            Desglosado
                                                        </div>
                                                    )}

                                                    <FormField
                                                        control={form.control}
                                                        name={`presupuesto.${index}.descripcion`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <Input
                                                                        placeholder="¿Qué servicio se realizará?..."
                                                                        autoComplete="none"
                                                                        className="h-10 bg-white border-slate-200 rounded-xl font-medium focus:bg-white group-hover:border-primary/30 transition-all placeholder:text-slate-300"
                                                                        {...field}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    <div className="text-right pr-2">
                                                        <p className="text-[13px] font-black text-slate-900 leading-none">
                                                            {formatCurrency(calculateItemTotalWithSubitems(index))}
                                                        </p>
                                                    </div>

                                                    <div className="flex gap-1 justify-center">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleAddSubitem(index)}
                                                            className="h-9 w-9 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all shadow-none"
                                                            title="Agregar subítem"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>

                                                        {fields.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => remove(index)}
                                                                className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-none"
                                                                title="Eliminar ítem"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Subítems Layout */}
                                                {subitems.map((subitem, subIndex) => (
                                                    <div
                                                        key={subIndex}
                                                        className="grid grid-cols-[80px_130px_1fr_130px_80px] gap-2 p-3 items-center bg-slate-50/70 border-t border-slate-100 animate-in slide-in-from-left-2 duration-300"
                                                    >
                                                        <div className="pl-6">
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                className="h-8 bg-white border-slate-200 rounded-lg font-bold text-center text-xs"
                                                                value={subitem.cantidad}
                                                                onChange={(e) => {
                                                                    const newSubitems = [...subitems];
                                                                    newSubitems[subIndex] = {
                                                                        ...newSubitems[subIndex],
                                                                        cantidad: parseInt(e.target.value) || 1
                                                                    };
                                                                    form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                }}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                        </div>

                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">S/</span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-8 pl-7 bg-white border-slate-200 rounded-lg font-bold text-xs"
                                                                value={subitem.precio_unitario}
                                                                onChange={(e) => {
                                                                    const newSubitems = [...subitems];
                                                                    newSubitems[subIndex] = {
                                                                        ...newSubitems[subIndex],
                                                                        precio_unitario: parseFloat(e.target.value) || 0
                                                                    };
                                                                    form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                }}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            <div className="h-4 w-4 rounded-bl-lg border-b-2 border-l-2 border-slate-200" />
                                                            <Input
                                                                placeholder="Subítem..."
                                                                autoComplete="none"
                                                                className="h-8 bg-white border-slate-200 rounded-lg font-medium text-xs placeholder:italic"
                                                                value={subitem.descripcion}
                                                                onChange={(e) => {
                                                                    const newSubitems = [...subitems];
                                                                    newSubitems[subIndex] = {
                                                                        ...newSubitems[subIndex],
                                                                        descripcion: e.target.value
                                                                    };
                                                                    form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="text-right pr-2">
                                                            <span className="text-[11px] font-bold text-slate-500">
                                                                {formatCurrency((subitem.cantidad || 0) * (subitem.precio_unitario || 0))}
                                                            </span>
                                                        </div>

                                                        <div className="flex justify-center">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRemoveSubitem(index, subIndex)}
                                                                className="h-7 w-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-4 bg-slate-50 border-t flex items-center justify-between rounded-b-xl mt-4">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-semibold text-slate-600">Total Presupuestado</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-primary">
                                            {formatCurrency(calculateGrandTotal())}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {form.formState.errors.presupuesto && (
                                <p className="text-[11px] font-black text-rose-500 uppercase tracking-wider ml-1 animate-bounce">
                                    * {form.formState.errors.presupuesto.message}
                                </p>
                            )}
                        </div>

                        {/* SECCIÓN 3: PAGO */}
                        <div className="space-y-6 pt-6 border-t">
                            <div className="pb-2 border-b">
                                <h3 className="text-lg font-semibold text-slate-900">Cronograma de Pagos</h3>
                            </div>

                            <FormField
                                control={form.control}
                                name="plan_pago"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <div className="flex p-1 bg-slate-100 rounded-lg w-full max-w-xl mx-auto gap-1">
                                            {[
                                                { id: "contado", label: "Al Contado" },
                                                { id: "dos_cuotas", label: "02 Cuotas" },
                                                { id: "personalizado", label: "Personalizado" }
                                            ].map((plan) => (
                                                <button
                                                    key={plan.id}
                                                    type="button"
                                                    onClick={() => field.onChange(plan.id)}
                                                    className={cn(
                                                        "flex-1 px-4 py-2 rounded-md transition-all text-sm font-medium",
                                                        field.value === plan.id
                                                            ? "bg-white text-primary shadow-sm"
                                                            : "bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                                    )}
                                                >
                                                    {plan.label}
                                                </button>
                                            ))}
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-8 items-start">
                                <div className="space-y-6">
                                    {(planPago === "dos_cuotas" || planPago === "personalizado") && (
                                        <div className="space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="monto_inicial"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Monto Inicial (S/)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                {...field}
                                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                                onFocus={(e) => e.target.select()}
                                                            />
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
                                                            <FormLabel>Número de Cuotas</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    max="24"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {planPago === "contado" && (
                                        <div className="h-full flex flex-col items-center justify-center p-8 bg-white/50 border border-dashed border-slate-200 rounded-3xl opacity-60">
                                            <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-4">
                                                <Wallet className="h-7 w-7" />
                                            </div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center leading-loose">
                                                Liquidación directa<br />en una sola exhibición.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Vista previa del cronograma real-time */}
                                <div className="bg-white border rounded-lg overflow-hidden flex flex-col min-h-[220px]">
                                    <div className="px-4 py-2 bg-slate-50 border-b flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700">Vista Previa de Pagos</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
                                        {generateCuotas(calculateGrandTotal(), planPago, cantidadCuotas, montoInicial).map((cuota, idx) => (
                                            <div key={cuota.numero} className={cn(
                                                "flex items-center justify-between px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors",
                                                idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                            )}>
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-bold",
                                                        cuota.numero === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                                                    )}>
                                                        {cuota.numero === 0 ? "IN" : cuota.numero}
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{cuota.numero === 0 ? "Pago Inicial" : `Cuota #${cuota.numero}`}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pendiente</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-black text-slate-900">
                                                    {formatCurrency(cuota.monto)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex justify-end gap-3 px-0 pb-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false);
                                    form.reset();
                                }}
                                disabled={loading}
                            >
                                Descartar
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-white px-8"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    "Activar Tratamiento"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}