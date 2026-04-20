// src/types/auth.ts
import type { User } from 'firebase/auth';
import type { ReactNode } from 'react';
import type { RolWeb } from './usuario';

export interface UserProfile {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rol?: string;
  plataforma_web?: boolean;
  dni: string;
  telefono: string;
  direccion: string;
  fechaNacimiento: string;
  genero: string;
  estado: string;
  creadoEn: any;
}

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  /** Rol del usuario web autenticado. null si no es usuario web o aún cargando. */
  rol: RolWeb | null;
  signInWithGoogle: () => Promise<User>;
  signInWithEmailPassword: (email: string, password: string) => Promise<User>;
  signUpWithEmailPassword: (email: string, password: string, name: string) => Promise<User>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  /** null = aún verificando, false = perfil incompleto, true = perfil completo */
  profileComplete: boolean | null;
  refreshProfile: () => Promise<void>;
}

export interface AuthProviderProps {
  children: ReactNode;
}