export type RolWeb   = 'admin' | 'recepcionista';
export type RolMovil = 'paciente' | 'odontologo' | 'asistente';
export type Rol      = RolWeb | RolMovil;

export interface Usuario {
  uid: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  dni: string;
  telefono: string;
  direccion?: string;
  fechaNacimiento?: string;
  genero?: string;
  rol?: Rol;
  estado: 'pending' | 'active';
  email?: string;
  plataforma_web?: boolean;
  creadoEn?: { seconds: number; nanoseconds: number } | null;
}
