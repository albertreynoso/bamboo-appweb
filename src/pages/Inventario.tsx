import { useState, useEffect, useMemo, useRef } from "react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Plus, Package, AlertTriangle, AlertOctagon, Search, Edit, Trash2, ArrowUpDown, RefreshCw, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { InventoryItemType, RotationInventoryItem } from "@/types/inventory";
import { getInventoryItems, deleteInventoryItem } from "@/services/inventoryService";
import { InventoryDialog } from "@/components/inventory/InventoryDialog";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { format, differenceInDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export default function Inventario() {
    const [items, setItems] = useState<InventoryItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const show = useMinLoading(loading);
    const [refreshing, setRefreshing] = useState(false);
    const isInitialLoad = useRef(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<"Todos" | "Estático" | "Rotación">("Todos");
    const [sortBy, setSortBy] = useState<"reciente" | "antiguo" | "nombre_az" | "nombre_za">("reciente");

    // Modals state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItemType | null>(null);
    const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
    const [adjustmentItem, setAdjustmentItem] = useState<RotationInventoryItem | null>(null);

    // Delete state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [itemToDeleteName, setItemToDeleteName] = useState<string>("");
    const { log } = useActivityLog();

    const { toast } = useToast();

    const loadItems = async () => {
        try {
            if (isInitialLoad.current) { setLoading(true); } else { setRefreshing(true); }
            const data = await getInventoryItems();
            setItems(data);
        } catch (error) {
            console.error("Error loading inventory:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron cargar los datos del inventario.",
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
            isInitialLoad.current = false;
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const filteredAndSortedItems = useMemo(() => {
        let result = [...items];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(item =>
                item.nombre.toLowerCase().includes(term) ||
                (item.descripcion?.toLowerCase() || "").includes(term) ||
                (item.categoria === "Estático" && (
                    item.marca.toLowerCase().includes(term) ||
                    item.modelo.toLowerCase().includes(term) ||
                    item.numero_serie.toLowerCase().includes(term)
                ))
            );
        }

        if (categoryFilter !== "Todos") {
            result = result.filter(item => item.categoria === categoryFilter);
        }

        return result.sort((a, b) => {
            const dateA = a.fecha_registro ? parseISO(a.fecha_registro).getTime() : 0;
            const dateB = b.fecha_registro ? parseISO(b.fecha_registro).getTime() : 0;

            switch (sortBy) {
                case "reciente": return dateB - dateA;
                case "antiguo": return dateA - dateB;
                case "nombre_az": return a.nombre.localeCompare(b.nombre);
                case "nombre_za": return b.nombre.localeCompare(a.nombre);
                default: return 0;
            }
        });
    }, [items, searchTerm, categoryFilter, sortBy]);

    const activeFiltersCount = (searchTerm ? 1 : 0) + (categoryFilter !== "Todos" ? 1 : 0);

    const clearFilters = () => {
        setSearchTerm("");
        setCategoryFilter("Todos");
        setSortBy("reciente");
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await deleteInventoryItem(itemToDelete);
            toast({
                title: "Producto eliminado",
                description: "El producto ha sido removido del inventario.",
            });
            log({ modulo: "Inventario", accion: "eliminó", entidad: "producto", entidad_id: itemToDelete, entidad_nombre: itemToDeleteName });
            loadItems();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo eliminar el producto.",
            });
        } finally {
            setIsDeleteDialogOpen(false);
            setItemToDelete(null);
        }
    };

    // Dashboard calculations
    const totalActivos = items.length;

    const proximosAgotar = items.filter(
        (item) => item.categoria === "Rotación" && item.stock_actual <= item.stock_minimo
    ).length;

    const today = new Date();
    const porVencer = items.filter((item) => {
        if (item.categoria !== "Rotación" || !item.fecha_vencimiento) return false;
        const expDate = new Date(item.fecha_vencimiento + "T00:00:00");
        const diffDays = differenceInDays(expDate, today);
        return diffDays <= 60 && diffDays >= -365; // Expiring in <= 60 days (or recently expired)
    }).length;

    const getStatusBadge = (item: InventoryItemType) => {
        if (item.categoria === "Estático") {
            return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Activo Fijo</Badge>;
        }

        const { stock_actual, stock_minimo, fecha_vencimiento } = item;

        // Check expiration first
        if (fecha_vencimiento) {
            const expDate = new Date(fecha_vencimiento + "T00:00:00");
            const diffDays = differenceInDays(expDate, today);
            if (diffDays <= 0) {
                return <Badge variant="destructive" className="bg-red-500">Vencido</Badge>;
            }
            if (diffDays <= 60) {
                return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">Por vencer</Badge>;
            }
        }

        // Check stock
        if (stock_actual <= 0) {
            return <Badge variant="destructive" className="bg-red-500">Sin Stock</Badge>;
        }
        if (stock_actual <= stock_minimo) {
            return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Stock Bajo</Badge>;
        }

        return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Stock Óptimo</Badge>;
    };

    if (show) return <PageLoader message="Cargando inventario..." />;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center relative z-20 pb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Inventario
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                        Gestión de activos fijos y control de productos de rotación clínica
                        {refreshing && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary flex-none" />}
                    </p>
                </div>
                <Button
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                    onClick={() => {
                        setSelectedItem(null);
                        setIsDialogOpen(true);
                    }}
                >
                    <Plus className="mr-2 h-4 w-4" /> Registrar Producto
                </Button>
            </div>

            {/* ── Stats — compact horizontal bar ── */}
            <div className="flex items-stretch divide-x divide-border/70 bg-card rounded-xl border border-border/70 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
                    <div className="p-1.5 rounded-lg bg-primary/10 flex-none">
                        <Package className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-foreground leading-none">
                            {loading ? <span className="text-muted-foreground text-base">—</span> : totalActivos}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                            Total
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
                    <div className="p-1.5 rounded-lg bg-amber-50 flex-none">
                        <AlertTriangle className={cn("h-3.5 w-3.5", proximosAgotar > 0 ? "text-amber-600" : "text-amber-400")} />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-foreground leading-none">
                            {loading ? <span className="text-muted-foreground text-base">—</span> : proximosAgotar}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                            Por Agotar
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
                    <div className="p-1.5 rounded-lg bg-rose-50 flex-none">
                        <AlertOctagon className={cn("h-3.5 w-3.5", porVencer > 0 ? "text-rose-600" : "text-rose-400")} />
                    </div>
                    <div>
                        <p className="text-xl font-bold text-foreground leading-none">
                            {loading ? <span className="text-muted-foreground text-base">—</span> : porVencer}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                            Por Vencer
                        </p>
                    </div>
                </div>
            </div>

            {/* FILTERS AND ACTIONS */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search — fixed half the row */}
                <div className="relative w-1/2 flex-shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, descripción, marca o serie..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-9 h-9 text-sm"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                    {(["Todos", "Estático", "Rotación"] as const).map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${categoryFilter === cat
                                ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {cat === "Todos" ? "Todos" : cat === "Estático" ? "Activos Fijos" : "Consumibles"}
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground flex-none" />
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                        <SelectTrigger className="h-9 text-xs w-[148px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="reciente">Más reciente</SelectItem>
                            <SelectItem value="antiguo">Más antiguo</SelectItem>
                            <SelectItem value="nombre_az">Nombre A–Z</SelectItem>
                            <SelectItem value="nombre_za">Nombre Z–A</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Clear */}
                {activeFiltersCount > 0 && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-3 w-3" />
                        Limpiar
                    </button>
                )}
            </div>

            {/* TABLE CONTAINER */}
            <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>Categoría / Detalle</TableHead>
                                <TableHead>Stock / Lote</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAndSortedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-48">
                                        <div className="flex flex-col items-center justify-center h-full gap-3">
                                            <div className="p-3 rounded-full bg-muted">
                                                <Search className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">Sin resultados</p>
                                                <p className="text-sm text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
                                            </div>
                                            {activeFiltersCount > 0 && (
                                                <Button variant="outline" size="sm" onClick={clearFilters}>
                                                    Limpiar filtros
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAndSortedItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/20">
                                        <TableCell className="font-medium">
                                            {item.nombre}
                                            {item.descripcion && (
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                                                    {item.descripcion}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.categoria === "Estático" ? (
                                                <div className="text-sm">
                                                    <span className="font-medium">{item.marca}</span>
                                                    <span className="text-muted-foreground block text-xs">Mod: {item.modelo}</span>
                                                    <span className="text-muted-foreground block text-xs">SN: {item.numero_serie}</span>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-muted-foreground">
                                                    Consumible de Rotación
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.categoria === "Rotación" ? (
                                                <div className="text-sm">
                                                    <span className="font-semibold">{item.stock_actual} unid.</span>
                                                    <span className="text-muted-foreground block text-xs">(Mín: {item.stock_minimo})</span>
                                                    {item.lote && <span className="text-muted-foreground block text-xs">Lote: {item.lote}</span>}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(item)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {item.categoria === "Rotación" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setAdjustmentItem(item as RotationInventoryItem);
                                                            setIsAdjustmentDialogOpen(true);
                                                        }}
                                                        title="Ajuste Rápido de Stock"
                                                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setIsDialogOpen(true);
                                                    }}
                                                    title="Editar"
                                                    className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setItemToDelete(item.id!);
                                                        setItemToDeleteName(item.nombre);
                                                        setIsDeleteDialogOpen(true);
                                                    }}
                                                    title="Eliminar"
                                                    className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* MODALS */}
            <InventoryDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                item={selectedItem}
                onSuccess={loadItems}
            />

            <StockAdjustmentDialog
                open={isAdjustmentDialogOpen}
                onOpenChange={setIsAdjustmentDialogOpen}
                item={adjustmentItem}
                onSuccess={loadItems}
            />

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de eliminar este producto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el producto del inventario de la clínica.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">
                            Eliminar Producto
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
