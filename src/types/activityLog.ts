import { Timestamp } from "firebase/firestore";

export interface CambioLog {
  campo: string;
  etiqueta: string;
  anterior: string;
  nuevo: string;
}

export interface LogActividad {
  id?: string;
  fecha: Timestamp;
  usuario_uid: string;
  usuario_nombre: string;
  usuario_rol: string;
  modulo: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  entidad_nombre?: string;
  paciente_nombre?: string;
  mensaje: string;
  cambios?: CambioLog[];
}

export type LogParams = {
  modulo: string;
  accion: string;
  entidad: string;
  entidad_id?: string;
  entidad_nombre?: string;
  paciente_nombre?: string;
  cambios?: CambioLog[];
};
