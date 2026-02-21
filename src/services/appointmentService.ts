// src/services/appointmentService.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  serverTimestamp,
  arrayUnion
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Appointment } from "@/types/appointment";

// ==================== CITAS ====================

export const createAppointment = async (
  appointmentData: Omit<Appointment, "id" | "fecha_creacion">,
  realizadoPor?: string
): Promise<string> => {
  try {
    const appointmentForFirebase: any = {
      fecha:                    Timestamp.fromDate(appointmentData.fecha),
      hora:                     appointmentData.hora,
      fecha_creacion:           serverTimestamp(),
      paciente_id:              appointmentData.paciente_id,
      paciente_nombre:          appointmentData.paciente_nombre,
      es_tratamiento:           appointmentData.es_tratamiento,
      tipo_consulta:            appointmentData.tipo_consulta,
      duracion:                 appointmentData.duracion,
      duracion_real:            appointmentData.duracion_real || "",
      hora_inicio_atencion:     appointmentData.hora_inicio_atencion || "",
      hora_fin_atencion:        appointmentData.hora_fin_atencion || "",
      atendido_por:             appointmentData.atendido_por || "",
      estado:                   appointmentData.estado,
      costo:                    appointmentData.costo || 0,
      pagado:                   appointmentData.pagado || false,
      notas_observaciones:      appointmentData.notas_observaciones || "",
      historial_estados: [{
        estado:        appointmentData.estado,
        fecha:         Timestamp.now(),
        realizado_por: realizadoPor || "Sistema",
        tipo:          "creacion",
      }],
    };

    if (appointmentData.es_tratamiento && appointmentData.tratamiento_id) {
      appointmentForFirebase.tratamiento_id     = appointmentData.tratamiento_id;
      appointmentForFirebase.tratamiento_nombre = appointmentData.tratamiento_nombre || "";
    }

    const docRef = await addDoc(collection(db, "citas"), appointmentForFirebase);
    return docRef.id;
  } catch (error: any) {
    console.error("Error al crear cita:", error);
    throw new Error(`Error al crear cita: ${error.message}`);
  }
};

export const updateAppointment = async (
  appointmentId: string,
  updates: Partial<Appointment>,
  realizadoPor?: string
): Promise<void> => {
  try {
    const appointmentRef = doc(db, "citas", appointmentId);
    const updateData: any = {};

    if (updates.fecha)                              updateData.fecha                    = Timestamp.fromDate(updates.fecha);
    if (updates.hora !== undefined)                 updateData.hora                     = updates.hora;
    if (updates.paciente_nombre !== undefined)      updateData.paciente_nombre          = updates.paciente_nombre;
    if (updates.es_tratamiento !== undefined)       updateData.es_tratamiento           = updates.es_tratamiento;
    if (updates.tipo_consulta !== undefined)        updateData.tipo_consulta            = updates.tipo_consulta;
    if (updates.tratamiento_id !== undefined)       updateData.tratamiento_id           = updates.tratamiento_id;
    if (updates.tratamiento_nombre !== undefined)   updateData.tratamiento_nombre       = updates.tratamiento_nombre;
    if (updates.duracion !== undefined)             updateData.duracion                 = updates.duracion;
    if (updates.duracion_real !== undefined)        updateData.duracion_real            = updates.duracion_real;
    if (updates.hora_inicio_atencion !== undefined) updateData.hora_inicio_atencion     = updates.hora_inicio_atencion;
    if (updates.hora_fin_atencion !== undefined)    updateData.hora_fin_atencion        = updates.hora_fin_atencion;
    if (updates.atendido_por !== undefined)         updateData.atendido_por             = updates.atendido_por;
    if (updates.estado !== undefined)               updateData.estado                   = updates.estado;
    if (updates.costo !== undefined)                updateData.costo                    = updates.costo;
    if (updates.pagado !== undefined)               updateData.pagado                   = updates.pagado;
    if (updates.notas_observaciones !== undefined)  updateData.notas_observaciones      = updates.notas_observaciones;

    if (updates.estado !== undefined) {
      const docSnap = await getDoc(appointmentRef);
      const existingHistorial: any[] = docSnap.data()?.historial_estados || [];
      const lastEntry = existingHistorial[existingHistorial.length - 1];

      if (!lastEntry || lastEntry.estado !== updates.estado) {
        updateData.historial_estados = arrayUnion({
          estado:        updates.estado,
          fecha:         Timestamp.now(),
          realizado_por: realizadoPor || "Sistema",
          tipo:          "cambio_estado",
        });
      }
    }

    await updateDoc(appointmentRef, updateData);
  } catch (error: any) {
    console.error("Error al actualizar cita:", error);
    throw new Error(`Error al actualizar cita: ${error.message}`);
  }
};

export const cancelAppointment = async (appointmentId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "citas", appointmentId));
  } catch (error: any) {
    console.error("Error al eliminar cita:", error);
    throw new Error(`Error al eliminar cita: ${error.message}`);
  }
};

export const getAppointmentsByPatientId = async (patientId: string) => {
  const appointmentsRef = collection(db, "citas");
  const q = query(appointmentsRef, where("paciente_id", "==", patientId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
};

export const getAllAppointments = async (): Promise<Appointment[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "citas"));
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id:             docSnap.id,
        ...data,
        fecha:          data.fecha?.toDate()          || new Date(),
        fecha_creacion: data.fecha_creacion?.toDate() || new Date(),
      } as Appointment;
    });
  } catch (error: any) {
    console.error("Error al obtener citas:", error);
    return [];
  }
};

export const getAppointmentsByPatient = async (patientId: string): Promise<Appointment[]> => {
  try {
    const q = query(collection(db, "citas"), where("paciente_id", "==", patientId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id:             docSnap.id,
        ...data,
        fecha:          data.fecha?.toDate()          || new Date(),
        fecha_creacion: data.fecha_creacion?.toDate() || new Date(),
      } as Appointment;
    });
  } catch (error: any) {
    console.error("Error al obtener citas del paciente:", error);
    return [];
  }
};

export const getAppointmentsByDate = async (date: Date): Promise<Appointment[]> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "citas"),
      where("fecha", ">=", Timestamp.fromDate(startOfDay)),
      where("fecha", "<=", Timestamp.fromDate(endOfDay))
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id:             docSnap.id,
        ...data,
        fecha:          data.fecha?.toDate()          || new Date(),
        fecha_creacion: data.fecha_creacion?.toDate() || new Date(),
      } as Appointment;
    });
  } catch (error: any) {
    console.error("Error al obtener citas por fecha:", error);
    return [];
  }
};
