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

export const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const checkProfile = useCallback(async (uid: string) => {
    setProfileComplete(null);
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      setProfileComplete(snap.exists() && snap.data().estado === 'active');
    } catch {
      setProfileComplete(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        checkProfile(currentUser.uid);
      } else {
        setProfileComplete(null);
      }
    });
    return () => unsubscribe();
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

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signOut,
    isAuthenticated: !!user,
    profileComplete,
    refreshProfile,
  };
};
