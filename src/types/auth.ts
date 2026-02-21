// src/types/auth.ts
import type { User } from 'firebase/auth';
import type { ReactNode } from 'react';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
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