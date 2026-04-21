import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Empleados from "./pages/Empleados";
import EmpleadoDetalle from "./components/employees/EmployeeDetail";
import Pacientes from "./pages/Pacientes";
import Calendario from "./pages/Calendario";
import Pagos from "./pages/Pagos";
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";
import PacienteDetalle from "./components/patients/PatientDetail";
import Login from "./pages/Login";
import PerfilCompletar from "./pages/PerfilCompletar";
import Perfil from "./pages/Perfil";
import Inventario from "./pages/Inventario";
import Configuracion from "./pages/Configuracion";
import Actividad from "./pages/Actividad";
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
