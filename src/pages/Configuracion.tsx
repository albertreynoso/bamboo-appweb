// src/pages/Configuracion.tsx
import { useState, useEffect } from "react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RotateCcw,
  Save,
  Loader2,
  Tag,
  Stethoscope,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getConsultationPrices,
  saveConsultationPrices,
  ConsultationPrice,
} from "@/services/configuracionService";
import { CONSULTATION_TYPES } from "@/constants/appointmentConstants";

const DEFAULT_PRICES: ConsultationPrice[] = CONSULTATION_TYPES.map((c) => ({
  type: c.type,
  cost: c.cost,
}));

/* Color accent per consultation type (cycles through primary palette) */
const TYPE_COLORS = [
  "bg-primary/10 text-primary",
  "bg-blue-500/10 text-blue-600",
  "bg-violet-500/10 text-violet-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-orange-500/10 text-orange-600",
  "bg-pink-500/10 text-pink-600",
];

export default function Configuracion() {
  const [prices, setPrices] = useState<ConsultationPrice[]>(DEFAULT_PRICES);
  const [originalPrices, setOriginalPrices] = useState<ConsultationPrice[]>(DEFAULT_PRICES);
  const [loading, setLoading] = useState(true);
  const show = useMinLoading(loading);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConsultationPrices().then((tipos) => {
      setPrices(tipos);
      setOriginalPrices(tipos);
      setLoading(false);
    });
  }, []);

  const hasChanges = JSON.stringify(prices) !== JSON.stringify(originalPrices);

  const handlePriceChange = (index: number, raw: string) => {
    const value = raw === "" ? 0 : parseFloat(raw);
    if (isNaN(value) || value < 0) return;
    setPrices((prev) =>
      prev.map((p, i) => (i === index ? { ...p, cost: value } : p))
    );
  };

  const { log } = useActivityLog();

  const handleRestore = () => {
    setPrices(DEFAULT_PRICES);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConsultationPrices(prices);
      setOriginalPrices([...prices]);
      toast.success("Precios actualizados correctamente");
      log({ modulo: "Configuración", accion: "guardó", entidad: "configuración", entidad_nombre: "precios de consultas" });
    } catch {
      toast.error("Error al guardar los precios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (show) return <PageLoader message="Cargando configuración..." />;

  return (
    <div className="space-y-8 w-full">
      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Configuración
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gestiona los precios y ajustes generales del sistema
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-col items-center">
        <Tabs defaultValue="precios" className="w-full max-w-2xl">
          <div className="flex justify-center mb-2">
            <TabsList className="bg-muted/50 h-10 p-1">
              <TabsTrigger value="precios" className="text-sm gap-1.5 px-4">
                <Tag className="h-3.5 w-3.5" />
                Precios de Consulta
              </TabsTrigger>
              <TabsTrigger value="tratamientos" disabled className="text-sm gap-1.5 px-4">
                <Stethoscope className="h-3.5 w-3.5" />
                Tratamientos
                <Badge
                  variant="secondary"
                  className="ml-0.5 text-[9px] h-4 px-1.5 font-medium"
                >
                  Próximamente
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

        {/* ── Precios tab ── */}
        <TabsContent value="precios" className="mt-5">
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-4">
              <div>
                <CardTitle className="text-base font-semibold">
                  Tipos de Consulta
                </CardTitle>
                <CardDescription className="mt-1 text-sm leading-snug">
                  Define el costo de cada tipo de consulta. Estos valores se
                  aplican automáticamente al crear una nueva cita.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                className="shrink-0 gap-1.5 h-8 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                Predeterminados
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {(
                <div className="divide-y divide-border/60">
                  {prices.map((item, index) => {
                    const colorClass = TYPE_COLORS[index % TYPE_COLORS.length];
                    const defaultCost = DEFAULT_PRICES[index]?.cost;
                    const changed = item.cost !== originalPrices[index]?.cost;

                    return (
                      <div
                        key={item.type}
                        className="group flex items-center gap-4 px-6 py-4 hover:bg-muted/25 transition-colors"
                      >
                        {/* Icon */}
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
                        >
                          <Stethoscope className="h-4 w-4" />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground leading-tight">
                            {item.type}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Precio por consulta · S/{" "}
                            {defaultCost?.toFixed(2)} por defecto
                          </p>
                        </div>

                        {/* Changed badge */}
                        {changed && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5 bg-amber-50 text-amber-600 border border-amber-200/80 shrink-0"
                          >
                            Modificado
                          </Badge>
                        )}

                        {/* Price input */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-muted-foreground select-none">
                            S/
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step={5}
                            value={item.cost}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              handlePriceChange(index, e.target.value)
                            }
                            className="w-24 text-right font-semibold h-8 text-sm focus-visible:ring-primary/30"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              {(
                <div className="flex items-center justify-between px-6 py-4 bg-muted/20 border-t gap-4">
                  <div className="flex items-center gap-2">
                    {hasChanges ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <p className="text-xs text-amber-600 font-medium">
                          Hay cambios sin guardar
                        </p>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          Precios sincronizados con el sistema
                        </p>
                      </>
                    )}
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    size="sm"
                    className="gap-1.5 h-8"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
