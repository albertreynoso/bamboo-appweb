// src/components/GoogleCalendarView.tsx
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  Stethoscope,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { APPOINTMENT_STATUS_CONFIG, NORMALIZE_STATUS } from "@/constants/appointmentConstants";

interface Appointment {
  id: string;
  time: string;
  patient: string;
  patientId: string;
  dentist: string;
  dentistId: string;
  treatment: string;
  duration: string;
  status: string;
  date: Date;
  notes?: string;
  color: string;
  // Nuevos campos para distinguir entre consulta y tratamiento
  isTreatment: boolean;
  treatmentName?: string;
  consultationType?: string;
}

interface GoogleCalendarViewProps {
  appointments: Appointment[];
  onSlotClick: (date: Date, time: string) => void;
  onNewAppointment: () => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const DEFAULT_COLOR = "#F59E0B";

const getStatusColor = (status: string): string => {
  const key = NORMALIZE_STATUS[status?.toLowerCase() || ''];
  return key ? APPOINTMENT_STATUS_CONFIG[key].hex : DEFAULT_COLOR;
};

const STATUS_LABELS: Record<string, string> = Object.fromEntries([
  ...Object.entries(APPOINTMENT_STATUS_CONFIG).map(([k, v]) => [k, v.label]),
  ["confirmed", "Confirmada"],
  ["pending", "Pendiente"],
  ["attending", "Atendiendo"],
  ["attended", "Atendida"],
  ["completed", "Atendida"],
  ["cancelled", "Cancelada"],
  ["reprogramed", "Reprogramada"],
]);

export default function GoogleCalendarView({
  appointments,
  onSlotClick,
  onNewAppointment,
  onAppointmentClick
}: GoogleCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState("week");
  const [hoveredAppointmentId, setHoveredAppointmentId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToCurrentTime = useRef(false);

  // Actualizar la hora actual cada 30 segundos para mantener la línea precisa
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Actualizar cada 30 segundos

    return () => clearInterval(timer);
  }, []);

  // ══════════ FILTRAR CITAS CANCELADAS ══════════
  // Las citas canceladas NO se muestran en el calendario
  const visibleAppointments = appointments.filter(apt => {
    const status = apt.status?.toLowerCase() || '';
    return status !== "cancelada" && status !== "cancelled";
  });

  // Generar horas de 7 AM a 12 AM (medianoche) con intervalos de 30 minutos
  const generateHours = () => {
    const hours = [];
    for (let i = 7; i <= 24; i++) {
      // Slot :00 - muestra la hora completa
      const period00 = i >= 12 && i < 24 ? 'PM' : 'AM';
      const displayHour00 = i === 12 ? 12 : i === 24 ? 12 : i > 12 ? i - 12 : i;
      hours.push({
        value: i,
        label: `${displayHour00} ${period00}`,  // Sin :00
        time: `${(i % 24).toString().padStart(2, '0')}:00`,
        showLabel: true  // Mostrar etiqueta
      });

      // Slot :30 (excepto para la última hora - medianoche)
      if (i < 24) {
        const period30 = i >= 12 && i < 24 ? 'PM' : 'AM';
        const displayHour30 = i === 12 ? 12 : i > 12 ? i - 12 : i;
        hours.push({
          value: i + 0.5,
          label: '',  // Sin etiqueta
          time: `${(i % 24).toString().padStart(2, '0')}:30`,
          showLabel: false  // No mostrar etiqueta
        });
      }
    }
    return hours;
  };

  const hours = generateHours();

  // Obtener días de la semana
  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const weekDays = getWeekDays();

  // Formatear rango de fechas
  const getDateRange = () => {
    const start = weekDays[0];
    const end = weekDays[6];
    if (start.getMonth() === end.getMonth()) {
      return format(start, "MMMM yyyy", { locale: es });
    }
    return `${format(start, "MMM", { locale: es })} – ${format(end, "MMM yyyy", { locale: es })}`;
  };

  // Navegación
  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isToday = (date: Date) => isSameDay(date, new Date());

