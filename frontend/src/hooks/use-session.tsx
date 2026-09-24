import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import * as authApi from '@/api/auth';
import type { RegisterData, User } from '@/api/auth';
import { ApiError, setAuthToken, setUnauthorizedHandler } from '@/api/client';
import { clearToken, loadToken, saveToken } from '@/api/token-storage';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  // `user` is null if the profile could not be loaded (e.g. API offline).
  | { status: 'signedIn'; user: User | null };

type SessionContextValue = {
  session: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState>({ status: 'loading' });

  function signOut() {
    setAuthToken(null);
    setSession({ status: 'signedOut' });
    void clearToken();
  }

  // Restore a saved session on startup.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = await loadToken();

      if (!token) {
        return { status: 'signedOut' } as const;
      }

      setAuthToken(token);

      try {
        return { status: 'signedIn', user: await authApi.getMe() } as const;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setAuthToken(null);
          await clearToken();
          return { status: 'signedOut' } as const;
        }

        return { status: 'signedIn', user: null } as const;
      }
    }

    restore().then((state) => {
      if (!cancelled) {
        setSession(state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Expired or revoked token on any request → back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(signOut);

    return () => setUnauthorizedHandler(null);
  });

  async function signIn(email: string, password: string) {
    const { access_token } = await authApi.login(email, password);

    setAuthToken(access_token);
    await saveToken(access_token);

    const user = await authApi.getMe().catch(() => null);
    setSession({ status: 'signedIn', user });
  }

  async function register(data: RegisterData) {
    await authApi.register(data);
    await signIn(data.email, data.password);
  }

  return (
    <SessionContext.Provider value={{ session, signIn, register, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}
