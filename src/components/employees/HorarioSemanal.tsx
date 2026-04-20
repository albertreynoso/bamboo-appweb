// src/components/employees/HorarioSemanal.tsx
import { Sun, Sunset, Moon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HorarioValue } from "@/types/employee";

type Dia = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

interface HorarioSemanalProps {
  value: HorarioValue;
  onChange: (value: HorarioValue) => void;
  disabled?: boolean;
}

// ── Config ───────────────────────────────────────────────────────────────────

const DIAS: { key: Dia; label: string; abrev: string }[] = [
  { key: "lunes",     label: "Lunes",     abrev: "Lun" },
  { key: "martes",    label: "Martes",    abrev: "Mar" },
  { key: "miercoles", label: "Miércoles", abrev: "Mié" },
  { key: "jueves",    label: "Jueves",    abrev: "Jue" },
  { key: "viernes",   label: "Viernes",   abrev: "Vie" },
  { key: "sabado",    label: "Sábado",    abrev: "Sáb" },
  { key: "domingo",   label: "Domingo",   abrev: "Dom" },
];

export const HORARIO_VACIO: HorarioValue = {
  lunes:     { mañana: false, tarde: false },
  martes:    { mañana: false, tarde: false },
  miercoles: { mañana: false, tarde: false },
  jueves:    { mañana: false, tarde: false },
  viernes:   { mañana: false, tarde: false },
  sabado:    { mañana: false, tarde: false },
  domingo:   { mañana: false, tarde: false },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HorarioSemanal({
  value,
  onChange,
  disabled = false,
}: HorarioSemanalProps) {
  const toggle = (dia: Dia, turno: "mañana" | "tarde") => {
    if (disabled || dia === "domingo") return;
    onChange({
      ...value,
      [dia]: { ...value[dia], [turno]: !value[dia][turno] },
    });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
      {DIAS.map(({ key, label, abrev }) => {
        const esDomingo = key === "domingo";
        const turno = value[key];
        const activosCount = esDomingo
          ? 0
          : (turno.mañana ? 1 : 0) + (turno.tarde ? 1 : 0);

        return (
          <div
            key={key}
            className={cn(
              "flex flex-col rounded-xl border overflow-hidden transition-all",
              esDomingo
                ? "border-border/30 bg-muted/10"
                : activosCount > 0
                ? "border-primary/20 bg-primary/[0.03] shadow-sm"
                : "border-border/50 bg-card"
            )}
          >
            {/* Header del día */}
            <div
              className={cn(
                "flex items-center justify-between px-3 py-2 border-b",
                esDomingo
                  ? "border-border/20 bg-muted/10"
                  : activosCount > 0
                  ? "border-primary/10 bg-primary/5"
                  : "border-border/40 bg-muted/20"
              )}
            >
              <div className="flex flex-col">
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-wider leading-none",
                    esDomingo ? "text-muted-foreground/40" : "text-foreground"
                  )}
                >
                  {abrev}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-medium mt-0.5 hidden md:block",
                    esDomingo ? "text-muted-foreground/30" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>

              {/* Badge contador */}
              {activosCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none flex-shrink-0">
                  {activosCount}
                </span>
              )}
            </div>

            {/* Cuerpo */}
            <div className="flex flex-col gap-1.5 p-2 flex-1">
              {esDomingo ? (
                /* Domingo — bloque de descanso */
                <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg bg-muted/20 min-h-[80px]">
                  <Moon className="h-4 w-4 text-muted-foreground/30" />
                  <span className="text-[10px] font-medium text-muted-foreground/40 text-center leading-tight">
                    Descanso
                  </span>
                </div>
              ) : (
                <>
                  {/* Turno Mañana */}
                  <TurnoButton
                    label="Mañana"
                    icon={<Sun className="h-3.5 w-3.5 flex-shrink-0" />}
                    active={turno.mañana}
                    disabled={disabled}
                    onClick={() => toggle(key, "mañana")}
                  />

                  {/* Turno Tarde */}
                  <TurnoButton
                    label="Tarde"
                    icon={<Sunset className="h-3.5 w-3.5 flex-shrink-0" />}
                    active={turno.tarde}
                    disabled={disabled}
                    onClick={() => toggle(key, "tarde")}
                  />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── TurnoButton ───────────────────────────────────────────────────────────────

interface TurnoButtonProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function TurnoButton({ label, icon, active, disabled, onClick }: TurnoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium transition-all duration-150 select-none",
        disabled && "cursor-not-allowed opacity-50",
        !disabled && active &&
          "bg-primary text-primary-foreground shadow-sm",
        !disabled && !active &&
          "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {active && !disabled ? (
        <Check className="h-3 w-3 flex-shrink-0" />
      ) : (
        icon
      )}
      <span className="leading-none">{label}</span>
    </button>
  );
}
