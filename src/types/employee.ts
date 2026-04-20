// src/types/employee.ts

export type Turno = { mañana: boolean; tarde: boolean };
export type HorarioValue = Record<string, Turno>;

export interface Employee {
  id?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  dni_empleado: string;
  edad?: string;
  fecha_nacimiento?: string;
  genero?: "Masculino" | "Femenino" | "Otro" | "";
  numero_telefonico: string;
  direccion?: string;
  tipo_empleado_id: "Administrativo" | "Odontólogo" | "Asistente" | "Recepcionista" | "Personal de servicio" | "";
  fecha_contratacion: string;
  salario: number;
  activo: boolean;
  notas?: string;
  fecha_creacion?: Date;
  horario?: HorarioValue;
}

export interface EmployeeWithStats extends Employee {
  fullName: string;
  initials: string;
}

// Función helper para mapear tipo de empleado a rol en español
export const getRoleFromType = (tipoEmpleado: string): string => {
  const roleMap: Record<string, string> = {
    "Administrativo": "Administrativo",
    "Odontólogo": "Odontólogo",
    "Asistente": "Asistente",
    "Recepcionista": "Recepcionista",
    "Personal de servicio": "Personal de servicio"
  };
  return roleMap[tipoEmpleado] || tipoEmpleado;
};

// Configuración de tipos de empleado
export const EMPLOYEE_TYPES = [
  { value: "Odontólogo", label: "Odontólogo" },
  { value: "Asistente", label: "Asistente" },
  { value: "Recepcionista", label: "Recepcionista" },
  { value: "Personal de servicio", label: "Personal de servicio" },
  { value: "Administrativo", label: "Administrativo" },
] as const;