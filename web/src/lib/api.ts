/**
 * Thin PostgREST client over plain fetch.
 *
 * Conventions:
 *   - JWT is read from localStorage on every request (so logout/login is
 *     reflected without rebuilding the client).
 *   - Errors are normalized to ApiError; PostgREST returns {message,code,
 *     details,hint} JSON which we surface verbatim.
 *   - select() accepts PostgREST filter syntax via params (e.g.
 *     { event_id: 'eq.<uuid>', order: 'created_at.desc' }).
 *   - insert/update use Prefer: return=representation so callers always
 *     get the persisted row(s) back.
 */

const BASE_URL = (import.meta.env.VITE_POSTGREST_URL as string | undefined) ??
  'http://localhost:3000';

const JWT_KEY = 'jwt';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: string;
  hint?: string;

  constructor(args: {
    status: number;
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  }) {
    super(args.message);
    this.name = 'ApiError';
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.hint = args.hint;
  }
}

const getToken = (): string | null => {
  try {
    return localStorage.getItem(JWT_KEY);
  } catch {
    return null;
  }
};

const buildHeaders = (extra?: HeadersInit): Headers => {
  const h = new Headers(extra);
  h.set('Accept', 'application/json');
  if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) h.set('Authorization', `Bearer ${token}`);
  return h;
};

const buildQuery = (params?: Record<string, string>): string => {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.append(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
};

/**
 * Called on any 401 from PostgREST. Clears JWT and bounces to /login,
 * preserving the URL the user tried to reach. We use a hard redirect
 * (not react-router) because this lives below the React tree.
 */
const handleUnauthorized = () => {
  try {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem('selectedEventId');
  } catch {
    /* noop */
  }
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

const handle = async <T>(res: Response): Promise<T> => {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText || 'Request failed';
    let code: string | undefined;
    let details: string | undefined;
    let hint: string | undefined;
    try {
      const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      if (body && typeof body === 'object') {
        if (typeof body.message === 'string') message = body.message;
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.details === 'string') details = body.details;
        if (typeof body.hint === 'string') hint = body.hint;
      }
    } catch {
      // non-JSON error body; fall through with raw text
      if (text) message = text;
    }
    // Only treat 401 as session-expired when a token was actually attached.
    // login() failures (bad creds) come back as 401 too but with no token in
    // localStorage, so we leave the caller to render the error inline.
    if (res.status === 401 && getToken()) {
      handleUnauthorized();
    }
    throw new ApiError({ status: res.status, message, code, details, hint });
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // RPC functions returning a scalar (e.g. login() returns a JSON string)
    // are still valid JSON, so this branch is mostly defensive.
    return text as unknown as T;
  }
};

export interface TableQuery<T> {
  select: (columns?: string, params?: Record<string, string>) => Promise<T[]>;
  insert: (
    rows: Partial<T> | Partial<T>[],
    params?: Record<string, string>,
  ) => Promise<T[]>;
  update: (
    patch: Partial<T>,
    params: Record<string, string>,
  ) => Promise<T[]>;
  delete: (params: Record<string, string>) => Promise<void>;
}

const fromTable = <T>(table: string): TableQuery<T> => ({
  async select(columns = '*', params = {}) {
    const url =
      `${BASE_URL}/${table}` + buildQuery({ select: columns, ...params });
    const res = await fetch(url, { method: 'GET', headers: buildHeaders() });
    return handle<T[]>(res);
  },

  async insert(rows, params = {}) {
    const url = `${BASE_URL}/${table}` + buildQuery(params);
    const headers = buildHeaders({ Prefer: 'return=representation' });
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    });
    return handle<T[]>(res);
  },

  async update(patch, params) {
    const url = `${BASE_URL}/${table}` + buildQuery(params);
    const headers = buildHeaders({ Prefer: 'return=representation' });
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    return handle<T[]>(res);
  },

  async delete(params) {
    const url = `${BASE_URL}/${table}` + buildQuery(params);
    const res = await fetch(url, { method: 'DELETE', headers: buildHeaders() });
    await handle<void>(res);
  },
});

export const db = {
  from: <T>(table: string): TableQuery<T> => fromTable<T>(table),

  /**
   * Call a Postgres function exposed via PostgREST.
   * PostgREST returns either a JSON value (scalar/object/array) directly.
   */
  rpc: async <R>(name: string, args?: Record<string, unknown>): Promise<R> => {
    const url = `${BASE_URL}/rpc/${name}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(args ?? {}),
    });
    return handle<R>(res);
  },
};

export const tokenStorage = {
  get: getToken,
  set: (jwt: string) => {
    localStorage.setItem(JWT_KEY, jwt);
  },
  clear: () => {
    localStorage.removeItem(JWT_KEY);
  },
};
