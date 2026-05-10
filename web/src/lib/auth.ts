/**
 * JWT-based session. The JWT is issued by the Postgres login() function
 * (HS256, signed with app.jwt_secret). We trust it client-side only for
 * UX purposes — RLS is the security boundary.
 */

import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';
import { db, tokenStorage } from './api';

export type RoleName =
  | 'super_admin'
  | 'signage_hod'
  | 'signage_production'
  | 'department_user'
  | 'viewer';

export interface Assignment {
  role: RoleName;
  event_id: string | null;
  venue_id: string | null;
  department_id: string | null;
}

export interface JwtClaims {
  role: 'authenticated' | 'web_anon';
  user_id: string;
  its_number: string;
  primary_role: RoleName;
  assignments: Assignment[];
  exp: number;
}

export interface Session {
  userId: string;
  itsNumber: string;
  primaryRole: RoleName;
  assignments: Assignment[];
  exp: number;
}

const decodeJwt = (token: string): Session | null => {
  try {
    const claims = jwtDecode<JwtClaims>(token);
    if (!claims.user_id || !claims.primary_role) return null;
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return {
      userId: claims.user_id,
      itsNumber: claims.its_number,
      primaryRole: claims.primary_role,
      assignments: claims.assignments ?? [],
      exp: claims.exp,
    };
  } catch {
    return null;
  }
};

export const getSession = (): Session | null => {
  const token = tokenStorage.get();
  if (!token) return null;
  return decodeJwt(token);
};

interface AuthStore {
  session: Session | null;
  isReady: boolean;
  login: (itsNumber: string, password: string) => Promise<Session>;
  logout: () => void;
  refresh: () => void;
}

/**
 * Bootstraps from localStorage on first import; React components read this
 * via useAuth() and re-render automatically when login/logout fires.
 */
export const useAuth = create<AuthStore>((set) => ({
  session: getSession(),
  isReady: true,

  async login(itsNumber, password) {
    // login() returns the raw JWT string as PostgREST JSON (a quoted string).
    const jwt = await db.rpc<string>('login', {
      p_its_number: itsNumber,
      p_password: password,
    });
    if (!jwt || typeof jwt !== 'string') {
      throw new Error('Login failed: empty token');
    }
    tokenStorage.set(jwt);
    const session = decodeJwt(jwt);
    if (!session) throw new Error('Login failed: token decode error');
    set({ session });
    return session;
  },

  logout() {
    tokenStorage.clear();
    try {
      localStorage.removeItem('selectedEventId');
    } catch {
      /* noop */
    }
    set({ session: null });
  },

  refresh() {
    set({ session: getSession() });
  },
}));