  // Convertir hora string a minutos desde medianoche
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  // Verificar si dos citas se solapan
  const appointmentsOverlap = (apt1: Appointment, apt2: Appointment): boolean => {
    const start1 = timeToMinutes(apt1.time);
    const end1 = start1 + parseInt(apt1.duration);
    const start2 = timeToMinutes(apt2.time);
    const end2 = start2 + parseInt(apt2.duration);

    return start1 < end2 && start2 < end1;
  };

  // Asignar columnas a citas para evitar solapamiento
  const assignColumns = (appointments: Appointment[]): Map<string, number> => {
    const columnMap = new Map<string, number>();
    const columns: Appointment[][] = [[], [], [], []]; // 4 columnas disponibles

    // Ordenar por hora de inicio
    const sortedApts = [...appointments].sort((a, b) =>
      timeToMinutes(a.time) - timeToMinutes(b.time)
    );

    for (const apt of sortedApts) {
      // Buscar la primera columna donde no haya solapamiento
      let assignedColumn = -1;

      for (let col = 0; col < 4; col++) {
        const hasOverlap = columns[col].some(existingApt =>
          appointmentsOverlap(apt, existingApt)
        );

        if (!hasOverlap) {
          assignedColumn = col;
          columns[col].push(apt);
          break;
        }
      }

      // Si encontró columna libre, asignarla
      if (assignedColumn !== -1) {
        columnMap.set(apt.id, assignedColumn);
      }
    }

    return columnMap;
  };

  // Obtener citas para un slot horario específico (max 4)
  const getAppointmentsForSlot = (date: Date, time: string): Appointment[] => {
    const slotHour = parseInt(time.split(':')[0]);
    const slotMinutes = parseInt(time.split(':')[1] || '0');
    const slotStartMinutes = slotHour * 60 + slotMinutes;

    const slotAppointments = visibleAppointments.filter(apt => {
      if (!isSameDay(apt.date, date)) return false;

      // Una cita se muestra en este slot si EMPIEZA en esta hora exacta
      // (no importa cuánto dure, solo donde empieza)
      const aptStartMinutes = timeToMinutes(apt.time);
      return aptStartMinutes === slotStartMinutes;
    });

    return slotAppointments
      .sort((a, b) => {
        const minA = parseInt(a.time.split(':')[1] || '0');
        const minB = parseInt(b.time.split(':')[1] || '0');
        return minA - minB;
      })
      .slice(0, 4);
  };

  // Calcular altura del evento basado en duración real
  // Cada slot de 30 min = 72px → cada minuto = 2.4px
  const getEventHeight = (duration: string): number => {
    const minutes = parseInt(duration);
    return Math.max((minutes / 30) * 72 - 2, 18);
  };

  // Calcular posición de la línea de tiempo actual
  const getCurrentTimePosition = (): number => {
    // Usar la hora ACTUAL en tiempo real, no el estado
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Calcular minutos desde las 7 AM (inicio del calendario)
    const minutesSince7AM = (hours - 7) * 60 + minutes;

    // Cada 30 minutos = 72px
    return (minutesSince7AM / 30) * 72;
  };

