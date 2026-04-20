import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Usuario, RolWeb } from "@/types/usuario";

export const getAllUsuarios = async (): Promise<Usuario[]> => {
  const q = query(collection(db, "usuarios"), orderBy("creadoEn", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as Omit<Usuario, "uid">),
  }));
};

export const subscribeToUsuarios = (
  callback: (users: Usuario[]) => void
): (() => void) => {
  const q = query(collection(db, "usuarios"), orderBy("creadoEn", "desc"));
  return onSnapshot(q, (snapshot) => {
    const users: Usuario[] = snapshot.docs.map((d) => ({
      uid: d.id,
      ...(d.data() as Omit<Usuario, "uid">),
    }));
    callback(users);
  });
};

export const actualizarEstadoUsuario = async (
  uid: string,
  estado: "active" | "pending",
  rol?: RolWeb
): Promise<void> => {
  const data: Record<string, unknown> = { estado };
  if (rol) data.rol = rol;
  await updateDoc(doc(db, "usuarios", uid), data);
};

export const saveUserProfile = async (
  uid: string,
  data: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno?: string;
    dni: string;
    telefono: string;
    direccion: string;
    fechaNacimiento: string;
    genero: string;
    rol: "recepcionista" | "admin";
    email?: string;
    plataforma_web?: boolean;
  }
): Promise<void> => {
  await setDoc(doc(db, "usuarios", uid), {
    ...data,
    estado: "active",
    creadoEn: serverTimestamp(),
  });
};

export const getUsuarioByUid = async (uid: string): Promise<Usuario | null> => {
  const docRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { uid: docSnap.id, ...(docSnap.data() as Omit<Usuario, "uid">) };
  }
  return null;
};

export const updateUsuario = async (
  uid: string,
  data: Partial<Usuario>
): Promise<void> => {
  await updateDoc(doc(db, "usuarios", uid), {
    ...data,
  });
};

export const deleteUsuario = async (uid: string): Promise<void> => {
  await deleteDoc(doc(db, "usuarios", uid));
};
