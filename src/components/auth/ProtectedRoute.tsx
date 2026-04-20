// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import LoadingTransition from '@/components/ui/LoadingTransition';
import type { RolWeb } from '@/types/usuario';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Si se especifica, solo esos roles pueden acceder. Sin valor = cualquier usuario web. */
  allowedRoles?: RolWeb[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading, profileComplete, rol } = useAuthContext();

  if (loading || (user && profileComplete === null)) {
    return <LoadingTransition variant="premium_glass" message="Cargando..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!profileComplete) return <Navigate to="/completar-perfil" replace />;

  // Si la ruta requiere un rol específico y el usuario no lo tiene → redirigir a calendario
  if (allowedRoles && (!rol || !allowedRoles.includes(rol))) {
    return <Navigate to="/calendario" replace />;
  }

  return <>{children}</>;
};