  // Scroll automático a la hora actual al cargar
  useEffect(() => {
    if (!hasScrolledToCurrentTime.current && scrollContainerRef.current) {
      const currentPosition = getCurrentTimePosition();

      // Scroll para centrar la hora actual en la vista
      scrollContainerRef.current.scrollTop = Math.max(0, currentPosition - 200);
      hasScrolledToCurrentTime.current = true;
    }
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ══════════ HEADER / TOOLBAR ══════════ */}
      <div className="flex-shrink-0 border-b bg-card px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday} className="font-medium">
              Hoy
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="text-lg font-semibold capitalize text-foreground ml-2">
              {getDateRange()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onNewAppointment} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nueva Cita</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════ CALENDAR GRID ══════════ */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto">
        <div className="min-w-[800px] relative">
          {/* Encabezado de días */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b bg-card sticky top-0 z-[50]">
            <div className="p-3 border-r" />
            {weekDays.map((day, index) => {
              const dayName = format(day, "EEE", { locale: es }).toUpperCase();
              const dayNumber = format(day, "d");
              const todayClass = isToday(day) ? "text-primary" : "text-foreground";

              return (
                <div key={index} className="p-4 text-center border-r last:border-r-0">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    {dayName}
                  </div>
                  <div className={`text-2xl font-normal ${todayClass}`}>
                    {isToday(day) ? (
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground">
                        {dayNumber}
                      </span>
                    ) : (
                      dayNumber
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ══════════ FILAS DE HORAS ══════════ */}
          <div className="relative">
            {hours.map((hour, hourIndex) => (
              <div
                key={hourIndex}
                className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border/50"
                style={{ height: '72px' }}
              >
                {/* Label de hora */}
                <div className="text-right pr-4 pt-1 text-xs text-muted-foreground border-r">
                  {hour.label}
                </div>

                {/* Celdas de cada día */}
                {weekDays.map((day, dayIndex) => {
                  const slotAppointments = getAppointmentsForSlot(day, hour.time);

                  // Obtener todas las citas del día para calcular columnas
                  const dayAppointments = visibleAppointments.filter(apt => isSameDay(apt.date, day));
                  const columnAssignments = assignColumns(dayAppointments);

                  return (
                    <div
                      key={dayIndex}
                      className="border-r last:border-r-0 relative hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => onSlotClick(day, hour.time)}
                    >
                      {/* ══════════ 4 COLUMNAS INVISIBLES ══════════ */}
                      <div className="absolute inset-0 flex">
                        {[0, 1, 2, 3].map((colIndex) => {
                          // Encontrar la cita asignada a esta columna
                          const apt = slotAppointments.find(a => columnAssignments.get(a.id) === colIndex) || null;
                          const isHovered = apt !== null && hoveredAppointmentId === apt.id;
                          const aptColor = apt ? getStatusColor(apt.status) : DEFAULT_COLOR;

                          return (
                            <div
                              key={colIndex}
                              className="relative"
                              style={{ width: '25%' }}
                            >
                              {apt && (
                                <div
                                  ref={(el) => {
                                    if (el && isHovered) {
                                      // Calcular posición en viewport cuando hay hover
                                      const rect = el.getBoundingClientRect();
                                      const viewportHeight = window.innerHeight;
                                      const spaceAbove = rect.top;
                                      const spaceBelow = viewportHeight - rect.bottom;

                                      // Guardar en el elemento para acceder después
                                      (el as any)._tooltipPosition = spaceBelow > spaceAbove ? 'below' : 'above';
                                    }
                                  }}
                                  onMouseEnter={() => setHoveredAppointmentId(apt.id)}
                                  onMouseLeave={() => setHoveredAppointmentId(null)}
                                  className="absolute left-[2px] right-[2px]"
                                  style={{
                                    top: '2px',
                                  }}
                                >
                                  {/* ══════ BLOQUE DE CITA — color según estado ══════ */}
                                  <div
                                    data-apt-id={apt.id}
                                    className="rounded-md cursor-pointer transition-all duration-200 overflow-hidden"
                                    style={{
                                      height: `${getEventHeight(apt.duration)}px`,
                                      backgroundColor: aptColor,
                                      opacity: isHovered ? 1 : 0.8,
                                      boxShadow: isHovered
                                        ? `0 6px 20px -4px ${aptColor}80`
                                        : `0 1px 3px ${aptColor}25`,
                                      transform: isHovered ? 'scaleX(1.08)' : 'scaleX(1)',
                                      zIndex: isHovered ? 40 : 1,
                                      position: 'relative',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAppointmentClick(apt);
                                    }}
                                  >
                                    {NORMALIZE_STATUS[apt.status?.toLowerCase() || ''] === 'atendiendo' && (
                                      <div className="shimmer-base shimmer-atendiendo" />
                                    )}
                                  </div>

                                  {/* ══════ TOOLTIP EN HOVER ══════ */}
                                  {isHovered && (() => {
                                    // Obtener la posición calculada del ref
                                    const tooltipPosition = (document.querySelector(`[data-apt-id="${apt.id}"]`)?.parentElement as any)?._tooltipPosition || 'below';
                                    const showBelow = tooltipPosition === 'below';
                                    const showAbove = tooltipPosition === 'above';

                                    return (
                                      <div
                                        className="absolute z-50 pointer-events-none"
                                        style={{
                                          ...(showAbove && { bottom: `${getEventHeight(apt.duration) + 8}px` }),
                                          ...(showBelow && { top: `${getEventHeight(apt.duration) + 8}px` }),
                                          left: '50%',
                                          transform: 'translateX(-50%)',
                                        }}
                                      >
                                        <div
                                          className="bg-popover text-popover-foreground border border-border rounded-lg shadow-xl p-3 relative"
                                          style={{ width: '230px' }}
                                        >
                                          {/* Flecha - apunta siempre hacia la cita */}
                                          {showAbove && (
                                            /* Tooltip arriba → flecha abajo (apunta a la cita) */
                                            <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-popover border-r border-b border-border" />
                                          )}
                                          {showBelow && (
                                            /* Tooltip abajo → flecha arriba (apunta a la cita) */
                                            <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-popover border-l border-t border-border" />
                                          )}

                                          {/* Nombre del paciente */}
                                          <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-border/60">
                                            <div
                                              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                              style={{ backgroundColor: `${aptColor}1A` }}
                                            >
                                              <User className="h-3.5 w-3.5" style={{ color: aptColor }} />
                                            </div>
                                            <p className="font-semibold text-sm text-foreground truncate leading-tight">
                                              {apt.patient}
                                            </p>
                                          </div>

                                          {/* Consulta / Tratamiento */}
                                          <div className="flex items-start gap-2 mb-2">
                                            <Stethoscope
                                              className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                                              style={{ color: aptColor }}
                                            />
                                            <div className="min-w-0">
                                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
                                                {apt.isTreatment ? 'Tratamiento' : 'Consulta'}
                                              </p>
                                              <p className="text-xs font-medium text-foreground truncate mt-0.5">
                                                {apt.isTreatment ? apt.treatmentName : apt.consultationType}
                                              </p>
                                            </div>
                                          </div>

                                          {/* Estado + Hora */}
                                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                            <div className="flex items-center gap-1.5">
                                              <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: aptColor }}
                                              />
                                              <span className="text-[11px] font-semibold" style={{ color: aptColor }}>
                                                {STATUS_LABELS[apt.status] || apt.status}
                                              </span>
                                            </div>
                                            <span className="text-[11px] text-muted-foreground font-medium">
                                              {apt.time} · {apt.duration}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ══════════ LÍNEA DE TIEMPO ACTUAL ══════════ */}
          {(() => {
            const now = new Date();
            const currentHour = now.getHours();
            return currentHour >= 7 && currentHour <= 23;
          })() && (
              <div
                className="absolute pointer-events-none z-30"
                style={{
                  top: `${getCurrentTimePosition()}px`,
                  left: '80px', // Empieza después de la columna de hora
                  right: 0,
                }}
              >
                {/* Línea horizontal */}
                <div className="relative">
                  {/* La línea - solo los 7 días */}
                  <div className="grid grid-cols-7">
                    {weekDays.map((day, index) => {
                      const isCurrentDay = isSameDay(day, currentTime);
                      return (
                        <div
                          key={index}
                          className="relative"
                        >
                          {isCurrentDay && (
                            <>
                              {/* Círculo al inicio */}
                              <div className="absolute -left-[6px] -top-[6px] w-3 h-3 bg-red-500 rounded-full shadow-lg z-10" />
                              {/* Línea gruesa en el día actual - centrada verticalmente */}
                              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-red-500 shadow-md" />
                            </>
                          )}
                          {!isCurrentDay && (
                            /* Línea delgada en otros días - centrada verticalmente */
                            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-red-400/40" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          {/* ══════════ LEYENDA DE ESTADOS (Flotante en esquina inferior derecha) ══════════ */}
          <div className="fixed bottom-6 right-6 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 z-40">
            <div className="flex flex-col gap-2">
              {[
                { label: "Pendiente", color: "#F59E0B" },
                { label: "Confirmada", color: "#10B981" },
                { label: "Atendida", color: "#6B7280" },
                { label: "Reprogramada", color: "#F97316" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}