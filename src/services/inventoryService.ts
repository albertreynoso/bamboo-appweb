import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InventoryItemType, InventoryItemFormValues } from "@/types/inventory";

const COLLECTION_NAME = "inventory";

// Obtener todos los ítems del inventario
export const getInventoryItems = async (): Promise<InventoryItemType[]> => {
    const q = query(collection(db, COLLECTION_NAME), orderBy("fecha_registro", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as InventoryItemType[];
};

// Crear un nuevo ítem en el inventario
export const createInventoryItem = async (data: InventoryItemFormValues): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        fecha_registro: new Date().toISOString(),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

// Actualizar un ítem existente
export const updateInventoryItem = async (id: string, data: Partial<InventoryItemFormValues>): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
};

// Eliminar un ítem del inventario
export const deleteInventoryItem = async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
};

// Ajuste rápido de stock (sumar o restar al stock actual) para productos de rotación
export const adjustStock = async (id: string, amount: number): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
        stock_actual: increment(amount),
        updatedAt: serverTimestamp(),
    });
};
