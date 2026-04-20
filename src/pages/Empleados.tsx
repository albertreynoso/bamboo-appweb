import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  IdCard,
  AlertCircle,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  UserPlus,
  SlidersHorizontal,
  List,
  LayoutGrid,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { EmployeeWithStats, getRoleFromType, EMPLOYEE_TYPES } from "@/types/employee";
import { getAllEmployees, deleteEmployee } from "@/services/employeeService";
import EmployeeDialog from "@/components/employees/EmployeeDialog";
import EmployeeEditDialog from "@/components/employees/EmployeeEditDialog";
import ConfirmationDialog from "@/components/common/ConfirmationDialog";

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "No especificada";
  // Convertir YYYY-MM-DD a DD/MM/YYYY para mostrar
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

export default function Empleados() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"reciente" | "antiguo" | "apellido_az" | "apellido_za">("reciente");
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const show = useMinLoading(loading);
  const [refreshing, setRefreshing] = useState(false);
  const isInitialLoad = useRef(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para diálogos
  const [isNewEmployeeDialogOpen, setIsNewEmployeeDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Vista
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage, setEmployeesPerPage] = useState(10);

  const fetchEmployees = async () => {
    try {
      if (isInitialLoad.current) { setLoading(true); } else { setRefreshing(true); }
      setError(null);
      const employeesData = await getAllEmployees();
      setEmployees(employeesData);
    } catch (err) {
      console.error("Error al obtener empleados:", err);
      setError("Error al cargar los empleados. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isInitialLoad.current = false;
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleEditEmployee = (employee: EmployeeWithStats) => {
    setSelectedEmployee(employee);
    setIsEditDialogOpen(true);
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      setIsDeleting(true);
      await deleteEmployee(employeeToDelete);

      toast({
        title: "✅ Empleado eliminado",
        description: "El empleado ha sido eliminado permanentemente.",
      });

      fetchEmployees();
      setIsDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    } catch (error) {
      console.error("Error al eliminar empleado:", error);
      toast({
        title: "❌ Error",
        description: "No se pudo eliminar el empleado.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatSalary = (salary: number) => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(salary);
  };

  // Filtrado
  const filteredEmployees = employees.filter((emp) => {
    const searchLower = searchTerm.toLowerCase();
    const searchMatch =
      emp.fullName.toLowerCase().includes(searchLower) ||
      emp.dni_empleado.includes(searchTerm) ||
      emp.numero_telefonico.includes(searchTerm) ||
      emp.tipo_empleado_id.toLowerCase().includes(searchLower);

    const typeMatch = typeFilter === "all" || emp.tipo_empleado_id === typeFilter;

    return searchMatch && typeMatch;
  }).sort((a, b) => {
    switch (sortBy) {
      case "reciente": return new Date(b.fecha_contratacion || 0).getTime() - new Date(a.fecha_contratacion || 0).getTime();
      case "antiguo": return new Date(a.fecha_contratacion || 0).getTime() - new Date(b.fecha_contratacion || 0).getTime();
      case "apellido_az": return a.apellido_paterno.localeCompare(b.apellido_paterno, "es");
      case "apellido_za": return b.apellido_paterno.localeCompare(a.apellido_paterno, "es");
      default: return 0;
    }
  });

  const clearFilters = () => {
    setTypeFilter("all");
    setSearchTerm("");
    setSortBy("reciente");
    setCurrentPage(1);
  };

  const activeFiltersCount = [
    typeFilter !== "all",
    searchTerm !== "",
    sortBy !== "reciente",
  ].filter(Boolean).length;

  // Estadísticas
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.activo).length;

  // Paginación
  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const indexOfLastEmployee = currentPage * employeesPerPage;
  const indexOfFirstEmployee = indexOfLastEmployee - employeesPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstEmployee, indexOfLastEmployee);

  const nextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, sortBy]);

  if (show) return <PageLoader message="Cargando empleados..." />;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center relative z-20 pb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Empleados</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            Gestiona el personal de tu clínica dental
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
            onClick={() => setIsNewEmployeeDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Empleado
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
              {loading ? <span className="text-muted-foreground text-base">—</span> : totalEmployees}
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
              {loading ? <span className="text-muted-foreground text-base">—</span> : activeEmployees}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
              Activos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 flex-1">
          <div className="p-1.5 rounded-lg bg-violet-50 flex-none">
            <Search className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">
              {loading ? <span className="text-muted-foreground text-base">—</span> : filteredEmployees.length}
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
            placeholder="Buscar por nombre, DNI, teléfono o cargo..."
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

        {/* Type filter & Sort */}
        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-xs w-[160px]">
              <SelectValue placeholder="Tipo de empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {EMPLOYEE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground flex-none" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
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
        </div>

        {/* Clear */}
        {activeFiltersCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Error al cargar empleados</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchEmployees}
                className="ml-auto"
              >
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && employees.length === 0 && (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <Users className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">No hay empleados registrados</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Comienza agregando tu primer empleado
                </p>
              </div>
              <Button onClick={() => setIsNewEmployeeDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Empleado
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results State */}
      {!loading && !error && employees.length > 0 && filteredEmployees.length === 0 && (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <Search className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">No se encontraron resultados</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Intenta ajustar los filtros de búsqueda
                </p>
              </div>
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Employee table view ── */}
      {!loading && !error && currentEmployees.length > 0 && viewMode === "table" && (
        <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[200px] max-w-[200px]">Nombre</TableHead>
                  <TableHead className="w-[120px]">Cargo</TableHead>
                  <TableHead className="w-[100px]">DNI</TableHead>
                  <TableHead className="w-[120px]">Contacto</TableHead>
                  <TableHead className="w-[160px]">Dirección</TableHead>
                  <TableHead className="w-[110px]">F. Contrato</TableHead>
                  <TableHead className="w-[100px]">Sueldo</TableHead>
                  <TableHead className="w-[100px] text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentEmployees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-muted/20">
                    {/* Nombre */}
                    <TableCell className="w-[200px] max-w-[200px] overflow-hidden">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-none w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-1 ring-primary/20">
                          {employee.initials}
                        </div>
                        <div className="relative min-w-0 flex-1 overflow-hidden">
                          <span className="font-medium text-sm text-foreground whitespace-nowrap">
                            {employee.fullName}
                          </span>
                          <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent pointer-events-none" />
                        </div>
                      </div>
                    </TableCell>

                    {/* Cargo */}
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getRoleFromType(employee.tipo_empleado_id) || <span className="text-muted-foreground/40">—</span>}
                      </span>
                    </TableCell>

                    {/* DNI */}
                    <TableCell>
                      {employee.dni_empleado ? (
                        <span className="text-sm text-muted-foreground">{employee.dni_empleado}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Contacto */}
                    <TableCell>
                      {employee.numero_telefonico ? (
                        <span className="text-sm text-muted-foreground">{employee.numero_telefonico}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Dirección */}
                    <TableCell className="w-[160px] max-w-[160px] overflow-hidden">
                      <div className="relative overflow-hidden">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {employee.direccion || <span className="text-muted-foreground/40">—</span>}
                        </span>
                        {employee.direccion && (
                          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
                        )}
                      </div>
                    </TableCell>

                    {/* Fecha de contrato */}
                    <TableCell>
                      {employee.fecha_contratacion ? (
                        <span className="text-sm text-muted-foreground">{formatDate(employee.fecha_contratacion)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Sueldo */}
                    <TableCell>
                      {employee.salario != null ? (
                        <span className="text-sm font-medium text-foreground">{formatSalary(employee.salario)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right">
                      <Link
                        to={`/empleados/${employee.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:gap-1.5 transition-all duration-150"
                      >
                        Ver perfil
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Employee grid view ── */}
      {!loading && !error && currentEmployees.length > 0 && viewMode === "grid" && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {currentEmployees.map((employee) => (
            <Card key={employee.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-primary">
                      {employee.initials}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg truncate">
                      {employee.fullName}
                    </h3>
                    <Badge variant="secondary" className="mt-1">
                      {getRoleFromType(employee.tipo_empleado_id)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <IdCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">DNI: {employee.dni_empleado}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{employee.numero_telefonico}</span>
                  </div>
                  {employee.direccion && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">{employee.direccion}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Contratado: {formatDate(employee.fecha_contratacion)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-medium flex items-center gap-1 ${employee.activo ? "text-success" : "text-muted-foreground"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${employee.activo ? "bg-success" : "bg-muted-foreground"}`} />
                      {employee.activo ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-sm font-semibold text-foreground mt-1">
                      {formatSalary(employee.salario)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/empleados/${employee.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:gap-1.5 transition-all duration-150"
                    >
                      Ver perfil
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Paginación */}
      {!loading && !error && filteredEmployees.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Mostrando{" "}
            <span className="font-semibold text-foreground">
              {indexOfFirstEmployee + 1}–{Math.min(indexOfLastEmployee, filteredEmployees.length)}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-foreground">{filteredEmployees.length}</span> empleados
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
                      onClick={() => setCurrentPage(pageNumber)}
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
              value={employeesPerPage.toString()}
              onValueChange={(value) => {
                setEmployeesPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-7 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Diálogos */}
      <EmployeeDialog
        open={isNewEmployeeDialogOpen}
        onOpenChange={setIsNewEmployeeDialogOpen}
        onSuccess={fetchEmployees}
      />

      <EmployeeEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        employee={selectedEmployee}
        onSuccess={fetchEmployees}
      />

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setEmployeeToDelete(null);
        }}
        onConfirm={handleDeleteEmployee}
        title="¿Eliminar empleado?"
        description="Esta acción eliminará permanentemente el empleado del sistema. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
}
