import { z } from "zod";

// Esquema base con campos comunes
export const baseInventorySchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido"),
    descripcion: z.string().optional(),
});

// Esquema para Activos Fijos (Estáticos)
export const staticInventorySchema = baseInventorySchema.extend({
    categoria: z.literal("Estático"),
    marca: z.string().min(1, "La marca es requerida"),
    modelo: z.string().min(1, "El modelo es requerido"),
    numero_serie: z.string().min(1, "El número de serie es requerido"),
    fecha_mantencion: z.string().optional(), // Formato YYYY-MM-DD
});

// Esquema para Consumibles (Rotación)
export const rotationInventorySchema = baseInventorySchema.extend({
    categoria: z.literal("Rotación"),
    stock_actual: z.number().min(0, "El stock no puede ser negativo"),
    stock_minimo: z.number().min(0, "El stock mínimo no puede ser negativo"),
    fecha_vencimiento: z.string().optional(), // Formato YYYY-MM-DD
    lote: z.string().optional(),
});

// Unión discriminada para validación del formulario según la categoría
export const inventoryItemSchema = z.discriminatedUnion("categoria", [
    staticInventorySchema,
    rotationInventorySchema,
]);

// Tipos inferidos de Zod
export type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>;

// Tipos base para la aplicación (incluyendo ID generado por Firebase)
export type BaseInventoryItem = {
    id?: string;
    nombre: string;
    descripcion?: string;
    fecha_registro: string;
};

export type StaticInventoryItem = BaseInventoryItem & z.infer<typeof staticInventorySchema>;
export type RotationInventoryItem = BaseInventoryItem & z.infer<typeof rotationInventorySchema>;

// Tipo general para representar cualquier ítem del inventario
export type InventoryItemType = StaticInventoryItem | RotationInventoryItem;

export const INVENTORY_CATEGORIES = [
    { value: "Rotación", label: "Consumible (Rotación)" },
    { value: "Estático", label: "Activo Fijo (Estático)" },
] as const;
