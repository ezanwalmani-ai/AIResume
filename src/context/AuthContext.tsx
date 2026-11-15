import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: string | null;
  getToken: () => Promise<string>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const getToken = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Not authenticated.');
    }
    return current.getIdToken();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google sign-in failed.';
      setAuthError(msg);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        getToken,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return ctx;
}
