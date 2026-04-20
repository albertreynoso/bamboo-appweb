import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, DollarSign, Calendar, Stethoscope, ChevronRight, CheckCircle2, X, Wallet, User as UserIcon, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createConsultationPayment,
  createTreatmentPayment,
} from "@/services/paymentService";
import { CuotaCronograma, saveCronogramaDePagos } from "@/services/treatmentService";
import { formatCurrency, formatNotes, handleNotesKeyDown } from "@/utils/formatters";
import { useActivityLog } from "@/hooks/useActivityLog";

interface EffectiveCuota {
  numero: number;
  montoOriginal: number;
  montoEfectivo: number;
}

function computeEffectiveCuotas(
  cuotas: CuotaCronograma[],
  montoAbonado: number
): EffectiveCuota[] {
  let covered = montoAbonado;
  const result: EffectiveCuota[] = [];
  for (const cuota of cuotas) {
    if (covered >= cuota.monto) {
      covered -= cuota.monto;
    } else {
      result.push({
        numero: cuota.numero,
        montoOriginal: cuota.monto,
        montoEfectivo: cuota.monto - covered,
      });
      covered = 0;
    }
  }
  return result;
}

function buildUpdatedCuotas(
  cuotas: CuotaCronograma[],
  newMontoAbonado: number
): CuotaCronograma[] {
  let covered = newMontoAbonado;
  return cuotas.map((cuota) => {
    if (covered >= cuota.monto) {
      covered -= cuota.monto;
      return { ...cuota, estado: "pagado" as const };
    }
    return { ...cuota, estado: "pendiente" as const };
  });
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedPatientId?: string;
  preselectedPatientName?: string;
  preselectedType?: "consulta" | "tratamiento";
  preselectedReferenceId?: string;
}

interface Patient {
  id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  fullName: string;
  dni_cliente: string;
}

interface Consulta {
  id: string;
  tipo_consulta: string;
  fecha: Date;
  hora: string;
  costo: number;
  pagado: boolean;
}

interface Treatment {
  id: string;
  tratamiento: string;
  diagnostico: string;
  total_presupuesto: number;
  monto_abonado: number;
  pago_pendiente: number;
  pagado: boolean;
  cronograma_pagos: CuotaCronograma[];
}

