import { useState } from "react";
import { X, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatId,
  WidgetId,
  STAT_META,
  WIDGET_META,
  DashboardLayout,
  flattenStats,
  flattenWidgets,
} from "@/hooks/useDashboardLayout";
import { cn } from "@/lib/utils";

interface DashboardAddModalProps {
  open: boolean;
  onClose: () => void;
  currentLayout: DashboardLayout;
  onAdd: (statIds: StatId[], widgetIds: WidgetId[]) => void;
}

type Tab = "stats" | "widgets";

export function DashboardAddModal({
  open,
  onClose,
  currentLayout,
  onAdd,
}: DashboardAddModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [selectedStats, setSelectedStats] = useState<Set<StatId>>(new Set());
  const [selectedWidgets, setSelectedWidgets] = useState<Set<WidgetId>>(new Set());

  const existingStats = new Set(flattenStats(currentLayout));
  const existingWidgets = new Set(flattenWidgets(currentLayout));

  const totalSelected = selectedStats.size + selectedWidgets.size;

  const toggleStat = (id: StatId) => {
    if (existingStats.has(id)) return;
    setSelectedStats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleWidget = (id: WidgetId) => {
    if (existingWidgets.has(id)) return;
    setSelectedWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(Array.from(selectedStats), Array.from(selectedWidgets));
    setSelectedStats(new Set());
    setSelectedWidgets(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedStats(new Set());
    setSelectedWidgets(new Set());
    onClose();
  };

  if (!open) return null;

  const statIds = Object.keys(STAT_META) as StatId[];
  const widgetIds = Object.keys(WIDGET_META) as WidgetId[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="relative bg-card rounded-2xl border border-border/70 shadow-2xl w-full max-w-2xl max-h-[82vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 flex-none">
          <div>
            <h2 className="text-[15px] font-bold text-foreground">
              Personalizar Dashboard
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecciona los elementos que quieres mostrar
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex-none">
          <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5 w-fit">
            {(["stats", "widgets"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-150",
                  activeTab === tab
                    ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "stats" ? "Estadísticas" : "Widgets"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Stats tab */}
          {activeTab === "stats" && (
            <div className="grid grid-cols-2 gap-3">
              {statIds.map((id) => {
                const meta = STAT_META[id];
                const isAdded = existingStats.has(id);
                const isSelected = selectedStats.has(id);
                const Icon = meta.icon;

                return (
                  <button
                    key={id}
                    onClick={() => toggleStat(id)}
                    disabled={isAdded}
                    className={cn(
                      "relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-150",
                      isAdded
                        ? "border-border/40 bg-muted/30 opacity-55 cursor-not-allowed"
                        : isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                        : "border-border/70 hover:border-primary/40 hover:bg-muted/20 cursor-pointer"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg flex-none mt-0.5", meta.iconBg)}>
                      <Icon className={cn("h-3.5 w-3.5", meta.iconText)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {meta.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {meta.description}
                      </p>
                    </div>
                    {/* Status indicator */}
                    <div className="flex-none mt-0.5">
                      {isAdded ? (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                          Añadido
                        </span>
                      ) : isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-border" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Widgets tab */}
          {activeTab === "widgets" && (
            <div className="grid grid-cols-2 gap-3">
              {widgetIds.map((id) => {
                const meta = WIDGET_META[id];
                const isAdded = existingWidgets.has(id);
                const isSelected = selectedWidgets.has(id);
                const Icon = meta.icon;

                return (
                  <button
                    key={id}
                    onClick={() => toggleWidget(id)}
                    disabled={isAdded}
                    className={cn(
                      "relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-150",
                      isAdded
                        ? "border-border/40 bg-muted/30 opacity-55 cursor-not-allowed"
                        : isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
                        : "border-border/70 hover:border-primary/40 hover:bg-muted/20 cursor-pointer"
                    )}
                  >
                    <div className="p-1.5 rounded-lg bg-primary/10 flex-none mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {meta.label}
                      </p>
                      <span className="inline-block text-[10px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded mt-1 mb-1.5">
                        {meta.previewLabel}
                      </span>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {meta.description}
                      </p>
                    </div>
                    <div className="flex-none mt-0.5">
                      {isAdded ? (
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                          Añadido
                        </span>
                      ) : isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-border" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/70 flex-none">
          <p className="text-xs text-muted-foreground">
            {totalSelected > 0 ? (
              <>
                <span className="font-semibold text-foreground">{totalSelected}</span>{" "}
                elemento{totalSelected !== 1 ? "s" : ""} seleccionado{totalSelected !== 1 ? "s" : ""}
              </>
            ) : (
              "Selecciona elementos para añadir al dashboard"
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={totalSelected === 0}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir{totalSelected > 0 ? ` (${totalSelected})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
