// src/services/treatmentService.ts
import {
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Treatment {
  id: string;
  tratamiento: string;
  diagnostico: string;
  cantidad_citas_planificadas: number;
  presupuesto: any[];
  total_presupuesto: number;
  monto_abonado: number;
  pago_pendiente: number;
  pagado: boolean;
  paciente_id: string;
  paciente_nombre: string;
  creador_id: string;
  creador_nombre: string;
  citas: string[];
  estado: string;
  fecha_creacion: Date;
  fecha_ultima_actualizacion: Date;
}

export interface CreateTreatmentInput {
  tratamiento: string;
  diagnostico: string;
  cantidad_citas_planificadas: number;
  presupuesto: any[];
  total_presupuesto: number;
  paciente_id: string;
  paciente_nombre: string;
}

export interface UpdateTreatmentInput {
  tratamiento: string;
  diagnostico: string;
  cantidad_citas_planificadas: number;
  presupuesto: any[];
  total_presupuesto: number;
  monto_abonado: number;
  estado: string;
}

export const getTreatmentsByPatientId = async (patientId: string): Promise<Treatment[]> => {
  try {
    const q = query(
      collection(db, "tratamientos"),
      where("paciente_id", "==", patientId)
    );
    const querySnapshot = await getDocs(q);

    const treatments: Treatment[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id:                         docSnap.id,
        tratamiento:                data.tratamiento || "",
        diagnostico:                data.diagnostico || "",
        cantidad_citas_planificadas: data.cantidad_citas_planificadas || 0,
        presupuesto:                data.presupuesto || [],
        total_presupuesto:          data.total_presupuesto || 0,
        monto_abonado:              data.monto_abonado || 0,
        pago_pendiente:             data.pago_pendiente || 0,
        pagado:                     data.pagado || false,
        paciente_id:                data.paciente_id || "",
        paciente_nombre:            data.paciente_nombre || "",
        creador_id:                 data.creador_id || "",
        creador_nombre:             data.creador_nombre || "",
        citas:                      data.citas || [],
        estado:                     data.estado || "activo",
        fecha_creacion:             data.fecha_creacion?.toDate ? data.fecha_creacion.toDate() : new Date(),
        fecha_ultima_actualizacion: data.fecha_ultima_actualizacion?.toDate
          ? data.fecha_ultima_actualizacion.toDate()
          : new Date(),
      };
    });

    treatments.sort((a, b) => b.fecha_creacion.getTime() - a.fecha_creacion.getTime());
    return treatments;
  } catch (error: any) {
    console.error("Error al cargar tratamientos:", error);
    return [];
  }
};

export const createTreatment = async (input: CreateTreatmentInput): Promise<string> => {
  try {
    const treatmentData = {
      tratamiento:                input.tratamiento,
      diagnostico:                input.diagnostico,
      cantidad_citas_planificadas: input.cantidad_citas_planificadas,
      presupuesto:                input.presupuesto,
      total_presupuesto:          input.total_presupuesto,
      monto_abonado:              0,
      pago_pendiente:             input.total_presupuesto,
      pagado:                     false,
      paciente_id:                input.paciente_id,
      paciente_nombre:            input.paciente_nombre,
      creador_id:                 "",
      creador_nombre:             "",
      citas:                      [],
      estado:                     "activo",
      fecha_creacion:             serverTimestamp(),
      fecha_ultima_actualizacion: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "tratamientos"), treatmentData);
    return docRef.id;
  } catch (error: any) {
    throw new Error(`Error al crear tratamiento: ${error.message}`);
  }
};

export const updateTreatment = async (
  treatmentId: string,
  input: UpdateTreatmentInput
): Promise<void> => {
  try {
    const pagoPendiente = input.total_presupuesto - input.monto_abonado;

    const treatmentData = {
      tratamiento:                input.tratamiento,
      diagnostico:                input.diagnostico,
      cantidad_citas_planificadas: input.cantidad_citas_planificadas,
      presupuesto:                input.presupuesto,
      total_presupuesto:          input.total_presupuesto,
      pago_pendiente:             pagoPendiente,
      pagado:                     pagoPendiente <= 0,
      estado:                     input.estado,
      fecha_ultima_actualizacion: serverTimestamp(),
    };

    await updateDoc(doc(db, "tratamientos", treatmentId), treatmentData);
  } catch (error: any) {
    throw new Error(`Error al actualizar tratamiento: ${error.message}`);
  }
};

export const deleteTreatment = async (treatmentId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "tratamientos", treatmentId));
  } catch (error: any) {
    throw new Error(`Error al eliminar tratamiento: ${error.message}`);
  }
};

export const updateTreatmentPayment = async (
  treatmentId: string,
  nuevoMontoAbonado: number,
  nuevoPagoPendiente: number,
  estaPagadoCompletamente: boolean
): Promise<void> => {
  try {
    await updateDoc(doc(db, "tratamientos", treatmentId), {
      monto_abonado:              nuevoMontoAbonado,
      pago_pendiente:             nuevoPagoPendiente,
      pagado:                     estaPagadoCompletamente,
      fecha_ultima_actualizacion: serverTimestamp(),
    });
  } catch (error: any) {
    throw new Error(`Error al actualizar pago del tratamiento: ${error.message}`);
  }
};
