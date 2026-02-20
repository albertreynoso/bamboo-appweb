import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  IdCard,
  Loader2,
  AlertCircle,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { EmployeeWithStats, getRoleFromType } from "@/types/employee";
import { getAllEmployees, deleteEmployee } from "@/services/employeeService";
import EmployeeDialog from "@/components/EmployeeDialog";
import EmployeeEditDialog from "@/components/EmployeeEditDialog";
import ConfirmationDialog from "@/components/ConfirmationDialog";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para diálogos
  const [isNewEmployeeDialogOpen, setIsNewEmployeeDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage, setEmployeesPerPage] = useState(10);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const employeesData = await getAllEmployees();
      setEmployees(employeesData);
    } catch (err) {
      console.error("Error al obtener empleados:", err);
      setError("Error al cargar los empleados. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
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

    const statusMatch =
      statusFilter === "all" ||
      (statusFilter === "active" && emp.activo) ||
      (statusFilter === "inactive" && !emp.activo);

    const typeMatch = typeFilter === "all" || emp.tipo_empleado_id === typeFilter;

    return searchMatch && statusMatch && typeMatch;
  });

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const activeFiltersCount = [
    statusFilter !== "all",
    typeFilter !== "all",
    searchTerm !== "",
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
  }, [searchTerm, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Empleados</h1>
          <p className="text-muted-foreground">Gestiona el personal de tu clínica dental</p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-hover text-primary-foreground"
          onClick={() => setIsNewEmployeeDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Empleado
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, DNI, teléfono o cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filtros Expandibles */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Tipo de Empleado</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      <SelectItem value="Dentista">Dentista</SelectItem>
                      <SelectItem value="Asistente">Asistente Dental</SelectItem>
                      <SelectItem value="Recepcionista">Recepcionista</SelectItem>
                      <SelectItem value="Higienista">Higienista Dental</SelectItem>
                      <SelectItem value="Administrativo">Administrativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  onClick={clearFilters}
                  disabled={activeFiltersCount === 0}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Empleados</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {loading ? "..." : totalEmployees}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Empleados Activos</p>
            <p className="text-2xl font-bold text-success mt-1">
              {loading ? "..." : activeEmployees}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Resultados de Búsqueda</p>
            <p className="text-2xl font-bold text-secondary mt-1">
              {loading ? "..." : filteredEmployees.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Cargando empleados...</p>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Employee List */}
      {!loading && !error && currentEmployees.length > 0 && (
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
                      className={`text-xs font-medium flex items-center gap-1 ${
                        employee.activo ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          employee.activo ? "bg-success" : "bg-muted-foreground"
                        }`}
                      ></span>
                      {employee.activo ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-sm font-semibold text-foreground mt-1">
                      {formatSalary(employee.salario)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditEmployee(employee)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmployeeToDelete(employee.id!);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Paginación */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <div className="text-sm text-muted-foreground">
            Mostrando {indexOfFirstEmployee + 1}-
            {Math.min(indexOfLastEmployee, filteredEmployees.length)} de{" "}
            {filteredEmployees.length} empleados
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={prevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNumber)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={nextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span>Por página:</span>
            <Select
              value={employeesPerPage.toString()}
              onValueChange={(value) => {
                setEmployeesPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20">
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
