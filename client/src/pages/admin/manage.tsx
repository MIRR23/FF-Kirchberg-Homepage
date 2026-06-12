import { useState } from "react";
import { Plus, Trash2, Pencil, Upload, Loader2, Copy, ShieldCheck } from "lucide-react";
import type { Page, MediaItem, SafeUser, PermissionArea } from "@shared/schema";
import { PERMISSION_AREAS } from "@shared/schema";
import { useAuth, authRequest, uploadFiles, withBase } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/editor";
import { AdminLayout, useAdminQuery } from "./core";
import { formatDate } from "@/lib/format";

export const AREA_LABELS: Record<PermissionArea, string> = {
  einsaetze: "Einsätze",
  neuigkeiten: "Neuigkeiten & Berichte",
  termine: "Termine",
  fahrzeuge: "Fahrzeuge",
  mitglieder: "Mitglieder",
  seiten: "Seiten & Texte",
  medien: "Bilder löschen",
};

// =============== SEITEN & TEXTE ===============
export function AdminPages() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: pages, isLoading } = useAdminQuery<Page[]>("/api/admin/pages");
  const [editing, setEditing] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (p: Page) => {
    setEditing(p);
    setTitle(p.title);
    setContent(p.content);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await authRequest(token, "PATCH", `/api/admin/pages/${editing.id}`, { title, content });
      queryClient.invalidateQueries();
      toast({ title: "Seite gespeichert" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Seiten & Texte">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Hier können die festen Texte der Website bearbeitet werden – z. B. „Über uns", Chronik, Impressum oder Datenschutz.
      </p>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
          {(pages ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => open(p)}
              data-testid={`row-admin-page-${p.slug}`}
              className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-secondary/50"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
              <span className="hidden font-mono text-xs text-muted-foreground sm:block">/{p.slug}</span>
              <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seite bearbeiten</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Titel</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-page-title" />
              </div>
              <div className="space-y-1.5">
                <Label>Inhalt</Label>
                <RichTextEditor value={editing.content} onChange={setContent} minHeight={320} />
              </div>
              <Button onClick={save} disabled={busy} className="w-full" data-testid="button-save-page">
                {busy ? "Speichern …" : "Speichern"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// =============== BILDER / MEDIEN ===============
export function AdminMedia() {
  const { token, can } = useAuth();
  const { toast } = useToast();
  const { data: items, isLoading } = useAdminQuery<MediaItem[]>("/api/admin/media");
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState(48);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      await uploadFiles(token, files);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      toast({ title: `${files.length} Bild(er) hochgeladen` });
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Bild wirklich löschen? Es wird ggf. in Beiträgen nicht mehr angezeigt.")) return;
    await authRequest(token, "DELETE", `/api/admin/media/${id}`);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
    toast({ title: "Bild gelöscht" });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(withBase(url)).then(
      () => toast({ title: "Bild-Adresse kopiert" }),
      () => toast({ title: "Kopieren nicht möglich", variant: "destructive" })
    );
  };

  return (
    <AdminLayout title="Bilder">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{items?.length ?? 0} Bilder in der Mediathek</p>
        <label>
          <Button asChild disabled={uploading}>
            <span data-testid="button-upload-media">
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Bilder hochladen
            </span>
          </Button>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} data-testid="input-media-upload" />
        </label>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {(items ?? []).slice(0, shown).map((m) => (
              <div key={m.id} data-testid={`card-media-${m.id}`} className="group relative overflow-hidden rounded-xl border border-card-border bg-card">
                <img src={withBase(m.url)} alt={m.title} loading="lazy" className="aspect-square w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => copyUrl(m.url)} title="Adresse kopieren" className="p-1 text-white/80 hover:text-white">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {can("medien") && (
                    <button onClick={() => remove(m.id)} title="Löschen" className="p-1 text-white/80 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {items && items.length > shown && (
            <div className="mt-6 text-center">
              <Button variant="secondary" onClick={() => setShown(shown + 48)}>Mehr anzeigen ({items.length - shown} weitere)</Button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// =============== BENUTZER & RECHTE ===============
interface UserForm {
  id?: number;
  username: string;
  displayName: string;
  password: string;
  role: string;
  permissions: PermissionArea[];
  active: number;
}

const EMPTY_USER: UserForm = { username: "", displayName: "", password: "", role: "editor", permissions: [], active: 1 };

export function AdminUsers() {
  const { token, user: me } = useAuth();
  const { toast } = useToast();
  const { data: users, isLoading } = useAdminQuery<SafeUser[]>("/api/admin/users");
  const [editing, setEditing] = useState<UserForm | null>(null);
  const [busy, setBusy] = useState(false);

  const openEdit = (u: SafeUser) => {
    setEditing({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      password: "",
      role: u.role,
      permissions: (() => { try { return JSON.parse(u.permissions); } catch { return []; } })(),
      active: u.active,
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      if (editing.id) {
        const payload: any = {
          displayName: editing.displayName,
          role: editing.role,
          permissions: editing.permissions,
          active: editing.active,
        };
        if (editing.password) payload.password = editing.password;
        await authRequest(token, "PATCH", `/api/admin/users/${editing.id}`, payload);
      } else {
        await authRequest(token, "POST", "/api/admin/users", editing);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Benutzer gespeichert" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Benutzer wirklich löschen?")) return;
    try {
      await authRequest(token, "DELETE", `/api/admin/users/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Benutzer gelöscht" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

  const togglePerm = (p: PermissionArea) => {
    if (!editing) return;
    setEditing({
      ...editing,
      permissions: editing.permissions.includes(p)
        ? editing.permissions.filter((x) => x !== p)
        : [...editing.permissions, p],
    });
  };

  return (
    <AdminLayout title="Benutzer & Rechte">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Benutzer anlegen und festlegen, welche Bereiche sie pflegen dürfen. Administratoren haben immer alle Rechte.
        </p>
        <Button onClick={() => setEditing({ ...EMPTY_USER })} data-testid="button-new-user">
          <Plus className="mr-1.5 h-4 w-4" /> Neuer Benutzer
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
          {(users ?? []).map((u) => {
            const perms: string[] = (() => { try { return JSON.parse(u.permissions); } catch { return []; } })();
            return (
              <div key={u.id} data-testid={`row-admin-user-${u.id}`} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {u.displayName}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">@{u.username}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.role === "admin" ? (
                      <Badge><ShieldCheck className="mr-1 h-3 w-3" /> Administrator</Badge>
                    ) : perms.length ? (
                      perms.map((p) => <Badge key={p} variant="secondary">{AREA_LABELS[p as PermissionArea] ?? p}</Badge>)
                    ) : (
                      <Badge variant="outline">Keine Rechte</Badge>
                    )}
                    {!u.active && <Badge variant="outline">Deaktiviert</Badge>}
                  </div>
                </div>
                <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                {u.id !== me?.id && (
                  <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => remove(u.id)} data-testid={`button-delete-user-${u.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Benutzer bearbeiten" : "Neuer Benutzer"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Benutzername *</Label>
                  <Input
                    value={editing.username}
                    onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                    disabled={!!editing.id}
                    data-testid="input-user-username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Anzeigename *</Label>
                  <Input value={editing.displayName} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} data-testid="input-user-displayname" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{editing.id ? "Neues Passwort (leer = unverändert)" : "Passwort * (min. 8 Zeichen)"}</Label>
                <Input type="password" value={editing.password} onChange={(e) => setEditing({ ...editing, password: e.target.value })} data-testid="input-user-password" />
              </div>
              <div className="space-y-1.5">
                <Label>Rolle</Label>
                <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Redakteur (Rechte unten wählbar)</SelectItem>
                    <SelectItem value="admin">Administrator (alle Rechte)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editing.role === "editor" && (
                <div className="space-y-2">
                  <Label>Berechtigungen</Label>
                  <div className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
                    {PERMISSION_AREAS.map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={editing.permissions.includes(p)}
                          onCheckedChange={() => togglePerm(p)}
                          data-testid={`checkbox-perm-${p}`}
                        />
                        {AREA_LABELS[p]}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {editing.id && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!editing.active}
                    onCheckedChange={(c) => setEditing({ ...editing, active: c ? 1 : 0 })}
                    data-testid="checkbox-user-active"
                  />
                  Benutzer aktiv
                </label>
              )}
              <Button onClick={save} disabled={busy} className="w-full" data-testid="button-save-user">
                {busy ? "Speichern …" : "Speichern"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
