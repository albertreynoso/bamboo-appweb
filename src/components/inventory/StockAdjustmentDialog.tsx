import { useState, useEffect } from "react";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { RotationInventoryItem } from "@/types/inventory";
import { adjustStock } from "@/services/inventoryService";
import { useActivityLog } from "@/hooks/useActivityLog";

interface StockAdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: RotationInventoryItem | null;
    onSuccess: () => void;
}

export function StockAdjustmentDialog({ open, onOpenChange, item, onSuccess }: StockAdjustmentDialogProps) {
    const { log } = useActivityLog();
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [mode, setMode] = useState<"add" | "remove">("add");

    useEffect(() => {
        if (open) {
            setAmount(0);
            setMode("add");
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item?.id || amount <= 0) return;

        if (mode === "remove" && item.stock_actual - amount < 0) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No puedes descargar más unidades de las existentes.",
            });
            return;
        }

        try {
            setLoading(true);
            const adjustment = mode === "add" ? amount : -amount;
            await adjustStock(item.id, adjustment);

            toast({
                title: "Stock actualizado",
                description: `Se han ${mode === "add" ? "cargado" : "descargado"} ${amount} unidades.`,
            });

            log({ modulo: "Inventario", accion: mode === "add" ? "cargó stock de" : "descargó stock de", entidad: "producto", entidad_id: item.id, entidad_nombre: `${item.nombre} (${amount} unidades)` });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error("Error adjusting stock:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Ocurrió un error al actualizar el stock.",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 border-none bg-white rounded-3xl overflow-hidden shadow-2xl">
                <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white relative">
                    <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-primary animate-in spin-in-180 duration-700" />
                        Ajuste de Stock
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

                <div className="px-6 py-8 space-y-6">
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                        <p className="text-sm text-slate-600 leading-relaxed text-center">
                            Gestionas el stock de <strong className="text-slate-900">{item.nombre}</strong>.<br />
                            Cantidad actual: <span className="text-primary font-bold text-lg ml-1">{item.stock_actual}</span> unidades.
                        </p>
                    </div>

                    <form id="stock-adjustment-form" autoComplete="off" onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex gap-3 p-1.5 bg-slate-100 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => setMode("add")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-[14px] transition-all duration-300 ${
                                    mode === "add" 
                                    ? "bg-white shadow-md text-emerald-600 scale-[1.02]" 
                                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                }`}
                            >
                                <ArrowDownToLine className="h-4 w-4" />
                                Ingreso
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode("remove")}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-[14px] transition-all duration-300 ${
                                    mode === "remove" 
                                    ? "bg-white shadow-md text-rose-600 scale-[1.02]" 
                                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                }`}
                            >
                                <ArrowUpFromLine className="h-4 w-4" />
                                Salida
                            </button>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Cantidad a ajustar</Label>
                            <Input
                                type="number"
                                min="1"
                                value={amount || ""}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                placeholder="0"
                                required
                                className="h-12 bg-slate-50 border-slate-200 rounded-xl text-lg font-semibold focus-visible:ring-primary/20 transition-all"
                            />
                        </div>
                    </form>
                </div>

                <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
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
                        form="stock-adjustment-form"
                        disabled={loading || amount <= 0} 
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            "Confirmar Ajuste"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
