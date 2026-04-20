// src/hooks/useConsultationPrices.ts
import { useState, useEffect } from "react";
import {
  subscribeToConsultationPrices,
  ConsultationPrice,
} from "@/services/configuracionService";
import { CONSULTATION_TYPES } from "@/constants/appointmentConstants";

const DEFAULTS: ConsultationPrice[] = CONSULTATION_TYPES.map((c) => ({
  type: c.type,
  cost: c.cost,
}));

export function useConsultationPrices() {
  const [prices, setPrices] = useState<ConsultationPrice[]>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToConsultationPrices((tipos) => {
      setPrices(tipos);
      setLoading(false);
    });
    return unsub;
  }, []);

  const getCostByType = (type: string): number =>
    prices.find((p) => p.type === type)?.cost ?? 0;

  return { prices, loading, getCostByType };
}
