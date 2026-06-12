import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { SafeUser, PermissionArea } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export function withBase(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_BASE}${url}`;
}

/** Ersetzt /uploads/-Pfade in gespeichertem HTML durch absolute Pfade (für Deployment hinter Proxy). */
export function rewriteContent(html: string): string {
  if (!API_BASE) return html;
  return html.replace(/(src|href)="(\/uploads\/[^"]+)"/g, (_m, attr, path) => `${attr}="${API_BASE}${path}"`);
}

interface AuthState {
  user: SafeUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: SafeUser) => void;
  can: (area: PermissionArea) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "Anmeldung fehlgeschlagen");
    }
    const data = await res.json();
    setToken(data.token);
    setUser(data.user);
    (window as any).__ffk_token = data.token;
  }, []);

  const logout = useCallback(() => {
    const t = token;
    setToken(null);
    setUser(null);
    (window as any).__ffk_token = null;
    if (t) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => {});
    }
  }, [token]);

  const can = useCallback(
    (area: PermissionArea) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      try {
        return (JSON.parse(user.permissions) as string[]).includes(area);
      } catch {
        return false;
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, token, login, logout, setUser, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Authentifizierte API-Anfrage mit JSON-Body. */
export async function authRequest(
  token: string | null,
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `${res.status}: Fehler bei der Anfrage`);
  }
  return res;
}

/** Authentifizierter Datei-Upload (FormData). */
export async function uploadFiles(token: string | null, files: FileList | File[]): Promise<any[]> {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("files", f));
  const res = await fetch(`${API_BASE}/api/admin/media`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Upload fehlgeschlagen");
  }
  return res.json();
}

/** Authentifizierter GET als Query-Funktion. */
export function authQueryFn(token: string | null) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `${res.status}`);
    }
    return res.json();
  };
}
