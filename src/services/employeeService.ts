// src/services/employeeService.ts
import {
  collection,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Employee, EmployeeWithStats } from "@/types/employee";

export const createEmployee = async (
  data: Omit<Employee, "id" | "fecha_creacion">
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, "personal"), {
      ...data,
      fecha_creacion: serverTimestamp(),
    });
    return docRef.id;
  } catch (error: any) {
    console.error("Error al crear empleado:", error);
    throw new Error(error.message || "Error al crear empleado");
  }
};

export const getAllEmployees = async (): Promise<EmployeeWithStats[]> => {
  try {
    const snapshot = await getDocs(collection(db, "personal"));
    const employees = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      const fullName = `${d.nombre || ""} ${d.apellido_paterno || ""} ${d.apellido_materno || ""}`.trim();
      const initials = `${d.nombre?.[0] || ""}${d.apellido_paterno?.[0] || ""}`.toUpperCase();
      return {
        id: docSnap.id,
        nombre: d.nombre || "",
        apellido_paterno: d.apellido_paterno || "",
        apellido_materno: d.apellido_materno || "",
        dni_empleado: d.dni_empleado || "",
        edad: d.edad || "",
        fecha_nacimiento: d.fecha_nacimiento || "",
        genero: d.genero || "",
        numero_telefonico: d.numero_telefonico || "",
        direccion: d.direccion || "",
        tipo_empleado_id: d.tipo_empleado_id || "",
        fecha_contratacion: d.fecha_contratacion || "",
        salario: d.salario || 0,
        activo: d.activo ?? true,
        notas: d.notas || "",
        fecha_creacion: d.fecha_creacion?.toDate?.() || new Date(),
        fullName,
        initials,
      } as EmployeeWithStats;
    });

    // Ordenar client-side para evitar problemas de índices en Firestore
    return employees.sort((a, b) => {
      const dateA = a.fecha_creacion instanceof Date ? a.fecha_creacion.getTime() : 0;
      const dateB = b.fecha_creacion instanceof Date ? b.fecha_creacion.getTime() : 0;
      return dateB - dateA;
    });
  } catch (error: any) {
    console.error("Error al obtener empleados:", error);
    throw new Error(error.message || "Error al obtener empleados");
  }
};

export const updateEmployee = async (
  id: string,
  data: Partial<Omit<Employee, "id" | "fecha_creacion">>
): Promise<void> => {
  try {
    await updateDoc(doc(db, "personal", id), data);
  } catch (error: any) {
    console.error("Error al actualizar empleado:", error);
    throw new Error(error.message || "Error al actualizar empleado");
  }
};

export const deleteEmployee = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "personal", id));
  } catch (error: any) {
    console.error("Error al eliminar empleado:", error);
    throw new Error(error.message || "Error al eliminar empleado");
  }
};
