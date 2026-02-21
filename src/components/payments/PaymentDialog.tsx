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
import { Loader2, Search, DollarSign, Calendar, Stethoscope } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createConsultationPayment,
  createTreatmentPayment,
} from "@/services/paymentService";
import { formatCurrency } from "@/utils/formatters";

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
  
  const [submitting, setSubmitting] = useState(false);

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
      
      const estadosCobrables = ["confirmada", "completada"];
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

  // Seleccionar paciente
  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatients([]);
    setSearchTerm("");
    loadPatientData(patient.id);
  };

  // Seleccionar tipo y referencia
  const handleSelectReference = (type: "consulta" | "tratamiento", referenceId: string) => {
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
          consultaId:       selectedReferenceId,
          referenciaNombre: consulta?.tipo_consulta || "Consulta",
          monto:            montoNumerico,
          metodoPago,
          notas,
          pacienteId:       selectedPatient!.id,
          pacienteNombre:   selectedPatient!.fullName,
          creadoPor:        "Usuario actual",
        });
      } else if (selectedType === "tratamiento") {
        const treatment = treatments.find(t => t.id === selectedReferenceId);
        await createTreatmentPayment({
          tratamientoId:       selectedReferenceId,
          referenciaNombre:    treatment?.tratamiento || "Tratamiento",
          monto:               montoNumerico,
          metodoPago,
          notas,
          pacienteId:          selectedPatient!.id,
          pacienteNombre:      selectedPatient!.fullName,
          creadoPor:           "Usuario actual",
          montoAbonadoActual:  treatment?.monto_abonado || 0,
          pagoPendienteActual: treatment?.pago_pendiente || 0,
        });
      }

      toast({
        title: "✅ Pago registrado",
        description: "El pago se ha registrado correctamente",
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6 text-primary" />
            Registrar Pago
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Búsqueda de Paciente */}
          {!selectedPatient ? (
            <div className="space-y-3">
              <Label htmlFor="search-patient">Buscar Paciente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-patient"
                  placeholder="Buscar por nombre o DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                {searchingPatients && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Resultados de búsqueda */}
              {patients.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handleSelectPatient(patient)}
                      className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium text-foreground">{patient.fullName}</p>
                      <p className="text-sm text-muted-foreground">ID: {patient.id}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Paciente Seleccionado */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Paciente seleccionado:</p>
                    <p className="font-semibold text-lg text-foreground">{selectedPatient.fullName}</p>
                  </div>
                  {!preselectedPatientId && (
                    <Button
                      variant="ghost"
                      size="sm"
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
              </div>

              {/* Cargando datos */}
              {loadingData ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Cargando información...</p>
                </div>
              ) : (
                <>
                  {/* Consultas Pendientes */}
                  {consultas.length > 0 && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Consultas Pendientes de Pago
                      </Label>
                      <div className="space-y-2">
                        {consultas.map((consulta) => (
                          <button
                            key={consulta.id}
                            onClick={() => handleSelectReference("consulta", consulta.id)}
                            className={`w-full p-4 border rounded-lg text-left transition-all ${
                              selectedType === "consulta" && selectedReferenceId === consulta.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-semibold text-foreground">{consulta.tipo_consulta}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {consulta.fecha.toLocaleDateString('es-PE', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })} • {consulta.hora}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-primary">
                                  {formatCurrency(consulta.costo)}
                                </p>
                                <Badge variant="secondary" className="mt-1">Pendiente</Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tratamientos Pendientes */}
                  {treatments.length > 0 && (
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        Tratamientos con Saldo Pendiente
                      </Label>
                      <div className="space-y-2">
                        {treatments.map((treatment) => (
                          <button
                            key={treatment.id}
                            onClick={() => handleSelectReference("tratamiento", treatment.id)}
                            className={`w-full p-4 border rounded-lg text-left transition-all ${
                              selectedType === "tratamiento" && selectedReferenceId === treatment.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50 hover:bg-muted/30"
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold text-foreground">{treatment.tratamiento}</p>
                                  <p className="text-sm text-muted-foreground mt-1">{treatment.diagnostico}</p>
                                </div>
                                <Badge variant="secondary" className="ml-2">En progreso</Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Total:</p>
                                  <p className="font-semibold text-foreground">
                                    {formatCurrency(treatment.total_presupuesto)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Pagado:</p>
                                  <p className="font-semibold text-green-600">
                                    {formatCurrency(treatment.monto_abonado)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Pendiente:</p>
                                  <p className="font-semibold text-yellow-600">
                                    {formatCurrency(treatment.pago_pendiente)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sin pendientes */}
                  {consultas.length === 0 && treatments.length === 0 && (
                    <div className="text-center py-8">
                      <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="font-semibold text-foreground">No hay pagos pendientes</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Este paciente no tiene consultas ni tratamientos pendientes de pago
                      </p>
                    </div>
                  )}

                  {/* Formulario de Pago */}
                  {selectedType && selectedReferenceId && (
                    <>
                      <div className="space-y-3">
                        <Label htmlFor="monto">
                          {selectedType === "consulta" ? "Monto a Pagar" : "Monto a Abonar"}
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                            S/
                          </span>
                          <Input
                            id="monto"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            className="pl-10"
                            disabled={selectedType === "consulta"}
                          />
                        </div>
                        {selectedType === "tratamiento" && (
                          <p className="text-xs text-muted-foreground">
                            Puedes abonar el monto que desees hasta el total pendiente
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="metodo-pago">Método de Pago</Label>
                        <Select value={metodoPago} onValueChange={setMetodoPago}>
                          <SelectTrigger id="metodo-pago">
                            <SelectValue placeholder="Selecciona un método de pago" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yape o Plin">Yape o Plin</SelectItem>
                            <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                            <SelectItem value="Efectivo">Efectivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="notas">Notas (Opcional)</Label>
                        <Textarea
                          id="notas"
                          placeholder="Información adicional sobre el pago..."
                          value={notas}
                          onChange={(e) => setNotas(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              resetForm();
            }}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedType || !selectedReferenceId}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                Registrar Pago
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}