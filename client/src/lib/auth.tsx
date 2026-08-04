import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { SafeUser, PermissionArea } from "@shared/schema";

// ---------------------------------------------------------------------------
// Adressbildung für das PHP-Backend
// ---------------------------------------------------------------------------
// Die Website liegt als reine Dateisammlung im Web-Ordner (Managed Hosting
// ohne Rewrites). Es gibt deshalb genau zwei PHP-Einstiegspunkte:
//
//   /api.php?r=/posts/slug/xyz   statt   /api/posts/slug/xyz
//   /datei.php?s=xyz             statt   /dateien/xyz
//
// Diese Datei ist die EINZIGE Stelle, an der API-Adressen gebildet werden –
// alle übrigen Client-Dateien arbeiten unverändert mit den /api/…-Pfaden.
// Die Query-Variante wird bewusst von vornherein genutzt: sie funktioniert auf
// jedem Server, ohne dass PATH_INFO konfiguriert sein muss, und kostet keine
// zusätzliche Anfrage zum Ausprobieren. api.php akzeptiert zusätzlich
// PATH_INFO, falls später hübsche Adressen per Rewrite aktiviert werden.

/** Verzeichnis, in dem index.html/api.php liegen (leer = Wurzel des Webservers). */
const API_BASE = "";

export function withBase(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_BASE}${url}`;
}

/**
 * Bildet einen bisherigen API-Pfad (`/api/...`) auf den Front-Controller ab.
 * Eine eventuell vorhandene Query-Zeichenkette bleibt erhalten.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) return withBase(path);
  const [route, query] = path.slice(4).split("?");
  const suffix = query ? `&${query}` : "";
  return `${API_BASE}/api.php?r=${encodeURIComponent(route)}${suffix}`;
}

/** Adresse eines Dokuments mit stabilem Link (früher /dateien/<slug>). */
export function fileUrl(slug: string): string {
  return `${API_BASE}/datei.php?s=${encodeURIComponent(slug)}`;
}

/**
 * Passt in gespeichertem HTML enthaltene Pfade an das Deployment an:
 * `/dateien/<slug>` wird zu `/datei.php?s=<slug>`. `/uploads/…` bleibt
 * unverändert – diese Dateien liefert der Webserver direkt aus.
 * Bereits umgeschriebene Links werden nicht erneut angefasst.
 */
export function rewriteContent(html: string): string {
  return html.replace(
    /(src|href)="\/dateien\/([^"?#]+)"/g,
    (_m, attr, slug) => `${attr}="${fileUrl(decodeURIComponent(slug))}"`,
  );
}

/**
 * Führt eine API-Anfrage aus. PATCH/PUT/DELETE werden als POST mit
 * `_method`-Angabe gesendet: Manche Managed-Hosting-Konfigurationen lassen
 * diese Methoden nicht durch, und PHP wertet Formulardaten (Datei-Uploads)
 * ohnehin nur bei POST aus. api.php stellt die Methode wieder her.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "POST") {
    return fetch(apiUrl(path), init);
  }
  const url = apiUrl(path);
  return fetch(`${url}${url.includes("?") ? "&" : "?"}_method=${method}`, { ...init, method: "POST" });
}

interface AuthState {
  user: SafeUser | null;
  token: string | null;
  /** true, solange eine gespeicherte Anmeldung noch geprüft wird (Seiten-Neuladen). */
  restoring: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (u: SafeUser) => void;
  can: (area: PermissionArea) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "ffk_token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* z. B. Safari im privaten Modus – Anmeldung gilt dann nur für den Tab */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [restoring, setRestoring] = useState<boolean>(() => !!readStoredToken());

  // Gespeicherte Anmeldung beim Laden der Seite wiederherstellen,
  // damit Redakteure nach einem Neuladen (F5) angemeldet bleiben.
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) return;
    let cancelled = false;
    apiFetch("/api/auth/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          setUser(await res.json());
        } else {
          // Sitzung abgelaufen oder Benutzer deaktiviert
          storeToken(null);
          setToken(null);
        }
      })
      .catch(() => {
        /* Netzwerkfehler: Token behalten, Anmeldemaske erscheint */
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || "Anmeldung fehlgeschlagen");
    }
    const data = await res.json();
    storeToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    const t = token;
    storeToken(null);
    setToken(null);
    setUser(null);
    if (t) {
      apiFetch("/api/auth/logout", {
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
    <AuthContext.Provider value={{ user, token, restoring, login, logout, setUser, can }}>
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
  const res = await apiFetch(url, {
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
  // PHP fasst gleichnamige Felder nur mit "[]" zu einer Liste zusammen
  Array.from(files).forEach((f) => fd.append("files[]", f));
  const res = await apiFetch("/api/admin/media", {
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
    const res = await apiFetch(queryKey.join("/"), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `${res.status}`);
    }
    return res.json();
  };
}
