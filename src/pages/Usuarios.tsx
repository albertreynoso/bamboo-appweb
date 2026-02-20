import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Usuario } from "@/types/usuario";
import {
  subscribeToUsuarios,
  actualizarEstadoUsuario,
} from "@/services/usuariosService";
import { UserCheck } from "lucide-react";

type Filtro = "todos" | "pending" | "active";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [procesando, setProcesando] = useState<string | null>(null);
  const [revocarDialogUid, setRevocarDialogUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToUsuarios((data) => {
      setUsuarios(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const pendientes = usuarios.filter((u) => u.estado === "pending");

  const filtrados =
    filtro === "todos"
      ? usuarios
      : usuarios.filter((u) => u.estado === filtro);

  const formatFecha = (creadoEn?: { seconds: number; nanoseconds: number } | null) => {
    if (!creadoEn) return "—";
    return new Date(creadoEn.seconds * 1000).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getIniciales = (nombre: string, apellido: string) => {
    return `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase();
  };

  const handleAprobar = async (uid: string) => {
    setProcesando(uid);
    try {
      await actualizarEstadoUsuario(uid, "active");
      toast({ title: "Usuario aprobado", description: "El usuario ahora puede acceder a la app." });
    } catch {
      toast({ title: "Error", description: "No se pudo aprobar el usuario.", variant: "destructive" });
    } finally {
      setProcesando(null);
    }
  };

  const handleRevocar = async () => {
    if (!revocarDialogUid) return;
    setProcesando(revocarDialogUid);
    setRevocarDialogUid(null);
    try {
      await actualizarEstadoUsuario(revocarDialogUid, "pending");
      toast({ title: "Acceso revocado", description: "El usuario ha sido puesto en estado pendiente." });
    } catch {
      toast({ title: "Error", description: "No se pudo revocar el acceso.", variant: "destructive" });
    } finally {
      setProcesando(null);
    }
  };

  const tabs: { label: string; value: Filtro }[] = [
    { label: "Todos", value: "todos" },
    { label: "Pendientes", value: "pending" },
    { label: "Activos", value: "active" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Aprueba o revoca el acceso de usuarios registrados desde la app móvil</p>
        </div>
        {pendientes.length > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-sm px-3 py-1">
            {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Tabs de filtro */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFiltro(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtro === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
            {tab.value === "pending" && pendientes.length > 0 && (
              <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendientes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Registrado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  No hay usuarios en esta categoría
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((usuario) => {
                const nombre = `${usuario.nombre} ${usuario.apellidoPaterno}${usuario.apellidoMaterno ? " " + usuario.apellidoMaterno : ""}`;
                const initiales = getIniciales(usuario.nombre, usuario.apellidoPaterno);
                const isProcesando = procesando === usuario.uid;

                return (
                  <TableRow key={usuario.uid}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-muted-foreground">{initiales}</span>
                        </div>
                        <span className="font-medium text-foreground">{nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{usuario.dni || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{usuario.telefono || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatFecha(usuario.creadoEn)}</TableCell>
                    <TableCell>
                      {usuario.estado === "active" ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">Activo</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendiente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {usuario.estado === "pending" ? (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleAprobar(usuario.uid)}
                          disabled={isProcesando}
                        >
                          {isProcesando ? "Aprobando..." : "Aprobar"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => setRevocarDialogUid(usuario.uid)}
                          disabled={isProcesando}
                        >
                          {isProcesando ? "Revocando..." : "Revocar"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de confirmación para revocar */}
      <AlertDialog open={!!revocarDialogUid} onOpenChange={(open) => { if (!open) setRevocarDialogUid(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar acceso?</AlertDialogTitle>
            <AlertDialogDescription>
              El usuario pasará a estado "pendiente" y no podrá ingresar a la app móvil hasta ser aprobado de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevocar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Revocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