export default function PaymentDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedPatientId,
  preselectedPatientName,
  preselectedType,
  preselectedReferenceId,
}: PaymentDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedType, setSelectedType] = useState<"consulta" | "tratamiento" | "">("");
  const [selectedReferenceId, setSelectedReferenceId] = useState("");
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [notas, setNotas] = useState("");
  const [activeTab, setActiveTab] = useState("consulta");

  const [submitting, setSubmitting] = useState(false);
  const { log } = useActivityLog();
  const [selectedCuotaNums, setSelectedCuotaNums] = useState<number[]>([]);

  // Búsqueda de pacientes
  const searchPatients = async (term: string) => {
    if (!term || term.length < 2) {
      setPatients([]);
      return;
    }

    try {
      setSearchingPatients(true);
      const patientsRef = collection(db, "pacientes");
      const q = query(patientsRef);
      const querySnapshot = await getDocs(q);

      const results: Patient[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const fullName = `${data.nombre || ""} ${data.apellido_paterno || ""} ${data.apellido_materno || ""}`.trim();

        if (
          fullName.toLowerCase().includes(term.toLowerCase()) ||
          data.dni_cliente?.includes(term)
        ) {
          results.push({
            id: doc.id,
            nombre: data.nombre || "",
            apellido_paterno: data.apellido_paterno || "",
            apellido_materno: data.apellido_materno || "",
            fullName,
            dni_cliente: data.dni_cliente || "",
          });
        }
      });

      setPatients(results);
    } catch (error) {
      console.error("Error al buscar pacientes:", error);
      toast({
        title: "Error",
        description: "No se pudo buscar pacientes",
        variant: "destructive",
      });
    } finally {
      setSearchingPatients(false);
    }
  };

  // Cargar consultas y tratamientos del paciente
  const loadPatientData = async (patientId: string) => {
    try {
      setLoadingData(true);

      // Cargar consultas no pagadas
      const consultasRef = collection(db, "citas");
      const qConsultas = query(
        consultasRef,
        where("paciente_id", "==", patientId),
        where("pagado", "==", false)
      );
      const consultasSnapshot = await getDocs(qConsultas);

      const estadosCobrables = ["confirmada", "atendiendo", "atendida", "completada"];
      const consultasData: Consulta[] = [];
      consultasSnapshot.forEach((doc) => {
        const data = doc.data();
        const estado = (data.estado || "").toLowerCase();
        if (data.costo && data.costo > 0 && estadosCobrables.includes(estado)) {
          consultasData.push({
            id: doc.id,
            tipo_consulta: data.tipo_consulta || "",
            fecha: data.fecha?.toDate ? data.fecha.toDate() : new Date(),
            hora: data.hora || "",
            costo: data.costo || 0,
            pagado: data.pagado || false,
          });
        }
      });

      // Cargar tratamientos no pagados completamente
      const treatmentsRef = collection(db, "tratamientos");
      const qTreatments = query(
        treatmentsRef,
        where("paciente_id", "==", patientId),
        where("pagado", "==", false)
      );
      const treatmentsSnapshot = await getDocs(qTreatments);

      const treatmentsData: Treatment[] = [];
      treatmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.pago_pendiente && data.pago_pendiente > 0 && data.estado !== "cancelado") {
          treatmentsData.push({
            id: doc.id,
            tratamiento: data.tratamiento || "",
            diagnostico: data.diagnostico || "",
            total_presupuesto: data.total_presupuesto || 0,
            monto_abonado: data.monto_abonado || 0,
            pago_pendiente: data.pago_pendiente || 0,
            pagado: data.pagado || false,
            cronograma_pagos: (data.cronograma_pagos as CuotaCronograma[]) || [],
          });
        }
      });

      setConsultas(consultasData);
      setTreatments(treatmentsData);
    } catch (error) {
      console.error("Error al cargar datos del paciente:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del paciente",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  // Efecto para búsqueda de pacientes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      searchPatients(searchTerm);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // Efecto para preselección
  useEffect(() => {
    if (open && preselectedPatientId && preselectedPatientName) {
      setSelectedPatient({
        id: preselectedPatientId,
        nombre: preselectedPatientName.split(" ")[0] || "",
        apellido_paterno: preselectedPatientName.split(" ")[1] || "",
        apellido_materno: preselectedPatientName.split(" ")[2] || "",
        fullName: preselectedPatientName,
        dni_cliente: "", // Will be loaded if needed, but usually preselected comes with enough info
      });
      loadPatientData(preselectedPatientId);

      if (preselectedType) {
        setSelectedType(preselectedType);
      }
      if (preselectedReferenceId) {
        setSelectedReferenceId(preselectedReferenceId);
      }
    }
  }, [open, preselectedPatientId, preselectedPatientName, preselectedType, preselectedReferenceId]);

  // Auto-update monto when cuotas are selected
  useEffect(() => {
    if (selectedType !== "tratamiento" || !selectedReferenceId) return;
    const treatment = treatments.find((t) => t.id === selectedReferenceId);
    if (!treatment) return;
    const effective = computeEffectiveCuotas(
      treatment.cronograma_pagos,
      treatment.monto_abonado
    );
    const selected = effective.filter((c) =>
      selectedCuotaNums.includes(c.numero)
    );
    if (selected.length > 0) {
      const total = selected.reduce((sum, c) => sum + c.montoEfectivo, 0);
      setMonto(total.toFixed(2));
    } else {
      setMonto("");
    }
  }, [selectedCuotaNums, selectedType, selectedReferenceId, treatments]);

  // Seleccionar paciente
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatients([]);
    setSearchTerm("");
    loadPatientData(patient.id);
  };

  // Seleccionar tipo y referencia
  const handleSelectReference = (type: "consulta" | "tratamiento", referenceId: string) => {
    setSelectedCuotaNums([]);
    setSelectedType(type);
    setSelectedReferenceId(referenceId);

    if (type === "consulta") {
      const consulta = consultas.find(c => c.id === referenceId);
      if (consulta) {
        setMonto(consulta.costo.toString());
      }
    } else {
      setMonto("");
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setSearchTerm("");
    setPatients([]);
    setSelectedPatient(null);
    setConsultas([]);
    setTreatments([]);
    setSelectedType("");
    setSelectedReferenceId("");
    setMonto("");
    setMetodoPago("");
    setNotas("");
    setSelectedCuotaNums([]);
  };

  // Validar formulario
  const validateForm = () => {
    if (!selectedPatient) {
      toast({
        title: "Error",
        description: "Debes seleccionar un paciente",
        variant: "destructive",
      });
      return false;
    }

    if (!selectedType || !selectedReferenceId) {
      toast({
        title: "Error",
        description: "Debes seleccionar una consulta o tratamiento",
        variant: "destructive",
      });
      return false;
    }

    if (!monto || parseFloat(monto) <= 0) {
      toast({
        title: "Error",
        description: "Debes ingresar un monto válido",
        variant: "destructive",
      });
      return false;
    }

    if (!metodoPago) {
      toast({
        title: "Error",
        description: "Debes seleccionar un método de pago",
        variant: "destructive",
      });
      return false;
    }

    // Validar monto para tratamiento
    if (selectedType === "tratamiento") {
      const treatment = treatments.find(t => t.id === selectedReferenceId);
      if (treatment && parseFloat(monto) > treatment.pago_pendiente) {
        toast({
          title: "Error",
          description: `El monto no puede ser mayor al pendiente (S/ ${treatment.pago_pendiente})`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const montoNumerico = parseFloat(monto);

      if (selectedType === "consulta") {
        const consulta = consultas.find(c => c.id === selectedReferenceId);
        await createConsultationPayment({
          consultaId: selectedReferenceId,
          referenciaNombre: consulta?.tipo_consulta || "Consulta",
          monto: montoNumerico,
          metodoPago,
          notas,
          pacienteId: selectedPatient!.id,
          pacienteNombre: selectedPatient!.fullName,
          creadoPor: "Usuario actual",
        });
      } else if (selectedType === "tratamiento") {
        const treatment = treatments.find(t => t.id === selectedReferenceId);
        await createTreatmentPayment({
          tratamientoId: selectedReferenceId,
          referenciaNombre: treatment?.tratamiento || "Tratamiento",
          monto: montoNumerico,
          metodoPago,
          notas,
          pacienteId: selectedPatient!.id,
          pacienteNombre: selectedPatient!.fullName,
          creadoPor: "Usuario actual",
          montoAbonadoActual: treatment?.monto_abonado || 0,
          pagoPendienteActual: treatment?.pago_pendiente || 0,
        });
        // Update cuota states in cronograma
        const treatment2 = treatments.find((t) => t.id === selectedReferenceId);
        if (treatment2?.cronograma_pagos?.length) {
          const newMontoAbonado = treatment2.monto_abonado + montoNumerico;
          const updatedCuotas = buildUpdatedCuotas(
            treatment2.cronograma_pagos,
            newMontoAbonado
          );
          await saveCronogramaDePagos(selectedReferenceId, updatedCuotas);
        }
      }

      toast({
        title: "✅ Pago registrado",
        description: "El pago se ha registrado correctamente",
      });

      log({
        modulo: "Pagos",
        accion: "registró",
        entidad: "pago",
        entidad_nombre: `S/ ${parseFloat(monto).toFixed(2)}`,
        paciente_nombre: selectedPatient?.fullName,
      });

      onSuccess();
      onOpenChange(false);
      resetForm();

    } catch (error) {
      console.error("Error al registrar pago:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo registrar el pago",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 border-none bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-white flex-none relative">
          <DialogTitle className="text-2xl font-semibold text-slate-900">
            Registrar Pago
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 rounded-full h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar space-y-8">
          {/* Búsqueda de Paciente */}
          {!selectedPatient ? (
            <div className="space-y-4 max-w-md mx-auto py-10">
              <div className="text-center space-y-2 mb-6">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <UserIcon className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Buscar un paciente</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Ingresa el nombre o DNI del paciente para gestionar sus pagos pendientes.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                  <Input
                    id="search-patient"
                    placeholder="Escribe nombre o DNI..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-primary/20 transition-all text-lg"
                    autoComplete="off"
                  />
                  {searchingPatients && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
                  )}
                </div>

                {/* Resultados de búsqueda */}
                {patients.length > 0 && (
                  <div className="border border-slate-100 rounded-2xl divide-y bg-white shadow-xl overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-300">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{patient.fullName}</p>
                          <p className="text-xs text-slate-500 font-mono tracking-wider">DNI: {patient.dni_cliente}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Paciente Seleccionado */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center justify-between group hover:border-primary/20 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                    {selectedPatient.nombre[0]}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Paciente seleccionado</p>
                    <p className="font-bold text-slate-900 text-lg leading-none">{selectedPatient.fullName}</p>
                  </div>
                </div>
                {!preselectedPatientId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 font-bold text-xs uppercase tracking-wider"
                    onClick={() => {
                      setSelectedPatient(null);
                      setConsultas([]);
                      setTreatments([]);
                      setSelectedType("");
                      setSelectedReferenceId("");
                      setMonto("");
                    }}
                  >
                    Cambiar
                  </Button>
                )}
              </div>

              {/* Cargando datos */}
              {loadingData ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <DollarSign className="h-5 w-5 text-primary absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Consultando Deudas...</p>
                </div>
              ) : (
                <>
                  {/* Container for Debts & Payments */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Stethoscope className="h-4 w-4 text-amber-500" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Concepto de Pago</h3>
                    </div>

                    {/* 2-column layout: left = selector+list, right = cuotas */}
                    <div className="grid grid-cols-2 gap-6 items-stretch min-h-[350px]">
                      {/* Left: Cuadro Integrado (Selector + Lista) */}
                      <div className="rounded-3xl border border-slate-100 bg-slate-50/50 overflow-hidden shadow-inner flex flex-col h-full border-2">
                        {/* Selector de Tipo */}
                        <div className="p-4 bg-white/60 border-b border-slate-200/50 flex justify-center shrink-0">
                          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="bg-slate-200/50 w-full p-1.5 h-12 rounded-xl border-none">
                              <TabsTrigger
                                value="consulta"
                                className={cn(
                                  "flex-1 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
                                  "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md",
                                  "data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Consultas
                              </TabsTrigger>
                              <TabsTrigger
                                value="tratamiento"
                                className={cn(
                                  "flex-1 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-300",
                                  "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md",
                                  "data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Tratamientos
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>
                        </div>

                        <ScrollArea className="flex-1 px-4 py-4">
                          <div className="space-y-3">
                            {/* Consultas Pendientes */}
                            {activeTab === "consulta" && (
                              <div className="space-y-3">
                                {consultas.length > 0 ? (
                                  <div className="space-y-3">
                                    {consultas.map((consulta) => (
                                      <button
                                        key={consulta.id}
                                        onClick={() => handleSelectReference("consulta", consulta.id)}
                                        className={cn(
                                          "w-full px-5 py-4 border-2 rounded-2xl text-left transition-all duration-300 bg-white flex items-center justify-between gap-4 group",
                                          selectedType === "consulta" && selectedReferenceId === consulta.id
                                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                                            : "border-slate-200/60 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.02]"
                                        )}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="font-extrabold text-slate-800 text-[13px] leading-snug group-hover:text-primary transition-colors">{consulta.tipo_consulta}</p>
                                          <div className="flex items-center gap-2 mt-1.5">
                                            <Calendar className="h-3 w-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                              {format(consulta.fecha, "d MMM, yyyy", { locale: es })}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                          <span className="text-[11px] font-black text-slate-900">
                                            {formatCurrency(consulta.costo)}
                                          </span>
                                          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center border-slate-200 group-hover:border-primary transition-all">
                                            {selectedType === "consulta" && selectedReferenceId === consulta.id && (
                                              <div className="h-2 w-2 rounded-full bg-primary animate-in zoom-in" />
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <EmptyState message="No hay consultas pendientes" />
                                )}
                              </div>
                            )}

                            {/* Tratamientos Pendientes */}
                            {activeTab === "tratamiento" && (
                              <div className="space-y-3">
                                {treatments.length > 0 ? (
                                  <div className="space-y-3">
                                    {treatments.map((treatment) => (
                                      <button
                                        key={treatment.id}
                                        onClick={() => handleSelectReference("tratamiento", treatment.id)}
                                        className={cn(
                                          "w-full px-5 py-4 border-2 rounded-2xl text-left transition-all duration-300 bg-white flex items-center justify-between gap-4 group",
                                          selectedType === "tratamiento" && selectedReferenceId === treatment.id
                                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                                            : "border-slate-200/60 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.02]"
                                        )}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <span className="font-extrabold text-slate-800 text-[13px] leading-snug block group-hover:text-primary transition-colors">
                                            {treatment.tratamiento}
                                          </span>
                                          <div className="flex items-center gap-2 mt-1.5">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo pendiente</span>
                                          </div>
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-1">
                                          <span className="text-[11px] font-black text-rose-500 tracking-tight">{formatCurrency(treatment.pago_pendiente)}</span>
                                          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center border-slate-200 group-hover:border-primary transition-all">
                                            {selectedType === "tratamiento" && selectedReferenceId === treatment.id && (
                                              <div className="h-2 w-2 rounded-full bg-primary animate-in zoom-in" />
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <EmptyState message="No hay saldos pendientes" />
                                )}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* Right: Cuotas panel */}
                      <div className="rounded-3xl border border-slate-100 bg-slate-50/50 overflow-hidden shadow-inner flex flex-col h-full border-2">
                        {/* Header — mirrors left panel tabs header */}
                        <div className="h-20 bg-white/60 border-b border-slate-200/50 flex flex-col justify-center items-center shrink-0 px-4 text-center">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                            Detalle de Deuda
                          </span>
                          <p className="text-[10px] font-bold text-slate-900 uppercase">
                            {activeTab === "consulta" ? "Liquidación única" : "Selección de cuotas"}
                          </p>
                        </div>

                        {/* Body — fills remaining height */}
                        <div className="flex-1 bg-white/30">
                          {activeTab === "consulta" ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 space-y-4">
                              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                                <CheckCircle2 className="h-6 w-6" />
                              </div>
                              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest text-center leading-loose">
                                Las consultas se cancelan<br />mediante un solo pago<br />del total presupuestado.
                              </p>
                            </div>
                          ) : selectedType === "tratamiento" && selectedReferenceId ? (
                            (() => {
                              const treatment = treatments.find((t) => t.id === selectedReferenceId);
                              const effective = computeEffectiveCuotas(
                                treatment?.cronograma_pagos || [],
                                treatment?.monto_abonado || 0
                              );
                              return effective.length > 0 ? (
                                <ScrollArea className="h-full px-4 py-4">
                                  <div className="space-y-3">
                                    {effective.map((cuota) => {
                                      const isSelected = selectedCuotaNums.includes(cuota.numero);
                                      return (
                                        <button
                                          key={cuota.numero}
                                          type="button"
                                          onClick={() =>
                                            setSelectedCuotaNums((prev) =>
                                              prev.includes(cuota.numero)
                                                ? prev.filter((n) => n !== cuota.numero)
                                                : [...prev, cuota.numero]
                                            )
                                          }
                                          className={cn(
                                            "w-full px-4 py-4 border-2 rounded-2xl text-left transition-all duration-300 bg-white flex items-center gap-4 group",
                                            isSelected
                                              ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                                              : "border-slate-200/60 hover:border-primary/40 hover:bg-primary/5 hover:scale-[1.02]"
                                          )}
                                        >
                                          {/* Selection square checkbox-like */}
                                          <div className={cn(
                                            "flex-none w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
                                            isSelected
                                              ? "border-primary bg-primary"
                                              : "border-slate-300 bg-white"
                                          )}>
                                            {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-extrabold text-slate-800 text-[13px] leading-tight">
                                              Cuota #{cuota.numero}
                                            </p>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200 mt-1.5">
                                              Vencida
                                            </span>
                                          </div>
                                          <div className="shrink-0 flex flex-col items-end gap-1">
                                            <span className="text-[11px] font-black text-slate-900 tracking-tight">
                                              {formatCurrency(cuota.montoEfectivo)}
                                            </span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center p-8 gap-4 opacity-50">
                                  <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                                    <CheckCircle2 className="h-6 w-6" />
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">
                                    Cronograma Completo
                                  </p>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center p-12 gap-6 group">
                              <div className="relative">
                                <Stethoscope className="h-12 w-12 text-slate-100 group-hover:text-slate-200 transition-colors duration-500" />
                                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                              </div>
                              <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em] select-none text-center leading-loose">
                                Selecciona un<br />tratamiento para<br />ver sus cuotas
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Formulario de Pago */}
                  {selectedType && selectedReferenceId && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Detalles de la Transacción</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="monto" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                            {selectedType === "consulta" ? "Total a Liquidar" : "Monto de Abono"}
                          </Label>
                          <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 group-focus-within:text-primary transition-colors pr-2 border-r border-slate-200 text-xs">S/</span>
                            <Input
                              id="monto"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={monto}
                              onChange={(e) => setMonto(e.target.value)}
                              className="pl-12 h-14 bg-slate-50 border-slate-200 rounded-2xl focus-visible:ring-primary/20 transition-all text-xl font-black text-slate-900"
                              disabled={selectedType === "consulta"}
                            />
                          </div>
                          {selectedType === "tratamiento" && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight ml-1 leading-relaxed">
                              * El abono se imputará a las cuotas seleccionadas
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="metodo-pago" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Medio de Pago</Label>
                          <Select value={metodoPago} onValueChange={setMetodoPago}>
                            <SelectTrigger id="metodo-pago" className="h-14 bg-slate-50 border-slate-200 rounded-2xl focus:ring-primary/20 transition-all font-bold text-slate-900">
                              <SelectValue placeholder="Seleccionar canal..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-slate-100 shadow-2xl p-2">
                              {["Yape o Plin", "Tarjeta", "Efectivo", "Transferencia"].map(m => (
                                <SelectItem key={m} value={m} className="rounded-xl py-3 font-bold text-slate-700 focus:bg-primary/5 focus:text-primary transition-colors mb-1 last:mb-0">
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="notas" className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                          <FileText className="h-3 w-3" />
                          Observaciones
                        </Label>
                        <Textarea
                          id="notas"
                          placeholder="Agrega una referencia o nota adicional aquí..."
                          value={notas}
                          onChange={(e) => setNotas(formatNotes(e.target.value))}
                          onKeyDown={(e) => handleNotesKeyDown(e, notas, setNotas)}
                          className="h-28 bg-slate-50 border-slate-200 rounded-2xl focus-visible:ring-primary/20 transition-all resize-none shadow-inner p-4"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white flex-none">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={submitting}
            className="rounded-xl h-11 px-6 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-medium"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedType || !selectedReferenceId}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando Pago...
              </>
            ) : (
              <>
                Completar Transacción
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 bg-white/50 rounded-2xl border border-dashed border-slate-200 mx-1">
      <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <p className="font-bold text-slate-500">{message}</p>
    </div>
  );
}
