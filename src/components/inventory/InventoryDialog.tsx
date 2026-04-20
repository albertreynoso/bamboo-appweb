import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Calendar as CalendarIcon, Package, Sprout, X, Info, Tag, Settings, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useActivityLog } from "@/hooks/useActivityLog";
import { diffObjects } from "@/utils/activityDiff";
import { toast } from "@/hooks/use-toast";
import {
    InventoryItemType,
    InventoryItemFormValues,
    inventoryItemSchema,
    INVENTORY_CATEGORIES,
} from "@/types/inventory";
import { createInventoryItem, updateInventoryItem } from "@/services/inventoryService";
import { capitalizeName, formatNotes, handleNotesKeyDown } from "@/utils/formatters";

interface InventoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item?: InventoryItemType | null;
    onSuccess?: () => void;
}

export function InventoryDialog({ open, onOpenChange, item, onSuccess }: InventoryDialogProps) {
    const [loading, setLoading] = useState(false);
    const { log } = useActivityLog();

    const form = useForm<InventoryItemFormValues>({
        resolver: zodResolver(inventoryItemSchema),
        defaultValues: {
            nombre: "",
            descripcion: "",
            categoria: "Rotación",
            // Valores por defecto para que los campos no sean undefined
            marca: "",
            modelo: "",
            numero_serie: "",
            fecha_mantencion: "",
            stock_actual: 0,
            stock_minimo: 5,
            fecha_vencimiento: "",
            lote: "",
        } as any, // Hacemos cast a any temporalmente para proveer defaults a todos los campos
    });

    const categoriaSeleccionada = form.watch("categoria");

    useEffect(() => {
        if (item && open) {
            form.reset({
                nombre: item.nombre,
                descripcion: item.descripcion || "",
                categoria: item.categoria,
                ...(item.categoria === "Estático"
                    ? {
                        marca: item.marca,
                        modelo: item.modelo,
                        numero_serie: item.numero_serie,
                        fecha_mantencion: item.fecha_mantencion || "",
                    }
                    : {
                        stock_actual: item.stock_actual,
                        stock_minimo: item.stock_minimo,
                        fecha_vencimiento: item.fecha_vencimiento || "",
                        lote: item.lote || "",
                    }),
            } as InventoryItemFormValues);
        } else if (open && !item) {
            form.reset({
                nombre: "",
                descripcion: "",
                categoria: "Rotación",
                marca: "",
                modelo: "",
                numero_serie: "",
                fecha_mantencion: "",
                stock_actual: 0,
                stock_minimo: 5,
                fecha_vencimiento: "",
                lote: "",
            } as any);
        }
    }, [item, open, form]);

    const onSubmit = async (data: InventoryItemFormValues) => {
        try {
            setLoading(true);
            if (item?.id) {
                await updateInventoryItem(item.id, data);
                toast({
                    title: "Producto actualizado",
                    description: "El producto ha sido actualizado correctamente.",
                });
                const cambios = diffObjects(
                    { nombre: item.nombre, stock_actual: (item as any).stock_actual, stock_minimo: (item as any).stock_minimo, precio: (item as any).precio },
                    { nombre: data.nombre, stock_actual: (data as any).stock_actual, stock_minimo: (data as any).stock_minimo, precio: (data as any).precio },
                    { nombre: "Nombre", stock_actual: "Stock actual", stock_minimo: "Stock mínimo", precio: "Precio" }
                );
                log({ modulo: "Inventario", accion: "editó", entidad: "producto", entidad_id: item.id, entidad_nombre: data.nombre, cambios });
            } else {
                await createInventoryItem(data);
                toast({
                    title: "Producto registrado",
                    description: "El nuevo producto ha sido registrado correctamente.",
                });
                log({ modulo: "Inventario", accion: "creó", entidad: "producto", entidad_nombre: data.nombre });
            }
            onSuccess?.();
            onOpenChange(false);
        } catch (error) {
            console.error("Error saving inventory item:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Hubo un error al guardar el producto.",
            });
        } finally {
            setLoading(false);
        }
    };

    const currentYear = new Date().getFullYear();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 border-none bg-white rounded-3xl overflow-hidden">
                <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white flex-none relative">
                    <DialogTitle className="text-2xl font-semibold text-slate-900">
                        {item ? "Editar Producto" : "Nuevo Producto"}
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

                <div className="flex-1 overflow-y-auto px-6 pt-1 pb-2">
                    <Form {...form}>
                        <form id="inventory-form" autoComplete="off" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            {/* ℹ️ SECCIÓN 1: INFORMACIÓN GENERAL */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <Info className="h-4 w-4 text-primary" />
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Información General</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="nombre"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre del Producto *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Ej. Lámpara de Fotocurado"
                                                        {...field}
                                                        autoComplete="none"
                                                        onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                                        className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="categoria"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tipo de Producto *</FormLabel>
                                                <Select
                                                    onValueChange={(val) => {
                                                        field.onChange(val);
                                                        form.clearErrors();
                                                    }}
                                                    defaultValue={field.value}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 bg-slate-50 border-slate-200 rounded-xl">
                                                            <SelectValue placeholder="Seleccione el tipo" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {INVENTORY_CATEGORIES.map((cat) => (
                                                            <SelectItem key={cat.value} value={cat.value}>
                                                                <div className="flex items-center gap-2">
                                                                    {cat.value === "Estático" ? (
                                                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                                    ) : (
                                                                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                                                                    )}
                                                                    {cat.label}
                                                                </div>
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
                                    name="descripcion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descripción (Opcional)</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Detalles adicionales del producto o equipo..."
                                                    className="resize-none min-h-[100px] bg-slate-50 border-slate-200 rounded-2xl focus-visible:ring-primary/20"
                                                    {...field}
                                                    autoComplete="off"
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

                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-6">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                                    <Settings className="h-4 w-4 text-primary" />
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        {categoriaSeleccionada === "Estático"
                                            ? "Detalles Técnicos y Activo Fijo"
                                            : "Control de Inventario y Stock"}
                                    </h3>
                                </div>

                                {categoriaSeleccionada === "Estático" ? (
                                    /* ESTÁTICO FIELDS */
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="marca"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Marca *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Ej. 3M"
                                                            {...field}
                                                            value={field.value || ""}
                                                            autoComplete="none"
                                                            onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                                            className="h-11 bg-white border-slate-200 rounded-xl"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="modelo"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Modelo *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Ej. Elipar DeepCure"
                                                            {...field}
                                                            value={field.value || ""}
                                                            autoComplete="none"
                                                            onChange={(e) => field.onChange(capitalizeName(e.target.value))}
                                                            className="h-11 bg-white border-slate-200 rounded-xl"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="numero_serie"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Número de Serie *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="SN-XXXXX" {...field} value={field.value || ""} autoComplete="none" className="h-11 bg-white border-slate-200 rounded-xl" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="fecha_mantencion"
                                            render={({ field }) => {
                                                const dateValue = field.value ? new Date(field.value + "T00:00:00") : undefined;
                                                // eslint-disable-next-line react-hooks/rules-of-hooks
                                                const [displayMonth, setDisplayMonth] = useState(dateValue || new Date());

                                                return (
                                                    <FormItem>
                                                        <FormLabel>Última Mantención</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                        variant={"outline"}
                                                                        className={cn(
                                                                            "w-full pl-3 text-left font-normal h-11 bg-white border-slate-200 rounded-xl hover:bg-slate-50 transition-colors",
                                                                            !field.value && "text-slate-400"
                                                                        )}
                                                                    >
                                                                        {field.value ? (
                                                                            format(dateValue!, "PPP", { locale: es })
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
                                                                        className="border rounded-md px-2 py-1 text-xs"
                                                                        value={displayMonth.getMonth()}
                                                                        onChange={(e) =>
                                                                            setDisplayMonth(new Date(displayMonth.getFullYear(), parseInt(e.target.value)))
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
                                                                            setDisplayMonth(new Date(parseInt(e.target.value), displayMonth.getMonth()))
                                                                        }
                                                                    >
                                                                        {Array.from({ length: 15 }, (_, i) => currentYear - 10 + i).map((y) => (
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
                                                                            field.onChange(format(date, "yyyy-MM-dd"));
                                                                        } else {
                                                                            field.onChange("");
                                                                        }
                                                                    }}
                                                                    month={displayMonth}
                                                                    onMonthChange={setDisplayMonth}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    </div>
                                ) : (
                                    /* ROTATION FIELDS */
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="stock_actual"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Stock Actual *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            {...field}
                                                            value={field.value ?? 0}
                                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                                            className="h-11 bg-white border-slate-200 rounded-xl"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="stock_minimo"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Stock Mínimo (Alerta) *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            {...field}
                                                            value={field.value ?? 0}
                                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                                            className="h-11 bg-white border-slate-200 rounded-xl"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="lote"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Número de Lote (Opcional)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej. L-2026A" {...field} value={field.value || ""} autoComplete="none" className="h-11 bg-white border-slate-200 rounded-xl" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="fecha_vencimiento"
                                            render={({ field }) => {
                                                const dateValue = field.value ? new Date(field.value + "T00:00:00") : undefined;
                                                // eslint-disable-next-line react-hooks/rules-of-hooks
                                                const [displayMonth, setDisplayMonth] = useState(dateValue || new Date());

                                                return (
                                                    <FormItem>
                                                        <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                        variant={"outline"}
                                                                        className={cn(
                                                                            "w-full pl-3 text-left font-normal h-11 bg-white border-slate-200 rounded-xl hover:bg-slate-50 transition-colors",
                                                                            !field.value && "text-slate-400"
                                                                        )}
                                                                    >
                                                                        {field.value ? (
                                                                            format(dateValue!, "PPP", { locale: es })
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
                                                                        className="border rounded-md px-2 py-1 text-xs"
                                                                        value={displayMonth.getMonth()}
                                                                        onChange={(e) =>
                                                                            setDisplayMonth(new Date(displayMonth.getFullYear(), parseInt(e.target.value)))
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
                                                                            setDisplayMonth(new Date(parseInt(e.target.value), displayMonth.getMonth()))
                                                                        }
                                                                    >
                                                                        {Array.from({ length: 10 }, (_, i) => currentYear + i).map((y) => (
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
                                                                            field.onChange(format(date, "yyyy-MM-dd"));
                                                                        } else {
                                                                            field.onChange("");
                                                                        }
                                                                    }}
                                                                    month={displayMonth}
                                                                    onMonthChange={setDisplayMonth}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </form>
                    </Form>
                </div>

                <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white flex-none">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-medium"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="inventory-form"
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            item ? "Guardar Cambios" : "Registrar Producto"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
