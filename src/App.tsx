import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { lazy, Suspense } from "react";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Empleados = lazy(() => import("./pages/Empleados"));
const EmpleadoDetalle = lazy(() => import("./components/employees/EmployeeDetail"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Pagos = lazy(() => import("./pages/Pagos"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PacienteDetalle = lazy(() => import("./components/patients/PatientDetail"));
const Login = lazy(() => import("./pages/Login"));
const PerfilCompletar = lazy(() => import("./pages/PerfilCompletar"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Actividad = lazy(() => import("./pages/Actividad"));

const GlobalLoader = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4">
      <div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando...</p>
    </div>
  </div>
);
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/app">
        <AuthProvider>
          <Suspense fallback={<GlobalLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/completar-perfil" element={<PerfilCompletar />} />
              {/* ── Admin + Recepcionista ── */}
              <Route path="/calendario" element={
                <ProtectedRoute>
                  <Layout><Calendario /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/pacientes" element={
                <ProtectedRoute>
                  <Layout><Pacientes /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/pacientes/:id" element={
                <ProtectedRoute>
                  <Layout><PacienteDetalle /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/pagos" element={
                <ProtectedRoute>
                  <Layout><Pagos /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/perfil" element={
                <ProtectedRoute>
                  <Layout><Perfil /></Layout>
                </ProtectedRoute>
              } />

              {/* ── Solo Admin ── */}
              <Route path="/" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/inventario" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><Inventario /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/empleados" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><Empleados /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/empleados/:id" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><EmpleadoDetalle /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/usuarios" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><Usuarios /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/configuracion" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><Configuracion /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/actividad" element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Layout><Actividad /></Layout>
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
