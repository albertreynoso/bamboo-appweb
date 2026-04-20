import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LogActividad } from "@/types/activityLog";

export const registrarLog = async (
  data: Omit<LogActividad, "id" | "fecha">
): Promise<void> => {
  // Firestore rejects undefined values — strip them before writing
  const clean = Object.fromEntries(
    Object.entries({ ...data, fecha: serverTimestamp() }).filter(([, v]) => v !== undefined)
  );
  try {
    await addDoc(collection(db, "logs_actividad"), clean);
  } catch (err: any) {
    // Silent fail — logging must never break the app flow
    console.error("[ActivityLog] Error al registrar log:", err?.code, err?.message, err);
  }
};

export const suscribirLogs = (
  callback: (logs: LogActividad[]) => void
): (() => void) => {
  const q = query(
    collection(db, "logs_actividad"),
    orderBy("fecha", "desc"),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      const logs: LogActividad[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LogActividad, "id">),
      }));
      callback(logs);
    },
    (err) => {
      console.error("[ActivityLog] Error al leer logs:", err?.code, err?.message);
    }
  );
};

export const suscribirLogsPorUsuario = (
  uid: string,
  callback: (logs: LogActividad[]) => void
): (() => void) => {
  const q = query(
    collection(db, "logs_actividad"),
    where("usuario_uid", "==", uid),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const logs: LogActividad[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LogActividad, "id">),
      }));
      callback(logs);
    },
    (err) => {
      console.error("[ActivityLog] Error al leer logs de usuario:", err?.code, err?.message);
    }
  );
};
