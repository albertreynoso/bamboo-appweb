// src/services/documentosService.ts
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const CLOUDINARY_CLOUD = "dmhnzseuj";
const CLOUDINARY_PRESET = "uw36vugh";

export interface EmpleadoDocumento {
  id?: string;
  titulo: string;
  descripcion: string;
  archivo_url: string;
  archivo_nombre: string;
  archivo_tipo: "pdf" | "imagen";
  archivo_mime: string;
  storage_path: string; // public_id de Cloudinary
  tamaño: number;
  fecha_subida: Date;
}

const subcoleccion = (empleadoId: string) =>
  collection(db, "personal", empleadoId, "documentos");

/** Sube el archivo a Cloudinary y guarda metadatos en Firestore.
 *  Llama a onProgress(0-100) durante la subida. */
export const subirDocumento = (
  empleadoId: string,
  file: File,
  titulo: string,
  descripcion: string,
  onProgress: (pct: number) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const esImagen = ["png", "jpg", "jpeg"].includes(ext);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    formData.append("folder", `empleados/${empleadoId}`);

    const resourceType = esImagen ? "image" : "raw";
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = async () => {
      if (xhr.status !== 200) {
        reject(new Error(`Cloudinary error: ${xhr.status}`));
        return;
      }
      try {
        const res = JSON.parse(xhr.responseText);
        await addDoc(subcoleccion(empleadoId), {
          titulo,
          descripcion,
          archivo_url: res.secure_url,
          archivo_nombre: file.name,
          archivo_tipo: esImagen ? "imagen" : "pdf",
          archivo_mime: file.type,
          storage_path: res.public_id,
          tamaño: file.size,
          fecha_subida: serverTimestamp(),
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => reject(new Error("Error de red al subir el archivo"));
    xhr.send(formData);
  });

/** Elimina el documento de Firestore (Cloudinary no se borra desde el cliente con preset unsigned). */
export const eliminarDocumento = async (
  empleadoId: string,
  documento: EmpleadoDocumento
): Promise<void> => {
  await deleteDoc(doc(db, "personal", empleadoId, "documentos", documento.id!));
};

/** Suscripción en tiempo real a los documentos del empleado. */
export const suscribirDocumentos = (
  empleadoId: string,
  callback: (docs: EmpleadoDocumento[]) => void
): (() => void) => {
  const q = query(subcoleccion(empleadoId), orderBy("fecha_subida", "desc"));
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          fecha_subida: data.fecha_subida?.toDate?.() ?? new Date(),
        } as EmpleadoDocumento;
      })
    );
  });
};
