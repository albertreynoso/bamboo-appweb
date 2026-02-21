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
import { Loader2, Plus, Trash2, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TREATMENT_TYPES } from "@/constants/treatmentConstants";
import { updateTreatment } from "@/services/treatmentService";
import { formatCurrency } from "@/utils/formatters";

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
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "presupuesto",
    });

    // Cargar datos del tratamiento cuando se abre el modal
    useEffect(() => {
        if (treatment && open) {
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
        return items.reduce((total, item, index) => {
            return total + calculateItemTotalWithSubitems(index);
        }, 0);
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

            await updateTreatment(treatment.id, {
                tratamiento:                data.tratamiento,
                diagnostico:                data.diagnostico,
                cantidad_citas_planificadas: data.cantidad_citas,
                presupuesto:                data.presupuesto,
                total_presupuesto:          totalPresupuesto,
                monto_abonado:              treatment.monto_abonado || 0,
                estado:                     data.estado,
            });

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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold">Editar Tratamiento</DialogTitle>
                    <DialogDescription>
                        Modificar el plan de tratamiento
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <div className="space-y-6">
                        <FormField
                            control={form.control}
                            name="tratamiento"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Tratamiento *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona el tipo de tratamiento" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {TREATMENT_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>
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
                            name="diagnostico"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Diagnóstico *</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Describe el diagnóstico del paciente..."
                                            className="min-h-[100px] resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="cantidad_citas"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cantidad de Citas Planificadas *</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="1"
                                                placeholder="Ej: 8"
                                                {...field}
                                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                                onFocus={(e) => e.target.select()}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="estado"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estado del Tratamiento *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona el estado" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="activo">Activo</SelectItem>
                                                <SelectItem value="completado">Completado</SelectItem>
                                                <SelectItem value="pausado">Pausado</SelectItem>
                                                <SelectItem value="cancelado">Cancelado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <FormLabel className="text-base">Presupuesto Detallado *</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddItem}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Agregar ítem
                                </Button>
                            </div>

                            <Card>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <div className="min-w-full">
                                            <div className="grid grid-cols-[100px_140px_1fr_140px_100px] gap-2 p-3 bg-muted/50 border-b font-medium text-sm">
                                                <div>Cantidad</div>
                                                <div>Pre. Unitario</div>
                                                <div>Descripción</div>
                                                <div className="text-right">Importe</div>
                                                <div className="text-center">Acciones</div>
                                            </div>

                                            {fields.map((field, index) => {
                                                const hasSubitems = (form.watch(`presupuesto.${index}.subitems`) || []).length > 0;
                                                
                                                return (
                                                    <div key={field.id}>
                                                        <div className="grid grid-cols-[100px_140px_1fr_140px_100px] gap-2 p-3 border-b items-center bg-background">
                                                            <FormField
                                                                control={form.control}
                                                                name={`presupuesto.${index}.cantidad`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                type="number"
                                                                                min="1"
                                                                                className="h-9"
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
                                                                                <div className="relative">
                                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                                                                        S/
                                                                                    </span>
                                                                                    <Input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        step="0.01"
                                                                                        className="h-9 pl-8"
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
                                                                <div className="text-sm text-muted-foreground italic px-3">
                                                                    Ver subítems
                                                                </div>
                                                            )}

                                                            <FormField
                                                                control={form.control}
                                                                name={`presupuesto.${index}.descripcion`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input
                                                                                placeholder="Descripción del servicio..."
                                                                                className="h-9"
                                                                                {...field}
                                                                            />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />

                                                            <div className="text-right font-medium">
                                                                {formatCurrency(calculateItemTotalWithSubitems(index))}
                                                            </div>

                                                            <div className="flex gap-1 justify-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleAddSubitem(index)}
                                                                    className="h-8 px-2"
                                                                    title="Agregar subítem"
                                                                >
                                                                    <Plus className="h-4 w-4 text-primary" />
                                                                </Button>
                                                                
                                                                {fields.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => remove(index)}
                                                                        className="h-8 px-2"
                                                                        title="Eliminar ítem"
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {form.watch(`presupuesto.${index}.subitems`)?.map((subitem, subIndex) => (
                                                            <div 
                                                                key={subIndex}
                                                                className="grid grid-cols-[100px_140px_1fr_140px_100px] gap-2 p-3 border-b items-center bg-muted/20"
                                                            >
                                                                <div className="pl-4">
                                                                    <Input
                                                                        type="number"
                                                                        min="1"
                                                                        placeholder="Cant."
                                                                        className="h-8 text-sm"
                                                                        value={subitem.cantidad}
                                                                        onChange={(e) => {
                                                                            const currentSubitems = form.watch(`presupuesto.${index}.subitems`) || [];
                                                                            const newSubitems = [...currentSubitems];
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
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                                                                        S/
                                                                    </span>
                                                                    <Input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        placeholder="0.00"
                                                                        className="h-8 pl-8 text-sm"
                                                                        value={subitem.precio_unitario}
                                                                        onChange={(e) => {
                                                                            const currentSubitems = form.watch(`presupuesto.${index}.subitems`) || [];
                                                                            const newSubitems = [...currentSubitems];
                                                                            newSubitems[subIndex] = { 
                                                                                ...newSubitems[subIndex], 
                                                                                precio_unitario: parseFloat(e.target.value) || 0 
                                                                            };
                                                                            form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                        }}
                                                                        onFocus={(e) => e.target.select()}
                                                                    />
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-muted-foreground text-xs">↳</span>
                                                                    <Input
                                                                        placeholder="Descripción del subítem..."
                                                                        className="h-8 text-sm"
                                                                        value={subitem.descripcion}
                                                                        onChange={(e) => {
                                                                            const currentSubitems = form.watch(`presupuesto.${index}.subitems`) || [];
                                                                            const newSubitems = [...currentSubitems];
                                                                            newSubitems[subIndex] = { 
                                                                                ...newSubitems[subIndex], 
                                                                                descripcion: e.target.value 
                                                                            };
                                                                            form.setValue(`presupuesto.${index}.subitems`, newSubitems);
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="text-right text-sm font-medium text-muted-foreground">
                                                                    {formatCurrency((subitem.cantidad || 0) * (subitem.precio_unitario || 0))}
                                                                </div>

                                                                <div className="flex justify-center">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleRemoveSubitem(index, subIndex)}
                                                                        className="h-8 px-2"
                                                                        title="Eliminar subítem"
                                                                    >
                                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}

                                            <div className="grid grid-cols-[100px_140px_1fr_140px_100px] gap-2 p-3 bg-muted/30 font-semibold">
                                                <div className="col-span-3 text-right">TOTAL</div>
                                                <div className="text-right text-lg flex items-center justify-end gap-2">
                                                    <DollarSign className="h-5 w-5 text-primary" />
                                                    {formatCurrency(calculateGrandTotal())}
                                                </div>
                                                <div></div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {form.formState.errors.presupuesto && (
                                <p className="text-sm font-medium text-destructive">
                                    {form.formState.errors.presupuesto.message}
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    onOpenChange(false);
                                    form.reset();
                                }}
                                disabled={loading}
                            >
                                Cancelar
                            </Button>
                            <Button 
                                type="button" 
                                disabled={loading}
                                onClick={form.handleSubmit(onSubmit)}
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
                </Form>
            </DialogContent>
        </Dialog>
    );
}