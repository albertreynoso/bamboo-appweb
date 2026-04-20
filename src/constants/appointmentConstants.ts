// src/constants/appointmentConstants.ts

// ── Tipos de consulta con costos ──────────────────────────────────────────────
export const CONSULTATION_TYPES = [
  { type: "Evaluación general", cost: 30 },
  { type: "Evaluación ortodoncia", cost: 50 },
  { type: "Implantes", cost: 70 },
  { type: "Odontopediatría", cost: 50 },
  { type: "Rehabilitación", cost: 70 },
  { type: "Evaluación estética", cost: 70 },
] as const;

export const getCostByConsultationType = (consultationType: string): number => {
  const consultation = CONSULTATION_TYPES.find(c => c.type === consultationType);
  return consultation?.cost ?? 0;
};

// ── Duraciones disponibles ────────────────────────────────────────────────────
export const DURATIONS = [
  { value: "30", label: "30 minutos" },
  { value: "45", label: "45 minutos" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1.5 horas" },
  { value: "120", label: "2 horas" },
] as const;

// ── Configuración unificada de estados ───────────────────────────────────────
export type StatusKey =
  | "confirmada"
  | "pendiente"
  | "atendiendo"
  | "atendida"
  | "cancelada"
  | "pausada"
  | "reprogramada";

export const APPOINTMENT_STATUS_CONFIG: Record<
  StatusKey,
  {
    label: string;
    /** Tailwind bg class for solid indicator (e.g. calendar dot) */
    color: string;
    textColor: string;
    bgLight: string;
    borderColor: string;
    /** Tailwind class for dot */
    dot: string;
    /** Tailwind classes for pill badge */
    pill: string;
    /** Hex color for inline styles (e.g. border accent) */
    hex: string;
  }
> = {
  confirmada: {
    label: "Confirmada",
    color: "bg-green-500",
    textColor: "text-green-700",
    bgLight: "bg-green-50",
    borderColor: "border-green-200",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    hex: "#10B981",
  },
  pendiente: {
    label: "Pendiente",
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    bgLight: "bg-yellow-50",
    borderColor: "border-yellow-200",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700 ring-amber-200/80",
    hex: "#F59E0B",
  },
  atendiendo: {
    label: "Atendiendo",
    color: "bg-gray-500",
    textColor: "text-gray-700",
    bgLight: "bg-gray-50",
    borderColor: "border-gray-200",
    dot: "bg-slate-400",
    pill: "bg-slate-50 text-slate-600 ring-slate-200/80",
    hex: "#6B7280",
  },
  atendida: {
    label: "Atendida",
    color: "bg-gray-500",
    textColor: "text-gray-700",
    bgLight: "bg-gray-50",
    borderColor: "border-gray-200",
    dot: "bg-slate-400",
    pill: "bg-slate-50 text-slate-600 ring-slate-200/80",
    hex: "#6B7280",
  },
  cancelada: {
    label: "Cancelado",
    color: "bg-red-500",
    textColor: "text-red-700",
    bgLight: "bg-red-50",
    borderColor: "border-red-200",
    dot: "bg-red-500",
    pill: "bg-red-50 text-red-700 ring-red-200/80",
    hex: "#EF4444",
  },
  pausada: {
    label: "Pausado",
    color: "bg-gray-400",
    textColor: "text-gray-600",
    bgLight: "bg-gray-50",
    borderColor: "border-gray-200",
    dot: "bg-slate-400",
    pill: "bg-slate-50 text-slate-600 ring-slate-200/80",
    hex: "#94a3b8",
  },
  reprogramada: {
    label: "Reprogramada",
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    dot: "bg-orange-400",
    pill: "bg-orange-50 text-orange-700 ring-orange-200/80",
    hex: "#F97316",
  },
} as const;

/** Normalize English/Spanish status keys to StatusKey */
export const NORMALIZE_STATUS: Record<string, StatusKey> = {
  confirmed: "confirmada",
  pending: "pendiente",
  attending: "atendiendo",
  attended: "atendida",
  completed: "atendida",
  cancelled: "cancelada",
  reprogramed: "reprogramada",
  confirmada: "confirmada",
  pendiente: "pendiente",
  atendiendo: "atendiendo",
  atendida: "atendida",
  completada: "atendida",
  cancelada: "cancelada",
  pausada: "pausada",
  pausado: "pausada",
  reprogramada: "reprogramada",
};
