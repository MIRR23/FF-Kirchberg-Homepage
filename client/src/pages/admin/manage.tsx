import { useState } from "react";
import { Plus, Trash2, Pencil, Upload, Loader2, Copy, ShieldCheck, FileText, RefreshCw } from "lucide-react";
import type { Page, MediaItem, SafeUser, PermissionArea, DocumentItem, SiteSettings } from "@shared/schema";
import { PERMISSION_AREAS } from "@shared/schema";
import { useAuth, authRequest, uploadFiles, withBase, apiFetch, fileUrl, errorMessage } from "@/lib/auth";
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
  dateien: "Dateien / Downloads",
};

// =============== SEITEN & TEXTE ===============
export function AdminPages() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: pages, isLoading } = useAdminQuery<Page[]>("/api/admin/pages");
  const { data: siteSettings } = useAdminQuery<SiteSettings>("/api/settings/site");
  const [editing, setEditing] = useState<Page | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const linksNewTab = siteSettings?.linksNewTab ?? true;
  const toggleLinksNewTab = async (checked: boolean) => {
    try {
      await authRequest(token, "PUT", "/api/admin/settings/site", { linksNewTab: checked });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/site"] });
      toast({ title: checked ? "Links öffnen jetzt in einem neuen Tab" : "Links öffnen jetzt im selben Tab" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

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

      <div className="mt-6 max-w-2xl rounded-2xl border border-card-border bg-card p-5">
        <h2 className="mb-1 font-semibold">Link-Verhalten</h2>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            checked={linksNewTab}
            onCheckedChange={(c) => toggleLinksNewTab(!!c)}
            data-testid="checkbox-links-new-tab"
            className="mt-0.5"
          />
          <span>
            Links in Beiträgen und Seiten in einem neuen Tab öffnen
            <span className="block text-xs text-muted-foreground">
              Gilt für alle Links in Texten der Website (Standard: eingeschaltet). Die Hauptnavigation ist davon nicht betroffen.
            </span>
          </span>
        </label>
      </div>

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
    try {
      await authRequest(token, "DELETE", `/api/admin/media/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      toast({ title: "Bild gelöscht" });
    } catch (err: any) {
      // Der Server meldet mit 409, wenn das Bild noch verwendet wird. Dann fragen,
      // ob trotzdem gelöscht werden soll (dann per ?force=1 erzwingen).
      const stillUsed = /verwendet/i.test(err.message ?? "");
      if (stillUsed && window.confirm(err.message + "\n\nTrotzdem endgültig löschen?")) {
        try {
          await authRequest(token, "DELETE", `/api/admin/media/${id}?force=1`);
          queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
          toast({ title: "Bild gelöscht" });
        } catch (err2: any) {
          toast({ title: "Löschen fehlgeschlagen", description: err2.message, variant: "destructive" });
        }
        return;
      }
      toast({ title: "Löschen fehlgeschlagen", description: err.message, variant: "destructive" });
    }
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

// =============== DATEIEN / DOWNLOADS ===============
// Dateitypen passend zur Server-Whitelist (routes.ts, DOCUMENT_TYPES)
const DOC_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.csv,.txt,.rtf,.zip,.jpg,.jpeg,.png,.webp,.gif";

/** Authentifizierter Upload/Änderung eines Dokuments (FormData statt JSON). */
async function sendDocumentForm(token: string | null, method: string, url: string, fd: FormData): Promise<any> {
  const res = await apiFetch(url, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "Der Upload wurde abgelehnt."));
  }
  return res.json();
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AdminDocuments() {
  const { token, can } = useAuth();
  const { toast } = useToast();
  const { data: docs, isLoading } = useAdminQuery<DocumentItem[]>("/api/admin/documents");
  const canEdit = can("dateien");
  const [dialog, setDialog] = useState<{ id?: number; title: string; file: File | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacingId, setReplacingId] = useState<number | null>(null);

  /** Vollständige öffentliche Adresse des stabilen Links (zum Kopieren/Teilen). */
  const publicUrl = (slug: string) => new URL(fileUrl(slug), window.location.href).href;

  const copyLink = (slug: string) => {
    navigator.clipboard?.writeText(publicUrl(slug)).then(
      () => toast({ title: "Link kopiert", description: "Der Link bleibt auch beim Austauschen der Datei gültig." }),
      () => toast({ title: "Kopieren nicht möglich", variant: "destructive" })
    );
  };

  const save = async () => {
    if (!dialog) return;
    if (!dialog.id && !dialog.file) {
      toast({ title: "Bitte eine Datei auswählen", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (dialog.title.trim()) fd.append("title", dialog.title.trim());
      if (dialog.file) fd.append("file", dialog.file);
      if (dialog.id) {
        await sendDocumentForm(token, "PATCH", `/api/admin/documents/${dialog.id}`, fd);
      } else {
        await sendDocumentForm(token, "POST", "/api/admin/documents", fd);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: dialog.id ? "Datei aktualisiert" : "Datei hochgeladen" });
      setDialog(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const replaceFile = async (id: number, files: FileList | null) => {
    if (!files?.length) return;
    setReplacingId(id);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      await sendDocumentForm(token, "PATCH", `/api/admin/documents/${id}`, fd);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Datei ausgetauscht", description: "Alle bestehenden Links zeigen jetzt auf die neue Datei." });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setReplacingId(null);
    }
  };

  const remove = async (d: DocumentItem) => {
    if (!window.confirm(`„${d.title}" wirklich löschen? Bestehende Links auf diese Datei funktionieren dann nicht mehr.`)) return;
    try {
      await authRequest(token, "DELETE", `/api/admin/documents/${d.id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      toast({ title: "Datei gelöscht" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Dateien">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Dateien wie das Organigramm oder der Übungsplan bekommen hier einen <strong>dauerhaften Link</strong>.
          Wird die Datei später ausgetauscht, bleibt der Link gleich – nichts muss neu verlinkt werden.
        </p>
        {canEdit && (
          <Button onClick={() => setDialog({ title: "", file: null })} data-testid="button-new-document">
            <Plus className="mr-1.5 h-4 w-4" /> Neue Datei
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
          {(docs ?? []).map((d) => (
            <div key={d.id} data-testid={`row-admin-document-${d.id}`} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[d.originalName, formatSize(d.size), d.updatedAt && `Stand: ${formatDate(d.updatedAt)}`, d.updatedBy && `von ${d.updatedBy}`]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                onClick={() => copyLink(d.slug)}
                title="Dauerhaften Link kopieren"
                data-testid={`button-copy-document-${d.id}`}
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" /> /datei.php?s={d.slug}
              </button>
              <a
                href={publicUrl(d.slug)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Ansehen
              </a>
              {canEdit && (
                <>
                  <label className="cursor-pointer p-1.5 text-muted-foreground hover:text-foreground" title="Datei austauschen (Link bleibt gleich)">
                    {replacingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <input
                      type="file" accept={DOC_ACCEPT} className="hidden"
                      onChange={(e) => { replaceFile(d.id, e.target.files); e.target.value = ""; }}
                      data-testid={`input-replace-document-${d.id}`}
                    />
                  </label>
                  <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => setDialog({ id: d.id, title: d.title, file: null })} title="Umbenennen" data-testid={`button-edit-document-${d.id}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => remove(d)} title="Löschen" data-testid={`button-delete-document-${d.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
          {!docs?.length && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Noch keine Dateien hinterlegt.{canEdit ? " Über „Neue Datei“ kann z. B. das Organigramm als PDF hochgeladen werden." : ""}
            </p>
          )}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Datei bearbeiten" : "Neue Datei"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Bezeichnung {dialog.id ? "" : "(daraus entsteht der dauerhafte Link)"}</Label>
                <Input
                  value={dialog.title}
                  onChange={(e) => setDialog({ ...dialog, title: e.target.value })}
                  placeholder="z. B. Organigramm der Feuerwehr"
                  data-testid="input-document-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{dialog.id ? "Neue Datei (optional – ersetzt die bisherige)" : "Datei *"}</Label>
                <Input
                  type="file" accept={DOC_ACCEPT}
                  onChange={(e) => setDialog({ ...dialog, file: e.target.files?.[0] ?? null })}
                  data-testid="input-document-file"
                />
                <p className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint u. a. – max. 25 MB.</p>
              </div>
              <Button onClick={save} disabled={busy} className="w-full" data-testid="button-save-document">
                {busy ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Speichern …</> : <><Upload className="mr-1.5 h-4 w-4" /> Speichern</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
