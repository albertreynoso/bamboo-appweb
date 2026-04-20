import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/PageLoader";
import { useMinLoading } from "@/hooks/useMinLoading";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityList } from "@/components/profile/ActivityList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    User,
    Mail,
    MapPin,
    Phone,
    Briefcase,
    Calendar,
    ShieldCheck,
    Activity,
    CreditCard,
    Edit,
    Loader2,
} from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";
import { getUsuarioByUid } from "@/services/usuariosService";
import type { Usuario } from "@/types/usuario";
import { ProfileManagementDialog } from "@/components/profile/ProfileManagementDialog";
import { Separator } from "@/components/ui/separator";

export default function Perfil() {
    const { user } = useAuthContext();
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);
    const show = useMinLoading(loading);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const fetchProfile = async (isSilent = false) => {
        if (!user?.uid) return;
        try {
            if (!isSilent) setLoading(true);
            const data = await getUsuarioByUid(user.uid);
            setUsuario(data);
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [user]);

    if (show) return <PageLoader message="Cargando perfil..." />;

    if (!usuario) {
        return (
            <div className="p-6">
                <Card className="border-destructive">
                    <CardContent className="p-6">
                        <p className="text-destructive font-semibold text-center">No se pudo cargar la información del perfil.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const fullName = `${usuario.nombre} ${usuario.apellidoPaterno} ${usuario.apellidoMaterno || ""}`.trim();
    const initials = `${usuario.nombre[0]}${usuario.apellidoPaterno[0]}`.toUpperCase();

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="flex justify-between items-center relative z-20 pb-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestión de Perfil</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Administra tu información personal y preferencias de acceso en el sistema.</p>
                </div>
                <Button onClick={() => setIsEditDialogOpen(true)} className="flex items-center gap-2">
                    <Edit className="h-4 w-4" />
                    Editar Perfil
                </Button>
            </div>

            <div className="py-2">
                <Separator className="bg-slate-200" />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">

                {/* Left Column: Summary Card */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardContent className="pt-6 pb-6 text-center">
                            <div className="mx-auto w-24 h-24 mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold shadow-sm ring-4 ring-primary/5">
                                {user?.photoURL ? (
                                    <img src={user.photoURL} alt={fullName} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    initials
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-slate-800 mb-0.5">{fullName}</h2>
                            <p className="text-[10px] text-primary/60 font-bold uppercase tracking-[0.15em] mb-4">
                                {usuario.rol || "Usuario"}
                            </p>
                            <p className="text-slate-400 text-[13px] mb-4">
                                {user?.email}
                            </p>

                            <div className="flex justify-center gap-2">
                                <Badge variant={usuario.estado === "active" ? "default" : "secondary"}>
                                    {usuario.estado === "active" ? "Activo" : "Pendiente"}
                                </Badge>
                                <Badge variant="outline" className="text-primary border-primary/30">
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    Verificado
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3 border-b border-slate-100">
                            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <Mail className="h-4 w-4 text-primary" />
                                Contacto Rápido
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex items-start gap-3">
                                <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none text-slate-700">Email</p>
                                    <p className="text-sm text-slate-500">{user?.email}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium leading-none text-slate-700">Teléfono</p>
                                    <p className="text-sm text-slate-500">{usuario.telefono}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Tabs */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="informacion" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-6">
                            <TabsTrigger value="informacion" className="flex gap-2">
                                <User className="h-4 w-4" />
                                Información Personal
                            </TabsTrigger>
                            <TabsTrigger value="actividad" className="flex gap-2">
                                <Activity className="h-4 w-4" />
                                Actividad Reciente
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="informacion" className="space-y-6 animate-in fade-in-50 duration-300">
                            <Card>
                                <CardHeader className="border-b border-slate-100 pb-4">
                                    <CardTitle className="text-lg">Detalles Personales</CardTitle>
                                    <CardDescription>
                                        Información registrada en el sistema.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                            <CreditCard className="h-4 w-4" />
                                            Documento Identidad (DNI)
                                        </p>
                                        <p className="text-base font-medium text-slate-800">{usuario.dni}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            Fecha de Nacimiento
                                        </p>
                                        <p className="text-base font-medium text-slate-800">
                                            {usuario.fechaNacimiento
                                                ? new Date(usuario.fechaNacimiento).toLocaleDateString('es-PE', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })
                                                : "No especificada"}
                                        </p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            Género
                                        </p>
                                        <p className="text-base font-medium text-slate-800">{usuario.genero || "No especificado"}</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Dirección
                                        </p>
                                        <p className="text-base font-medium text-slate-800">{usuario.direccion || "No especificada"}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="actividad" className="space-y-6 animate-in fade-in-50 duration-300">
                            <Card>
                                <CardHeader className="border-b border-slate-100 pb-4">
                                    <CardTitle className="text-lg">Actividad Reciente</CardTitle>
                                    <CardDescription>
                                        Registro del historial de acciones que has realizado en el sistema.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <ActivityList uid={user?.uid || ""} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <ProfileManagementDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onProfileUpdated={() => fetchProfile(true)}
            />
        </div>
    );
}
