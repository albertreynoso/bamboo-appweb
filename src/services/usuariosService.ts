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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Usuario } from "@/types/usuario";

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
  estado: "active" | "pending"
): Promise<void> => {
  await updateDoc(doc(db, "usuarios", uid), { estado });
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
    rol: "recepcionista" | "administrador";
  }
): Promise<void> => {
  await setDoc(doc(db, "usuarios", uid), {
    ...data,
    estado: "active",
    creadoEn: serverTimestamp(),
  });
};
