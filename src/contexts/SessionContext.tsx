import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { UserAccount } from '../types';
import { api } from '../lib/api';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'bantai-theme';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  } catch {
    return 'light';
  }
}

// Helper to decode JWT token payload
function decodeJwtToken(token: string): any | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Add padding if needed
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (err) {
    console.warn('Failed to decode JWT token:', err);
    return null;
  }
}

type SessionValue = {
  user: UserAccount | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  devLogin: () => Promise<boolean>;
  signOut: () => Promise<void>;
  theme: Theme;
  setTheme: (t: Theme) => void;
  branchFilter: string;
  setBranchFilter: (id: string) => void;
  scopeCenterId: string | null;
  isSuperadmin: boolean;
  now: number;
  sirenVolume: number;
  setSirenVolume: (v: number) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [sirenVolume, setSirenVolume] = useState(70);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    // Check if we have a token and try to get user data from it
    const tryInitializeUser = async () => {
      if (typeof window !== 'undefined') {
        const token = window.localStorage.getItem('bantai-access-token');
        if (token) {
          // Try to decode the token to get user data
          const decoded = decodeJwtToken(token);
          if (decoded && decoded.id && decoded.email && decoded.role && decoded.f_name && decoded.l_name) {
            // Map the decoded token to our UserAccount type
            const userData: UserAccount = {
              id: decoded.id,
              f_name: decoded.f_name,
              l_name: decoded.l_name,
              role: decoded.role,
              email: decoded.email,
              m_number: decoded.m_number || undefined,
              command_center_id: decoded.command_center_id || null,
              account_status: decoded.account_status || undefined,
              must_change_password: decoded.must_change_password || undefined,
              r_profile: decoded.r_profile || undefined,
              d_profile: decoded.d_profile || undefined
            };
            if (!cancelled) setUser(userData);
          }
        }
      }
      if (!cancelled) setReady(true);
    };

    tryInitializeUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      return false;
    }
    try {
      const data = await api.login(trimmedEmail, trimmedPassword);
      // Store the access token in localStorage for use in subsequent API requests
      if (typeof window !== 'undefined' && data.accessToken) {
        try {
          window.localStorage.setItem('bantai-access-token', data.accessToken);
          // Try to get user data from the token immediately
          const decoded = decodeJwtToken(data.accessToken);
          if (decoded && decoded.id && decoded.email && decoded.role && decoded.f_name && decoded.l_name) {
            const userData: UserAccount = {
              id: decoded.id,
              f_name: decoded.f_name,
              l_name: decoded.l_name,
              role: decoded.role,
              email: decoded.email,
              m_number: decoded.m_number || undefined,
              command_center_id: decoded.command_center_id || null,
              account_status: decoded.account_status || undefined,
              must_change_password: decoded.must_change_password || undefined,
              r_profile: decoded.r_profile || undefined,
              d_profile: decoded.d_profile || undefined
            };
            setUser(userData);
          }
        } catch (storageError) {
          console.warn('Failed to store access token:', storageError);
        }
      }
      setBranchFilter('all');
      return true;
    } catch (error: any) {
      return false;
    }
  }, []);

  const devLogin = useCallback(async (): Promise<boolean> => {
    if (!import.meta.env.DEV) return false;
    try {
      const data = await api.devLogin();
      if (typeof window !== 'undefined' && data.accessToken) {
        try {
          window.localStorage.setItem('bantai-access-token', data.accessToken);
          // Try to get user data from the token
          const decoded = decodeJwtToken(data.accessToken);
          if (decoded && decoded.id && decoded.email && decoded.role && decoded.f_name && decoded.l_name) {
            const userData: UserAccount = {
              id: decoded.id,
              f_name: decoded.f_name,
              l_name: decoded.l_name,
              role: decoded.role,
              email: decoded.email,
              m_number: decoded.m_number || undefined,
              command_center_id: decoded.command_center_id || null,
              account_status: decoded.account_status || undefined,
              must_change_password: decoded.must_change_password || undefined,
              r_profile: decoded.r_profile || undefined,
              d_profile: decoded.d_profile || undefined
            };
            setUser(userData);
          }
        } catch (storageError) {
          console.warn('Failed to store access token:', storageError);
        }
      }
      setBranchFilter('all');
      return true;
    } catch {
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* session already gone */
    }
    // Clear the access token from localStorage
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('bantai-access-token');
      } catch {
        /* storage unavailable */
      }
    }
    setUser(null);
  }, []);

  const isSuperadmin = user?.role === 'superadmin';
  const scopeCenterId = isSuperadmin ?
  branchFilter === 'all' ?
  null :
  branchFilter :
  user?.command_center_id ?? null;

  const value = useMemo<SessionValue>(
    () => ({
      user,
      ready,
      signIn,
      devLogin,
      signOut,
      theme,
      setTheme,
      branchFilter,
      setBranchFilter,
      scopeCenterId,
      isSuperadmin: !!isSuperadmin,
      now,
      sirenVolume,
      setSirenVolume
    }),
    [user, ready, signIn, devLogin, signOut, theme, branchFilter, scopeCenterId, isSuperadmin, now, sirenVolume]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}