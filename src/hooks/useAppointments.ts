// src/hooks/useAppointments.ts
import { useState, useEffect } from "react";
import { getAllAppointments, getAppointmentsByDate } from "@/services/appointmentService";
import { Appointment } from "@/types/appointment";

export const useAppointments = (filterByDate?: Date) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = async () => {
    setLoading(true);
    setError(null);

    try {
      let data: Appointment[];

      if (filterByDate) {
        data = await getAppointmentsByDate(filterByDate);
      } else {
        data = await getAllAppointments();
      }

      setAppointments(data);
      return data;
    } catch (err: any) {
      console.error("Error al cargar citas:", err);
      setError(err.message || "Error al cargar las citas");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, [filterByDate]);

  const refetch = async () => {
    return await loadAppointments();
  };

  return {
    appointments,
    loading,
    error,
    refetch,
  };
};