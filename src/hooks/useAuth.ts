// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword as firebaseSignInEmail,
  createUserWithEmailAndPassword as firebaseSignUp,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import type { AuthContextType } from '@/types/auth';
import type { RolWeb } from '@/types/usuario';

export const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<AuthContextType['userProfile']>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const checkProfile = useCallback(async (uid: string) => {
    setProfileComplete(null);
    setUserProfile(null);
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (snap.exists()) {
        const data = snap.data() as AuthContextType['userProfile'];
        setUserProfile(data);
        // Solo usuarios web (plataforma_web: true) pueden acceder a esta app
        setProfileComplete(data?.estado === 'active' && data?.plataforma_web === true);
      } else {
        setProfileComplete(false);
      }
    } catch {
      setProfileComplete(false);
    }
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const INACTIVITY_LIMIT = 2 * 60 * 60 * 1000; // 2 horas

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (auth.currentUser) {
        timeoutId = setTimeout(() => {
          console.log("Sesión expirada por inactividad");
          firebaseSignOut(auth).then(() => {
            window.location.href = '/login?reason=expired';
          });
        }, INACTIVITY_LIMIT);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        checkProfile(currentUser.uid);
        resetTimer();
        
        // Listeners para actividad
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => document.addEventListener(event, resetTimer));
        
        return () => {
          events.forEach(event => document.removeEventListener(event, resetTimer));
          if (timeoutId) clearTimeout(timeoutId);
        };
      } else {
        setProfileComplete(null);
        if (timeoutId) clearTimeout(timeoutId);
      }
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [checkProfile]);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await checkProfile(auth.currentUser.uid);
    }
  }, [checkProfile]);

  const signInWithGoogle = async (): Promise<User> => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al iniciar sesión';
      console.error('Error al iniciar sesión con Google:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmailPassword = async (email: string, password: string): Promise<User> => {
    try {
      setError(null);
      setLoading(true);
      const result = await firebaseSignInEmail(auth, email, password);
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al iniciar sesión';
      console.error('Error al iniciar sesión con email:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmailPassword = async (email: string, password: string, name: string): Promise<User> => {
    try {
      setError(null);
      setLoading(true);
      const result = await firebaseSignUp(auth, email, password);
      if (name.trim()) {
        await updateProfile(result.user, { displayName: name.trim() });
      }
      return result.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al registrarse';
      console.error('Error al registrarse:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setError(null);
      await firebaseSignOut(auth);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cerrar sesión';
      console.error('Error al cerrar sesión:', err);
      setError(errorMessage);
      throw err;
    }
  };

  // Normalizar "administrador" → "admin" para compatibilidad con documentos anteriores
  const storedRol = userProfile?.rol;
  const normalizedRol = storedRol === 'administrador' ? 'admin' : storedRol;
  const rol: RolWeb | null =
    userProfile?.plataforma_web === true &&
    (normalizedRol === 'admin' || normalizedRol === 'recepcionista')
      ? (normalizedRol as RolWeb)
      : null;

  return {
    user,
    userProfile,
    loading,
    error,
    rol,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signOut,
    isAuthenticated: !!user,
    profileComplete,
    refreshProfile,
  };
};
