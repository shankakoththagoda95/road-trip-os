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
  // Sign in with a token from verify-email / reset-password.
  signInWithToken: (accessToken: string) => Promise<void>;
  // Creates the account; the user signs in after confirming their email.
  register: (data: RegisterData) => Promise<User>;
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

  async function signInWithToken(accessToken: string) {
    setAuthToken(accessToken);
    await saveToken(accessToken);

    const user = await authApi.getMe().catch(() => null);
    setSession({ status: 'signedIn', user });
  }

  async function signIn(email: string, password: string) {
    const { access_token } = await authApi.login(email, password);
    await signInWithToken(access_token);
  }

  function register(data: RegisterData) {
    return authApi.register(data);
  }

  return (
    <SessionContext.Provider
      value={{ session, signIn, signInWithToken, register, signOut }}>
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
