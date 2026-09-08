import { useState } from "react";
import { Plus, Trash2, Pencil, ImagePlus, Loader2, X, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import type { Event, Vehicle, Member } from "@shared/schema";
import { useAuth, authRequest, uploadFiles, withBase } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/editor";
import { LocationField } from "@/components/map";
import { MediaPickerButton } from "@/components/media-picker";
import { GalleryField, parseImages } from "@/components/gallery";
import { AdminLayout, useAdminQuery } from "./core";
import { formatDate } from "@/lib/format";

export function ImageField({
  value, onChange, label = "Bild", aspect = "aspect-[3/2]",
}: { value: string | null; onChange: (v: string | null) => void; label?: string; aspect?: string }) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const created = await uploadFiles(token, files);
      onChange(created[0].url);
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <div className="relative w-full overflow-hidden rounded-xl border border-border">
          <img src={withBase(value)} alt="" className={`${aspect} w-full object-cover`} />
          <button type="button" onClick={() => onChange(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label className={`flex ${aspect} w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-input`}>
          {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
          Bild hochladen
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files)} />
        </label>
      )}
      <MediaPickerButton
        label={value ? "Anderes Bild wählen" : "Aus Mediathek wählen"}
        testId="button-image-from-library"
        onSelect={(urls) => onChange(urls[0])}
      />
    </div>
  );
}

// =============== TERMINE ===============
const EMPTY_EVENT = {
  title: "", date: "", time: "", location: "", description: "", kind: "veranstaltung",
  lat: null as number | null, lng: null as number | null,
};

