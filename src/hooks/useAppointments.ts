// src/hooks/useAppointments.ts
import { useState, useEffect } from "react";
import { subscribeToAllAppointments } from "@/services/appointmentService";
import { Appointment } from "@/types/appointment";

export const useAppointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToAllAppointments(
      (data) => {
        setAppointments(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Error al cargar las citas");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // onSnapshot actualiza automáticamente — refetch se mantiene por compatibilidad
  const refetch = async () => appointments;

  return { appointments, loading, error, refetch };
};
