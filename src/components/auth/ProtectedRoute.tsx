// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, profileComplete } = useAuthContext();

  // Esperar a que auth termine de cargar
  if (loading || (user && profileComplete === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Sin usuario → login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Perfil incompleto → cuestionario
  if (!profileComplete) {
    return <Navigate to="/completar-perfil" replace />;
  }

  return <>{children}</>;
};