export function AdminEvents() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: events, isLoading } = useAdminQuery<Event[]>("/api/events");
  const [editing, setEditing] = useState<Partial<Event> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing?.title || !editing?.date) {
      toast({ title: "Titel und Datum sind erforderlich", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...EMPTY_EVENT, ...editing };
      if (editing.id) {
        await authRequest(token, "PATCH", `/api/admin/events/${editing.id}`, payload);
      } else {
        await authRequest(token, "POST", "/api/admin/events", payload);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Termin gespeichert" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Termin wirklich löschen?")) return;
    try {
      await authRequest(token, "DELETE", `/api/admin/events/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Termin gelöscht" });
    } catch (err: any) {
      toast({ title: "Löschen fehlgeschlagen", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Termine">
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_EVENT })} data-testid="button-new-event">
          <Plus className="mr-1.5 h-4 w-4" /> Neuer Termin
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
          {(events ?? []).map((e) => (
            <div key={e.id} data-testid={`row-admin-event-${e.id}`} className="flex items-center gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0">
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{formatDate(e.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[e.kind === "uebung" ? "Übung" : "Veranstaltung", e.time && `${e.time} Uhr`, e.location].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => setEditing(e)} data-testid={`button-edit-event-${e.id}`}>
                <Pencil className="h-4 w-4" />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => remove(e.id)} data-testid={`button-delete-event-${e.id}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!events?.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Noch keine Termine.</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Titel *</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} data-testid="input-event-title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Datum *</Label>
                  <Input type="date" value={editing.date ?? ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} data-testid="input-event-date" />
                </div>
                <div className="space-y-1.5">
                  <Label>Uhrzeit</Label>
                  <Input type="time" value={editing.time ?? ""} onChange={(e) => setEditing({ ...editing, time: e.target.value })} data-testid="input-event-time" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ort</Label>
                <Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="z. B. Gerätehaus Kirchberg" data-testid="input-event-location" />
              </div>
              <LocationField
                lat={editing.lat ?? null}
                lng={editing.lng ?? null}
                onChange={(la, ln) => setEditing((ed) => ({ ...ed!, lat: la, lng: ln }))}
              />
              <div className="space-y-1.5">
                <Label>Art</Label>
                <Select value={editing.kind ?? "veranstaltung"} onValueChange={(v) => setEditing({ ...editing, kind: v })}>
                  <SelectTrigger data-testid="select-event-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veranstaltung">Veranstaltung</SelectItem>
                    <SelectItem value="uebung">Übung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Beschreibung</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} data-testid="input-event-description" />
              </div>
              <Button onClick={save} disabled={busy} className="w-full" data-testid="button-save-event">
                {busy ? "Speichern …" : "Speichern"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// =============== FAHRZEUGE ===============
const EMPTY_VEHICLE = { name: "", type: "", description: "", image: null as string | null, images: "[]", sortOrder: 0 };

export function AdminVehicles() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: vehicles, isLoading } = useAdminQuery<Vehicle[]>("/api/vehicles");
  const [editing, setEditing] = useState<Partial<Vehicle> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing?.name) {
      toast({ title: "Name ist erforderlich", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...EMPTY_VEHICLE, ...editing };
      if (editing.id) {
        await authRequest(token, "PATCH", `/api/admin/vehicles/${editing.id}`, payload);
      } else {
        await authRequest(token, "POST", "/api/admin/vehicles", payload);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Fahrzeug gespeichert" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Fahrzeug wirklich löschen?")) return;
    try {
      await authRequest(token, "DELETE", `/api/admin/vehicles/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Fahrzeug gelöscht" });
    } catch (err: any) {
      toast({ title: "Löschen fehlgeschlagen", description: err.message, variant: "destructive" });
    }
  };

  return (
    <AdminLayout title="Fahrzeuge">
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_VEHICLE, sortOrder: (vehicles?.length ?? 0) + 1 })} data-testid="button-new-vehicle">
          <Plus className="mr-1.5 h-4 w-4" /> Neues Fahrzeug
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(vehicles ?? []).map((v) => (
            <div key={v.id} data-testid={`card-admin-vehicle-${v.id}`} className="overflow-hidden rounded-2xl border border-card-border bg-card">
              {v.image ? (
                <img src={withBase(v.image)} alt={v.name} className="aspect-[3/2] w-full object-cover" />
              ) : (
                <div className="flex aspect-[3/2] items-center justify-center bg-secondary/50 text-sm text-muted-foreground">Kein Bild</div>
              )}
              <div className="flex items-center gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.type}</p>
                </div>
                <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => setEditing(v)} data-testid={`button-edit-vehicle-${v.id}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => remove(v.id)} data-testid={`button-delete-vehicle-${v.id}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {!vehicles?.length && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Noch keine Fahrzeuge.</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="z. B. LF 10/6" data-testid="input-vehicle-name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Typ</Label>
                  <Input value={editing.type ?? ""} onChange={(e) => setEditing({ ...editing, type: e.target.value })} placeholder="z. B. Löschgruppenfahrzeug" data-testid="input-vehicle-type" />
                </div>
              </div>
              <ImageField value={editing.image ?? null} onChange={(v) => setEditing({ ...editing, image: v })} label="Fahrzeugbild" />
              <GalleryField
                value={parseImages(editing.images)}
                onChange={(images) => setEditing({ ...editing, images: JSON.stringify(images) })}
                hint="Erscheinen als Bilderreihe unter der Fahrzeugbeschreibung."
                testId="vehicle-gallery"
              />
              <div className="space-y-1.5">
                <Label>Beschreibung</Label>
                <RichTextEditor
                  value={editing.id ? (editing.description ?? "") : ""}
                  onChange={(html) => setEditing((ed) => ({ ...ed!, description: html }))}
                  minHeight={180}
                  placeholder="Technische Daten, Ausrüstung, Baujahr …"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sortierung (kleinere Zahl = weiter oben)</Label>
                <Input type="number" value={editing.sortOrder ?? 0} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })} data-testid="input-vehicle-sort" />
              </div>
              <Button onClick={save} disabled={busy} className="w-full" data-testid="button-save-vehicle">
                {busy ? "Speichern …" : "Speichern"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// =============== MITGLIEDER ===============
const EMPTY_MEMBER = { name: "", funktion: "", gruppe: "aktive", image: null as string | null, sortOrder: 0 };

export function AdminMembers() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: members, isLoading } = useAdminQuery<Member[]>("/api/members");
  const [editing, setEditing] = useState<Partial<Member> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing?.name) {
      toast({ title: "Name ist erforderlich", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...EMPTY_MEMBER, ...editing };
      // Neue Einträge hinten anhängen statt an den Anfang zu setzen
      if (!editing.id) {
        const gruppe = payload.gruppe ?? "aktive";
        payload.sortOrder = (members ?? []).filter((m) => m.gruppe === gruppe).length + 1;
      }
      if (editing.id) {
        await authRequest(token, "PATCH", `/api/admin/members/${editing.id}`, payload);
      } else {
        await authRequest(token, "POST", "/api/admin/members", payload);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Mitglied gespeichert" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Eintrag wirklich löschen?")) return;
    try {
      await authRequest(token, "DELETE", `/api/admin/members/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      toast({ title: "Eintrag gelöscht" });
    } catch (err: any) {
      toast({ title: "Löschen fehlgeschlagen", description: err.message, variant: "destructive" });
    }
  };

  // ---------- Reihenfolge ----------
  // Gezogen wird am Desktop; auf Handy und Tablet funktioniert das Ziehen
  // nicht zuverlässig, dafür gibt es die Pfeile.
  const [dragId, setDragId] = useState<number | null>(null);
  const [order, setOrder] = useState<Record<string, number[]>>({});

  /** Aktuelle Reihenfolge einer Gruppe – bevorzugt die noch nicht gespeicherte. */
  const listOf = (gruppe: string) => {
    const alle = (members ?? []).filter((m) => m.gruppe === gruppe);
    const eigene = order[gruppe];
    if (!eigene) return alle;
    const nachId = new Map(alle.map((m) => [m.id, m]));
    const sortiert = eigene.map((id) => nachId.get(id)).filter((m): m is Member => !!m);
    // Zwischenzeitlich neu angelegte Einträge hinten anhängen
    return [...sortiert, ...alle.filter((m) => !eigene.includes(m.id))];
  };

  /** Speichert die Reihenfolge einer Gruppe. */
  const saveOrder = async (gruppe: string, ids: number[]) => {
    setOrder((o) => ({ ...o, [gruppe]: ids }));
    try {
      await authRequest(token, "POST", "/api/admin/members/reorder", { ids });
      await queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      setOrder((o) => {
        const rest = { ...o };
        delete rest[gruppe];
        return rest;
      });
    } catch (err: any) {
      toast({ title: "Reihenfolge nicht gespeichert", description: err.message, variant: "destructive" });
    }
  };

  /** Verschiebt einen Eintrag um eine Position. */
  const move = (gruppe: string, index: number, richtung: -1 | 1) => {
    const ids = listOf(gruppe).map((m) => m.id);
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= ids.length) return;
    [ids[index], ids[ziel]] = [ids[ziel], ids[index]];
    saveOrder(gruppe, ids);
  };

  /** Legt den gezogenen Eintrag an der Position des Ziels ab. */
  const dropOn = (gruppe: string, zielId: number) => {
    if (dragId === null || dragId === zielId) return;
    const ids = listOf(gruppe).map((m) => m.id);
    const von = ids.indexOf(dragId);
    const nach = ids.indexOf(zielId);
    if (von < 0 || nach < 0) return;
    ids.splice(nach, 0, ...ids.splice(von, 1));
    saveOrder(gruppe, ids);
  };

  const groups: { key: string; label: string }[] = [
    { key: "vorstandschaft", label: "Vorstandschaft & Kommandanten" },
    { key: "aktive", label: "Aktive Mannschaft" },
  ];

  return (
    <AdminLayout title="Mitglieder">
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_MEMBER })} data-testid="button-new-member">
          <Plus className="mr-1.5 h-4 w-4" /> Neues Mitglied
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        groups.map((g) => {
          const list = listOf(g.key);
          return (
            <div key={g.key} className="mb-8">
              <h2 className="mb-1 font-semibold">{g.label}</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Reihenfolge ändern: Eintrag am Griff ziehen oder die Pfeile benutzen.
                So erscheinen die Personen auch auf der Seite „Über uns“.
              </p>
              <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
                {list.map((m, i) => (
                  <div
                    key={m.id}
                    data-testid={`row-admin-member-${m.id}`}
                    draggable
                    onDragStart={() => setDragId(m.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); dropOn(g.key, m.id); setDragId(null); }}
                    className={`flex items-center gap-2 border-b border-border px-3 py-2.5 text-sm last:border-b-0 sm:gap-3 sm:px-4 ${
                      dragId === m.id ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" aria-hidden="true" />
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={() => move(g.key, i, -1)} disabled={i === 0}
                        title="Nach oben" aria-label={`${m.name} nach oben`}
                        data-testid={`button-member-up-${m.id}`}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => move(g.key, i, 1)} disabled={i === list.length - 1}
                        title="Nach unten" aria-label={`${m.name} nach unten`}
                        data-testid={`button-member-down-${m.id}`}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {m.image ? (
                      <img src={withBase(m.image)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded-full bg-secondary" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{m.funktion}</span>
                    </span>
                    <button className="p-1.5 text-muted-foreground hover:text-foreground" onClick={() => setEditing(m)} data-testid={`button-edit-member-${m.id}`}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-muted-foreground hover:text-destructive" onClick={() => remove(m.id)} data-testid={`button-delete-member-${m.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {!list.length && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Keine Einträge.</p>}
              </div>
            </div>
          );
        })
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Mitglied bearbeiten" : "Neues Mitglied"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="input-member-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Funktion</Label>
                <Input value={editing.funktion ?? ""} onChange={(e) => setEditing({ ...editing, funktion: e.target.value })} placeholder="z. B. 1. Kommandant, Atemschutzträger" data-testid="input-member-funktion" />
              </div>
              <div className="space-y-1.5">
                <Label>Gruppe</Label>
                <Select value={editing.gruppe ?? "aktive"} onValueChange={(v) => setEditing({ ...editing, gruppe: v })}>
                  <SelectTrigger data-testid="select-member-gruppe"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vorstandschaft">Vorstandschaft & Kommandanten</SelectItem>
                    <SelectItem value="aktive">Aktive Mannschaft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ImageField value={editing.image ?? null} onChange={(v) => setEditing({ ...editing, image: v })} label="Foto (optional)" aspect="aspect-square max-w-[180px]" />
              <Button onClick={save} disabled={busy} className="w-full" data-testid="button-save-member">
                {busy ? "Speichern …" : "Speichern"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
