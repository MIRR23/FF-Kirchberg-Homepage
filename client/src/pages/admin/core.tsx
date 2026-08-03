import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Flame, LogOut, LayoutDashboard, Newspaper, CalendarDays, Truck,
  Users, FileText, Image, ShieldCheck, Menu, X, KeyRound, ExternalLink, Home, Loader2, FolderOpen,
} from "lucide-react";
import type { PermissionArea, Post, Event } from "@shared/schema";
import { useAuth, authQueryFn, authRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

export function useAdminQuery<T>(key: string, enabled = true) {
  const { token } = useAuth();
  return useQuery<T>({
    queryKey: [key],
    queryFn: authQueryFn(token) as any,
    enabled: !!token && enabled,
  });
}

/** Vollflächiger Ladehinweis, während eine gespeicherte Anmeldung geprüft wird. */
function AuthRestoreScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span className="text-sm">Anmeldung wird geprüft …</span>
      </div>
    </div>
  );
}

// ---------- Login ----------
export function AdminLogin() {
  const { login, user, restoring } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();

  // Bereits angemeldet (z. B. über den Footer-Link aufgerufen) -> direkt zur Übersicht
  useEffect(() => {
    if (user) navigate("/intern/dashboard");
  }, [user, navigate]);

  if (restoring) return <AuthRestoreScreen />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
      navigate("/intern/dashboard");
    } catch (err: any) {
      toast({ title: "Anmeldung fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="wappen.png" alt="" className="mx-auto h-16 w-auto" />
          <h1 className="mt-4 font-display text-xl font-semibold">Interner Bereich</h1>
          <p className="mt-1 text-sm text-muted-foreground">Freiwillige Feuerwehr Kirchberg</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-card-border bg-card p-6">
          <div className="space-y-1.5">
            <Label htmlFor="username">Benutzername</Label>
            <Input
              id="username" data-testid="input-username" autoComplete="username"
              value={username} onChange={(e) => setUsername(e.target.value)} required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password" data-testid="input-password" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>
          <Button type="submit" data-testid="button-login" className="w-full" disabled={busy}>
            {busy ? "Anmelden …" : "Anmelden"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">← Zurück zur Website</Link>
        </p>
      </div>
    </div>
  );
}

// ---------- Layout ----------
const ADMIN_NAV: { href: string; label: string; icon: any; area?: PermissionArea; adminOnly?: boolean }[] = [
  { href: "/intern/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/intern/beitraege", label: "Beiträge & Einsätze", icon: Newspaper },
  { href: "/intern/startseite", label: "Startseite", icon: Home, area: "seiten" },
  { href: "/intern/termine", label: "Termine", icon: CalendarDays, area: "termine" },
  { href: "/intern/fahrzeuge", label: "Fahrzeuge", icon: Truck, area: "fahrzeuge" },
  { href: "/intern/mitglieder", label: "Mitglieder", icon: Users, area: "mitglieder" },
  { href: "/intern/seiten", label: "Seiten & Texte", icon: FileText, area: "seiten" },
  { href: "/intern/medien", label: "Bilder", icon: Image },
  { href: "/intern/dateien", label: "Dateien", icon: FolderOpen },
  { href: "/intern/benutzer", label: "Benutzer & Rechte", icon: ShieldCheck, adminOnly: true },
];

export function AdminLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, restoring, can, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  if (restoring) {
    return <AuthRestoreScreen />;
  }
  if (!user) {
    return <AdminLogin />;
  }

  const visibleNav = ADMIN_NAV.filter((n) => {
    if (n.adminOnly) return user.role === "admin";
    if (n.href === "/intern/beitraege") return can("einsaetze") || can("neuigkeiten");
    if (n.area) return can(n.area);
    return true;
  });

  const navContent = (
    <>
      <div className="flex items-center gap-3 px-4 py-5">
        <img src="wappen.png" alt="" className="h-9 w-auto" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">FF Kirchberg</p>
          <p className="text-[11px] text-muted-foreground">Verwaltung</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = location.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              data-testid={`link-admin-${n.label.toLowerCase().replace(/[^a-z]/g, "")}`}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                active ? "bg-sidebar-accent text-primary" : "text-foreground/75 hover:bg-sidebar-accent/60"
              }`}
            >
              <Icon className="h-4 w-4" /> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <p className="px-2 text-xs text-muted-foreground">Angemeldet als</p>
        <p className="px-2 text-sm font-semibold" data-testid="text-current-user">{user.displayName}</p>
        <div className="mt-2 flex flex-col gap-0.5">
          <Link href="/intern/konto" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            <KeyRound className="h-3.5 w-3.5" /> Passwort ändern
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" /> Website ansehen
          </Link>
          <button
            onClick={() => { logout(); navigate("/"); }}
            data-testid="button-logout"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Abmelden
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar – sticky und auf Fensterhöhe begrenzt, damit sie sich bei
          langen Seiten (z. B. Beitragsliste) nicht in die Länge zieht und
          „Angemeldet als" immer ohne Scrollen sichtbar bleibt */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar md:flex">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar">
            <button className="absolute right-3 top-4 p-1" onClick={() => setOpen(false)} aria-label="Schließen">
              <X className="h-5 w-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:px-8">
          <button className="rounded-md p-1.5 md:hidden" onClick={() => setOpen(true)} aria-label="Menü" data-testid="button-admin-menu">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

// ---------- Dashboard ----------
export function AdminDashboard() {
  const { user, can } = useAuth();
  const { data: posts } = useAdminQuery<Post[]>("/api/admin/posts");
  const { data: events } = useAdminQuery<Event[]>("/api/events");

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (events ?? []).filter((e) => e.date >= today).slice(0, 5);
  const drafts = (posts ?? []).filter((p) => p.status === "draft");

  return (
    <AdminLayout title="Übersicht">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Beiträge gesamt</p>
          <p className="mt-1 font-display text-xl font-semibold" data-testid="text-stat-posts">{posts?.length ?? "–"}</p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Entwürfe</p>
          <p className="mt-1 font-display text-xl font-semibold">{drafts.length}</p>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Anstehende Termine</p>
          <p className="mt-1 font-display text-xl font-semibold">{upcoming.length}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Neueste Beiträge</h2>
          <div className="space-y-2">
            {(posts ?? []).slice(0, 6).map((p) => (
              <Link key={p.id} href={`/intern/beitraege/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary/60">
                <span className="truncate">{p.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDate(p.publishedAt)}</span>
              </Link>
            ))}
            {!posts?.length && <p className="text-sm text-muted-foreground">Keine Beiträge sichtbar.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Anstehende Termine</h2>
          <div className="space-y-2">
            {upcoming.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
                <span className="truncate">{e.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDate(e.date)}</span>
              </div>
            ))}
            {!upcoming.length && <p className="text-sm text-muted-foreground">Keine anstehenden Termine.</p>}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground"><Flame className="h-4 w-4 text-primary" /> Schnellstart</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {(can("einsaetze") || can("neuigkeiten")) && <li>Neuer Einsatzbericht: „Beiträge & Einsätze" → „Neuer Beitrag"</li>}
          {can("termine") && <li>Termine pflegen unter „Termine"</li>}
          {user?.role === "admin" && <li>Benutzer anlegen und Berechtigungen vergeben unter „Benutzer & Rechte"</li>}
        </ul>
      </div>
    </AdminLayout>
  );
}

// ---------- Konto / Passwort ändern ----------
export function AdminKonto() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authRequest(token, "POST", "/api/auth/change-password", { oldPassword: oldPw, newPassword: newPw });
      toast({ title: "Passwort geändert" });
      setOldPw(""); setNewPw("");
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Mein Konto">
      <form onSubmit={submit} className="max-w-md space-y-4 rounded-2xl border border-card-border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="oldpw">Aktuelles Passwort</Label>
          <Input id="oldpw" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} required data-testid="input-old-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newpw">Neues Passwort (min. 8 Zeichen)</Label>
          <Input id="newpw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} data-testid="input-new-password" />
        </div>
        <Button type="submit" disabled={busy} data-testid="button-change-password">Passwort ändern</Button>
      </form>
    </AdminLayout>
  );
}
