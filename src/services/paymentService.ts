// src/services/paymentService.ts
import {
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { updateTreatmentPayment } from "./treatmentService";

export interface Payment {
  id: string;
  monto: number;
  metodo_pago: string;
  fecha: Date;
  concepto: string;
  tipo: "consulta" | "tratamiento";
  referencia_id: string;
  referencia_nombre: string;
  paciente_id: string;
  paciente_nombre: string;
  creado_por: string;
  notas: string;
}

export const getAllPayments = async (): Promise<Payment[]> => {
  try {
    const q = query(collection(db, "pagos"), orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id:                docSnap.id,
        monto:             data.monto || 0,
        metodo_pago:       data.metodo_pago || "",
        fecha:             data.fecha?.toDate ? data.fecha.toDate() : new Date(),
        concepto:          data.concepto || "",
        tipo:              data.tipo || "consulta",
        referencia_id:     data.referencia_id || "",
        referencia_nombre: data.referencia_nombre || "",
        paciente_id:       data.paciente_id || "",
        paciente_nombre:   data.paciente_nombre || "",
        creado_por:        data.creado_por || "",
        notas:             data.notas || "",
      } as Payment;
    });
  } catch (error: any) {
    console.error("Error al cargar pagos:", error);
    return [];
  }
};

export const getPaymentsByPatientId = async (patientId: string): Promise<Payment[]> => {
  try {
    const q = query(
      collection(db, "pagos"),
      where("paciente_id", "==", patientId)
    );
    const querySnapshot = await getDocs(q);

    const payments: Payment[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id:                docSnap.id,
        monto:             data.monto || 0,
        metodo_pago:       data.metodo_pago || "",
        fecha:             data.fecha?.toDate ? data.fecha.toDate() : new Date(),
        concepto:          data.concepto || "",
        tipo:              data.tipo || "consulta",
        referencia_id:     data.referencia_id || "",
        referencia_nombre: data.referencia_nombre || "",
        paciente_id:       data.paciente_id || "",
        paciente_nombre:   data.paciente_nombre || "",
        creado_por:        data.creado_por || "",
        notas:             data.notas || "",
      } as Payment;
    });

    payments.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return payments;
  } catch (error: any) {
    console.error("Error al cargar pagos del paciente:", error);
    return [];
  }
};

export interface CreateConsultationPaymentInput {
  consultaId: string;
  referenciaNombre: string;
  monto: number;
  metodoPago: string;
  notas: string;
  pacienteId: string;
  pacienteNombre: string;
  creadoPor: string;
}

export const createConsultationPayment = async (
  input: CreateConsultationPaymentInput
): Promise<void> => {
  const pagoData = {
    monto:             input.monto,
    metodo_pago:       input.metodoPago,
    fecha:             serverTimestamp(),
    concepto:          `Pago de consulta: ${input.referenciaNombre}`,
    tipo:              "consulta",
    referencia_id:     input.consultaId,
    referencia_nombre: input.referenciaNombre,
    paciente_id:       input.pacienteId,
    paciente_nombre:   input.pacienteNombre,
    creado_por:        input.creadoPor,
    notas:             input.notas || "",
  };

  await addDoc(collection(db, "pagos"), pagoData);

  await updateDoc(doc(db, "citas", input.consultaId), {
    pagado:     true,
    fecha_pago: serverTimestamp(),
  });
};

export interface CreateTreatmentPaymentInput {
  tratamientoId: string;
  referenciaNombre: string;
  monto: number;
  metodoPago: string;
  notas: string;
  pacienteId: string;
  pacienteNombre: string;
  creadoPor: string;
  montoAbonadoActual: number;
  pagoPendienteActual: number;
}

export const createTreatmentPayment = async (
  input: CreateTreatmentPaymentInput
): Promise<void> => {
  const nuevoMontoAbonado    = input.montoAbonadoActual  + input.monto;
  const nuevoPagoPendiente   = input.pagoPendienteActual - input.monto;
  const estaPagadoCompletamente = nuevoPagoPendiente <= 0;

  const pagoData = {
    monto:             input.monto,
    metodo_pago:       input.metodoPago,
    fecha:             serverTimestamp(),
    concepto:          `Abono a tratamiento: ${input.referenciaNombre}`,
    tipo:              "tratamiento",
    referencia_id:     input.tratamientoId,
    referencia_nombre: input.referenciaNombre,
    paciente_id:       input.pacienteId,
    paciente_nombre:   input.pacienteNombre,
    creado_por:        input.creadoPor,
    notas:             input.notas || "",
  };

  await addDoc(collection(db, "pagos"), pagoData);

  await updateTreatmentPayment(
    input.tratamientoId,
    nuevoMontoAbonado,
    nuevoPagoPendiente,
    estaPagadoCompletamente
  );
};
