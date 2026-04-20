import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Search,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  AlertTriangle,
  Users,
  UserPlus,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PatientDialog from "@/components/patients/PatientDialog";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/types/appointment";

interface PatientWithStats extends Patient {
  fullName: string;
  age: number | null;
  initials: string;
}

type SortBy = "reciente" | "antiguo" | "apellido_az" | "apellido_za";

const DATE_FILTER_OPTIONS = [
  { label: "Todos", value: "all" },
  { label: "Semana", value: "lastWeek" },
  { label: "Mes", value: "lastMonth" },
  { label: "3 meses", value: "last3Months" },
];

const AVATAR_PALETTES = [
  { bg: "bg-blue-100", text: "text-blue-700", ring: "ring-blue-200" },
  { bg: "bg-teal-100", text: "text-teal-700", ring: "ring-teal-200" },
  { bg: "bg-violet-100", text: "text-violet-700", ring: "ring-violet-200" },
  { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-200" },
  { bg: "bg-rose-100", text: "text-rose-700", ring: "ring-rose-200" },
  { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-200" },
  { bg: "bg-sky-100", text: "text-sky-700", ring: "ring-sky-200" },
  { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-200" },
];

function getAvatarPalette(name: string) {
  // Always returning primary theme palette
  return { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" };
}

const PROFILE_FIELDS: (keyof PatientWithStats)[] = [
  "nombre",
  "apellido_paterno",
  "apellido_materno",
  "dni_cliente",
  "celular",
  "email",
  "fecha_nacimiento",
  "sexo",
  "estado_civil",
  "direccion",
  "distrito_direccion",
  "ocupacion",
];

function calcProfileCompletion(patient: PatientWithStats): number {
  const filled = PROFILE_FIELDS.filter((field) => {
    const val = patient[field];
    if (val === null || val === undefined) return false;
    if (typeof val === "string") return val.trim() !== "";
    return true;
  }).length;
  return Math.round((filled / PROFILE_FIELDS.length) * 100);
}

export default function Pacientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("reciente");
  const [isNewPatientDialogOpen, setIsNewPatientDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [patientsPerPage, setPatientsPerPage] = useState(12);

  const [patients, setPatients] = useState<PatientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const show = useMinLoading(loading);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialLoad = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");

  const calculateAge = (fechaNacimiento: Date | undefined): number | null => {
    if (!fechaNacimiento) return null;
    const today = new Date();
    const birthDate =
      fechaNacimiento instanceof Date ? fechaNacimiento : new Date(fechaNacimiento);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const fetchPatients = async () => {
    try {
      if (isInitialLoad.current) { setLoading(true); } else { setRefreshing(true); }
      setError(null);
      const patientsRef = collection(db, "pacientes");
      const q = query(patientsRef, orderBy("fecha_creacion", "desc"));
      const querySnapshot = await getDocs(q);

      const patientsData: PatientWithStats[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const fechaNacimiento = data.fecha_nacimiento?.toDate();
        const fechaCreacion = data.fecha_creacion?.toDate() || new Date();
        const fullName =
          `${data.nombre} ${data.apellido_paterno} ${data.apellido_materno}`.trim();
        const age = data.edad || calculateAge(fechaNacimiento);
        const initials =
          `${data.nombre?.[0] || ""}${data.apellido_paterno?.[0] || ""}`.toUpperCase();

        return {
          id: doc.id,
          nombre: data.nombre || "",
          apellido_paterno: data.apellido_paterno || "",
          apellido_materno: data.apellido_materno || "",
          dni_cliente: data.dni_cliente || "",
          celular: data.celular || "",
          telefono_fijo: data.telefono_fijo || "",
          email: data.email || "",
          fecha_nacimiento: fechaNacimiento,
          edad: age,
          sexo: data.sexo || "",
          estado_civil: data.estado_civil || "",
          direccion: data.direccion || "",
          distrito_direccion: data.distrito_direccion || "",
          lugar_procedencia: data.lugar_procedencia || "",
          ocupacion: data.ocupacion || "",
          fecha_creacion: fechaCreacion,
          fullName,
          age,
          initials,
        };
      });

      setPatients(patientsData);
    } catch (err) {
      console.error("Error al obtener pacientes:", err);
      setError("Error al cargar los pacientes. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isInitialLoad.current = false;
    }
  };

  useEffect(() => { fetchPatients(); }, []);
  useEffect(() => { if (!isNewPatientDialogOpen) fetchPatients(); }, [isNewPatientDialogOpen]);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, dateFilter, sortBy]);

  const totalPacientes = patients.length;
  const pacientesUltimoMes = patients.filter((p) => {
    const diffDays = Math.floor(
      (new Date().getTime() - p.fecha_creacion.getTime()) / 86400000
    );
    return diffDays <= 30;
  }).length;

  const filteredPatients = useMemo(() => {
    const filtered = patients.filter((patient) => {
      const searchMatch =
        patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.celular.includes(searchTerm) ||
        patient.dni_cliente.includes(searchTerm);

      const dateMatch = (() => {
        if (dateFilter === "all") return true;
        const diffDays = Math.floor(
          (new Date().getTime() - patient.fecha_creacion.getTime()) / 86400000
        );
        switch (dateFilter) {
          case "lastWeek": return diffDays <= 7;
          case "lastMonth": return diffDays <= 30;
          case "last3Months": return diffDays <= 90;
          default: return true;
        }
      })();

      return searchMatch && dateMatch;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "reciente": return b.fecha_creacion.getTime() - a.fecha_creacion.getTime();
        case "antiguo": return a.fecha_creacion.getTime() - b.fecha_creacion.getTime();
        case "apellido_az": return a.apellido_paterno.localeCompare(b.apellido_paterno, "es");
        case "apellido_za": return b.apellido_paterno.localeCompare(a.apellido_paterno, "es");
        default: return 0;
      }
    });
  }, [patients, searchTerm, dateFilter, sortBy]);

  const clearFilters = () => {
    setDateFilter("all");
    setSearchTerm("");
    setSortBy("reciente");
    setCurrentPage(1);
  };
  const activeFiltersCount = [
    dateFilter !== "all",
    searchTerm !== "",
    sortBy !== "reciente",
  ].filter(Boolean).length;

  const totalPatients = filteredPatients.length;
  const totalPages = Math.ceil(totalPatients / patientsPerPage);
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  const nextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };
  const prevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };

  if (show) return <PageLoader message="Cargando pacientes..." />;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex justify-between items-center relative z-20 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Pacientes</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            Gestiona las fichas médicas del consultorio
            {refreshing && <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary flex-none" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setViewMode("table")}
              title="Vista lista"
              className={`p-1.5 rounded-md transition-all duration-150 ${viewMode === "table"
                ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Vista tarjetas"
              className={`p-1.5 rounded-md transition-all duration-150 ${viewMode === "grid"
                ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            onClick={() => setIsNewPatientDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Paciente
          </Button>
        </div>
      </div>

      {/* ── Stats — compact horizontal bar ── */}
      <div className="flex items-stretch divide-x divide-border/70 bg-card rounded-xl border border-border/70 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
          <div className="p-1.5 rounded-lg bg-primary/10 flex-none">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">
              {loading ? <span className="text-muted-foreground text-base">—</span> : totalPacientes}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
              Total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
          <div className="p-1.5 rounded-lg bg-emerald-50 flex-none">
            <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">
              {loading ? <span className="text-muted-foreground text-base">—</span> : pacientesUltimoMes}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
              Nuevos este mes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
          <div className="p-1.5 rounded-lg bg-violet-50 flex-none">
            <Search className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">
              {loading ? <span className="text-muted-foreground text-base">—</span> : filteredPatients.length}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
              En búsqueda
            </p>
          </div>
        </div>
      </div>

      {/* ── Controls: search (half width) + filters right ── */}
      <div className="flex gap-3 items-center flex-wrap">
        {/* Search — fixed half the row */}
        <div className="relative w-1/2 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nombre, DNI, email o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Time filter pills */}
        <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
          {DATE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 ${dateFilter === opt.value
                ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground flex-none" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-9 text-xs w-[148px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reciente">Más reciente</SelectItem>
              <SelectItem value="antiguo">Más antiguo</SelectItem>
              <SelectItem value="apellido_az">Apellido A–Z</SelectItem>
              <SelectItem value="apellido_za">Apellido Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear */}
        {activeFiltersCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <Card className="shadow-sm border-destructive/40">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-destructive/10 flex-none">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-destructive">Error al cargar pacientes</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchPatients} className="flex-none">
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty: no patients ── */}
      {!loading && !error && patients.length === 0 && (
        <Card className="shadow-sm border-border/70">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="p-4 rounded-2xl bg-muted">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">No hay pacientes registrados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Comienza agregando tu primer paciente
              </p>
            </div>
            <Button size="sm" onClick={() => setIsNewPatientDialogOpen(true)} className="gap-2 mt-1">
              <Plus className="h-4 w-4" />
              Nuevo Paciente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── No results ── */}
      {!loading && !error && patients.length > 0 && filteredPatients.length === 0 && (
        <Card className="shadow-sm border-border/70">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="p-4 rounded-2xl bg-muted">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Sin resultados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Intenta ajustar los filtros de búsqueda
              </p>
            </div>
            <button
              onClick={clearFilters}
              className="mt-1 text-xs font-semibold text-primary hover:underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          </CardContent>
        </Card>
      )}

      {/* ── Patient grid — 3 cols ── */}
      {!loading && !error && currentPatients.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentPatients.map((patient) => {
            const palette = getAvatarPalette(patient.nombre);
            const completion = calcProfileCompletion(patient);
            const isIncomplete = completion < 100;

            return (
              <Link key={patient.id} to={`/pacientes/${patient.id}`} className="group block">
                <Card className="h-full shadow-sm border-border/70 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <CardContent className="p-4 flex h-full">
                    <div className="flex items-center justify-between w-full gap-4">
                      {/* Left side: Avatar + User Info (Identity + DNI/Contact) */}
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div
                          className={`flex-none w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ring-1 ${palette.bg} ${palette.text} ${palette.ring}`}
                        >
                          {patient.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-foreground text-[15px] leading-tight truncate group-hover:text-primary transition-colors">
                            {patient.fullName}
                          </h3>
                          <div className="flex flex-col mt-1.5">
                            {patient.dni_cliente && (
                              <div className="flex items-center text-[11px] text-muted-foreground font-medium">
                                <span className="text-[10px] text-muted-foreground/50 mr-1.5 font-sans uppercase tracking-tight">DNI</span>
                                <span>{patient.dni_cliente}</span>
                              </div>
                            )}
                            {patient.celular && (
                              <div className="flex items-center text-[11px] text-muted-foreground font-medium">
                                <span className="text-[10px] text-muted-foreground/50 mr-1.5 font-sans uppercase tracking-tight">Contacto</span>
                                <span>{patient.celular}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Actions (Vertical Stack) */}
                      <div className="flex flex-col items-end flex-none gap-0.5">
                        <div
                          className="flex items-center gap-1 text-xs font-bold text-emerald-600 group-hover:gap-1.5 transition-all duration-200"
                        >
                          <span>Ver perfil</span>
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        </div>
                        {isIncomplete && (
                          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">
                            Perfil incompleto ({completion}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Patient table view ── */}
      {!loading && !error && currentPatients.length > 0 && viewMode === "table" && (
        <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[180px]">Nombre</TableHead>
                  <TableHead className="w-[90px]">DNI</TableHead>
                  <TableHead className="w-[90px]">Edad</TableHead>
                  <TableHead className="w-[90px]">Contacto</TableHead>
                  <TableHead className="w-[160px] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentPatients.map((patient) => {
                  const palette = getAvatarPalette(patient.nombre);
                  const completion = calcProfileCompletion(patient);
                  const isIncomplete = completion < 100;

                  return (
                    <TableRow key={patient.id} className="hover:bg-muted/20">
                      {/* Nombre */}
                      <TableCell className="w-[180px] max-w-[180px] overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex-none w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ring-1 ${palette.bg} ${palette.text} ${palette.ring}`}
                          >
                            {patient.initials}
                          </div>
                          <div className="relative min-w-0 flex-1 overflow-hidden">
                            <span className="font-medium text-sm text-foreground whitespace-nowrap">
                              {patient.fullName}
                            </span>
                            <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent pointer-events-none" />
                          </div>
                        </div>
                      </TableCell>

                      {/* DNI */}
                      <TableCell>
                        {patient.dni_cliente ? (
                          <span className="text-sm text-muted-foreground">{patient.dni_cliente}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      {/* Edad */}
                      <TableCell>
                        {patient.age != null ? (
                          <span className="text-sm text-muted-foreground">{patient.age} años</span>
                        ) : (
                          <span className="text-sm text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      {/* Contacto */}
                      <TableCell>
                        {patient.celular ? (
                          <span className="text-sm text-muted-foreground">{patient.celular}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground/40">—</span>
                        )}
                      </TableCell>

                      {/* Acción */}
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <Link
                            to={`/pacientes/${patient.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:gap-1.5 transition-all duration-150"
                          >
                            Ver perfil
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          </Link>
                          {isIncomplete && (
                            <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tight">
                              Perfil incompleto ({completion}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && totalPatients > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {indexOfFirstPatient + 1}–{Math.min(indexOfLastPatient, totalPatients)}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-foreground">{totalPatients}</span> pacientes
          </p>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNumber: number;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  const isActive = currentPage === pageNumber;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => paginate(pageNumber)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Por página:</span>
            <Select
              value={patientsPerPage.toString()}
              onValueChange={(value) => {
                setPatientsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <PatientDialog
        open={isNewPatientDialogOpen}
        onOpenChange={setIsNewPatientDialogOpen}
      />
    </div>
  );
}
