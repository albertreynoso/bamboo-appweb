// src/services/configuracionService.ts
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CONSULTATION_TYPES } from "@/constants/appointmentConstants";

export interface ConsultationPrice {
  type: string;
  cost: number;
}

const COLLECTION = "configuracion";
const DOC_PRECIOS = "precios_consultas";

/** Builds the merged list: type names from constants, costs from Firestore */
function mergeWithDefaults(firestoreItems: ConsultationPrice[]): ConsultationPrice[] {
  return CONSULTATION_TYPES.map((c) => {
    const match = firestoreItems.find((p) => p.type === c.type);
    return { type: c.type, cost: match?.cost ?? c.cost };
  });
}

/** One-time fetch of consultation prices */
export const getConsultationPrices = async (): Promise<ConsultationPrice[]> => {
  const ref = doc(db, COLLECTION, DOC_PRECIOS);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data().tipos as ConsultationPrice[];
    return mergeWithDefaults(data);
  }
  return CONSULTATION_TYPES.map((c) => ({ type: c.type, cost: c.cost }));
};

/** Save consultation prices to Firestore */
export const saveConsultationPrices = async (
  tipos: ConsultationPrice[]
): Promise<void> => {
  const ref = doc(db, COLLECTION, DOC_PRECIOS);
  await setDoc(ref, { tipos, updatedAt: serverTimestamp() });
};

const DEFAULT_TIPOS: ConsultationPrice[] = CONSULTATION_TYPES.map((c) => ({
  type: c.type,
  cost: c.cost,
}));

/** Real-time subscription to consultation prices.
 *  If the Firestore document does not yet exist, it is created automatically
 *  with the default values so the data is always persisted. */
export const subscribeToConsultationPrices = (
  callback: (tipos: ConsultationPrice[]) => void
): (() => void) => {
  const ref = doc(db, COLLECTION, DOC_PRECIOS);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data().tipos as ConsultationPrice[];
      callback(mergeWithDefaults(data));
    } else {
      // Seed the document with defaults on first run
      setDoc(ref, { tipos: DEFAULT_TIPOS, updatedAt: serverTimestamp() });
      callback(DEFAULT_TIPOS);
    }
  });
};
