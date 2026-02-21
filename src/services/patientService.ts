// src/services/patientService.ts
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types/appointment";
import { capitalizeName } from "@/utils/formatters";

export const createPatient = async (
  patientData: Omit<Patient, "id" | "fecha_creacion">
): Promise<string> => {
  try {
    const patientForFirebase = {
      nombre:              capitalizeName(patientData.nombre),
      apellido_paterno:    capitalizeName(patientData.apellido_paterno),
      apellido_materno:    capitalizeName(patientData.apellido_materno),
      dni_cliente:         patientData.dni_cliente,
      celular:             patientData.celular,
      email:               patientData.email?.toLowerCase() || "",
      edad:                patientData.edad || null,
      sexo:                patientData.sexo || "",
      direccion:           patientData.direccion || "",
      distrito_direccion:  patientData.distrito_direccion || "",
      estado_civil:        patientData.estado_civil || "",
      telefono_fijo:       patientData.telefono_fijo || "",
      ocupacion:           patientData.ocupacion || "",
      lugar_procedencia:   patientData.lugar_procedencia || "",
      fecha_creacion:      serverTimestamp(),
      fecha_nacimiento:    patientData.fecha_nacimiento
        ? Timestamp.fromDate(patientData.fecha_nacimiento)
        : null,
    };

    const docRef = await addDoc(collection(db, "pacientes"), patientForFirebase);
    return docRef.id;
  } catch (error: any) {
    throw new Error(`Error al crear paciente: ${error.message}`);
  }
};

export const findPatientByDNI = async (dni: string): Promise<Patient | null> => {
  try {
    const q = query(collection(db, "pacientes"), where("dni_cliente", "==", dni));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fecha_creacion:  data.fecha_creacion?.toDate()  || new Date(),
        fecha_nacimiento: data.fecha_nacimiento?.toDate() || undefined,
      } as Patient;
    }

    return null;
  } catch (error: any) {
    console.error("Error al buscar paciente por DNI:", error);
    return null;
  }
};

export const getAllPatients = async (): Promise<Patient[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "pacientes"));
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fecha_creacion:  data.fecha_creacion?.toDate()  || new Date(),
        fecha_nacimiento: data.fecha_nacimiento?.toDate() || undefined,
      } as Patient;
    });
  } catch (error: any) {
    console.error("Error al obtener pacientes:", error);
    return [];
  }
};

export const getPatientById = async (patientId: string): Promise<Patient | null> => {
  try {
    const docRef  = doc(db, "pacientes", patientId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        fecha_creacion:  data.fecha_creacion?.toDate()  || new Date(),
        fecha_nacimiento: data.fecha_nacimiento?.toDate() || undefined,
      } as Patient;
    }

    return null;
  } catch (error: any) {
    console.error("Error al obtener paciente por ID:", error);
    return null;
  }
};
