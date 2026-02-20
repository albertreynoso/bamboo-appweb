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
  estado: 'pending' | 'active';
  creadoEn?: { seconds: number; nanoseconds: number } | null;
}
