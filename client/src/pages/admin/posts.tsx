import { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Plus, Trash2, ArrowLeft, ImagePlus, Loader2, X, ArrowUp, ArrowDown } from "lucide-react";
import type { Post, Category } from "@shared/schema";
import { useAuth, authRequest, uploadFiles, withBase } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/editor";
import { LocationField } from "@/components/map";
import { MediaPickerButton } from "@/components/media-picker";
import { AdminLayout, useAdminQuery } from "./core";
import { formatDate } from "@/lib/format";

function invalidateAll() {
  queryClient.invalidateQueries();
}

// ---------- Liste ----------
export function AdminPosts() {
  const { data: posts, isLoading } = useAdminQuery<Post[]>("/api/admin/posts");
  const { data: categories } = useAdminQuery<Category[]>("/api/categories");
  const [filter, setFilter] = useState<string>("alle");

  const catName = (id: number) => categories?.find((c) => c.id === id)?.name ?? "";
  const filtered = (posts ?? []).filter((p) => {
    if (filter === "alle") return true;
    if (filter === "entwurf") return p.status === "draft";
    return String(p.categoryId) === filter;
  });

  return (
    <AdminLayout title="Beiträge & Einsätze">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === "alle"} onClick={() => setFilter("alle")}>Alle</FilterChip>
          {categories?.map((c) => (
            <FilterChip key={c.id} active={filter === String(c.id)} onClick={() => setFilter(String(c.id))}>
              {c.name}
            </FilterChip>
          ))}
          <FilterChip active={filter === "entwurf"} onClick={() => setFilter("entwurf")}>Entwürfe</FilterChip>
        </div>
        <Link href="/intern/beitraege/neu">
          <Button data-testid="button-new-post"><Plus className="mr-1.5 h-4 w-4" /> Neuer Beitrag</Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/intern/beitraege/${p.id}`}
              data-testid={`row-admin-post-${p.id}`}
              className="flex items-center gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0 hover:bg-secondary/50"
            >
              <span className="hidden w-24 shrink-0 font-mono text-xs text-muted-foreground sm:block">
                {formatDate(p.publishedAt)}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
              <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{catName(p.categoryId)}</Badge>
              {p.status === "draft" && <Badge className="shrink-0">Entwurf</Badge>}
            </Link>
          ))}
          {!filtered.length && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Keine Beiträge in dieser Ansicht.</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ---------- Editor ----------
const EMPTY = {
  title: "", content: "", excerpt: "", categoryId: 0, publishedAt: "",
  featuredImage: null as string | null, status: "published", stichwort: "", ort: "",
  lat: null as number | null, lng: null as number | null,
  /** Weitere Bilder als Galerie unter dem Text */
  images: [] as string[],
};

/** Die Galerie steht in der Datenbank als JSON-Liste. */
function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function AdminPostEditor() {
  const [, params] = useRoute("/intern/beitraege/:id");
  const isNew = params?.id === "neu";
  const id = isNew ? null : Number(params?.id);
  const [, navigate] = useLocation();
  const { token, can } = useAuth();
  const { toast } = useToast();

  const { data: categories } = useAdminQuery<Category[]>("/api/categories");
  const { data: existing, isLoading } = useAdminQuery<Post>(`/api/admin/posts/${id}`, !isNew);

  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        content: existing.content,
        excerpt: existing.excerpt,
        categoryId: existing.categoryId,
        publishedAt: existing.publishedAt.slice(0, 16),
        featuredImage: existing.featuredImage,
        status: existing.status,
        stichwort: existing.stichwort ?? "",
        ort: existing.ort ?? "",
        lat: existing.lat ?? null,
        lng: existing.lng ?? null,
        images: parseImages(existing.images),
      });
    }
  }, [existing]);

  // Standard-Datum für neue Beiträge
  useEffect(() => {
    if (isNew && !form.publishedAt) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setForm((f) => ({ ...f, publishedAt: now.toISOString().slice(0, 16) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  const allowedCategories = (categories ?? []).filter((c) =>
    c.isEinsatz ? can("einsaetze") : can("neuigkeiten")
  );
  const selectedCat = categories?.find((c) => c.id === form.categoryId);

  const save = async (status: string) => {
    if (!form.title.trim()) {
      toast({ title: "Bitte einen Titel eingeben", variant: "destructive" });
      return;
    }
    if (!form.categoryId) {
      toast({ title: "Bitte eine Kategorie wählen", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content,
        excerpt: form.excerpt,
        categoryId: form.categoryId,
        publishedAt: new Date(form.publishedAt || Date.now()).toISOString(),
        featuredImage: form.featuredImage,
        status,
        stichwort: selectedCat?.isEinsatz ? form.stichwort || null : null,
        ort: selectedCat?.isEinsatz ? form.ort || null : null,
        lat: form.lat,
        lng: form.lng,
        authorName: "",
        images: JSON.stringify(form.images),
      };
      if (isNew) {
        await authRequest(token, "POST", "/api/admin/posts", payload);
      } else {
        await authRequest(token, "PATCH", `/api/admin/posts/${id}`, payload);
      }
      invalidateAll();
      toast({ title: status === "draft" ? "Als Entwurf gespeichert" : "Beitrag veröffentlicht" });
      navigate("/intern/beitraege");
    } catch (err: any) {
      toast({ title: "Fehler beim Speichern", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm("Diesen Beitrag wirklich löschen?")) return;
    try {
      await authRequest(token, "DELETE", `/api/admin/posts/${id}`);
      invalidateAll();
      toast({ title: "Beitrag gelöscht" });
      navigate("/intern/beitraege");
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    }
  };

  const uploadFeatured = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const created = await uploadFiles(token, files);
      setForm((f) => ({ ...f, featuredImage: created[0].url }));
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // ---------- Galerie ----------
  /** Nimmt Bilder in die Galerie auf; bereits enthaltene werden übersprungen. */
  const addImages = (urls: string[]) =>
    setForm((f) => ({ ...f, images: [...f.images, ...urls.filter((u) => !f.images.includes(u))] }));

  const uploadGallery = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadingGallery(true);
    try {
      addImages((await uploadFiles(token, files)).map((m) => m.url));
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeImage = (url: string) =>
    setForm((f) => ({ ...f, images: f.images.filter((u) => u !== url) }));

  /** Verschiebt ein Bild um eine Position nach vorn oder hinten. */
  const moveImage = (index: number, richtung: -1 | 1) =>
    setForm((f) => {
      const ziel = index + richtung;
      if (ziel < 0 || ziel >= f.images.length) return f;
      const images = [...f.images];
      [images[index], images[ziel]] = [images[ziel], images[index]];
      return { ...f, images };
    });

  if (!isNew && isLoading) {
    return (
      <AdminLayout title="Beitrag bearbeiten">
        <Skeleton className="h-96 rounded-2xl" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={isNew ? "Neuer Beitrag" : "Beitrag bearbeiten"}>
      <Link href="/intern/beitraege" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück zur Liste
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title" data-testid="input-post-title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="z. B. Brand B1 – Kleinbrand Strommast, Hölding"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Text</Label>
            <RichTextEditor
              value={existing?.content ?? ""}
              onChange={(html) => setForm((f) => ({ ...f, content: html }))}
              placeholder="Einsatz- oder Beitragstext … Über das Bild-Symbol können Fotos direkt in den Text eingefügt werden."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Kurzbeschreibung (für Übersichten, optional)</Label>
            <Input
              id="excerpt" data-testid="input-post-excerpt" value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              placeholder="Ein bis zwei Sätze Zusammenfassung"
            />
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Kategorie *</Label>
            <Select
              value={form.categoryId ? String(form.categoryId) : undefined}
              onValueChange={(v) => setForm({ ...form, categoryId: Number(v) })}
            >
              <SelectTrigger data-testid="select-post-category"><SelectValue placeholder="Kategorie wählen" /></SelectTrigger>
              <SelectContent>
                {allowedCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCat?.isEinsatz === 1 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="stichwort">Einsatzstichwort</Label>
                <Input
                  id="stichwort" data-testid="input-post-stichwort" value={form.stichwort}
                  onChange={(e) => setForm({ ...form, stichwort: e.target.value })}
                  placeholder="z. B. Brand B1, THL 2, BMA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ort">Einsatzort</Label>
                <Input
                  id="ort" data-testid="input-post-ort" value={form.ort}
                  onChange={(e) => setForm({ ...form, ort: e.target.value })}
                  placeholder="z. B. Hölding"
                />
              </div>
            </>
          )}

          <LocationField
            lat={form.lat}
            lng={form.lng}
            onChange={(la, ln) => setForm((f) => ({ ...f, lat: la, lng: ln }))}
          />

          <div className="space-y-1.5">
            <Label htmlFor="published">Datum & Uhrzeit</Label>
            <Input
              id="published" data-testid="input-post-date" type="datetime-local" value={form.publishedAt}
              onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Titelbild</Label>
            {form.featuredImage ? (
              <div className="relative overflow-hidden rounded-xl border border-border">
                <img src={withBase(form.featuredImage)} alt="" className="aspect-[3/2] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, featuredImage: null })}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5"
                  data-testid="button-remove-featured"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex aspect-[3/2] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-input">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                Bild hochladen
                <input
                  type="file" accept="image/*" className="hidden" data-testid="input-featured-upload"
                  onChange={(e) => uploadFeatured(e.target.files)}
                />
              </label>
            )}
            <MediaPickerButton
              label={form.featuredImage ? "Anderes Bild wählen" : "Aus Mediathek wählen"}
              testId="button-featured-from-library"
              onSelect={(urls) => setForm((f) => ({ ...f, featuredImage: urls[0] }))}
            />
          </div>

          {/* Weitere Bilder: erscheinen als Galerie unter dem Beitragstext */}
          <div className="space-y-1.5">
            <Label>Weitere Bilder</Label>
            <p className="text-xs text-muted-foreground">
              Erscheinen als Bilderreihe unter dem Text. Reihenfolge mit den Pfeilen ändern.
            </p>
            {form.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2" data-testid="gallery-editor">
                {form.images.map((url, i) => (
                  <div key={url} className="group relative overflow-hidden rounded-lg border border-border">
                    <img src={withBase(url)} alt="" className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      title="Bild entfernen"
                      data-testid={`button-remove-gallery-${i}`}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1 py-0.5">
                      <button
                        type="button" onClick={() => moveImage(i, -1)} disabled={i === 0}
                        title="Nach vorn" data-testid={`button-gallery-up-${i}`}
                        className="p-0.5 text-white/80 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button" onClick={() => moveImage(i, 1)} disabled={i === form.images.length - 1}
                        title="Nach hinten" data-testid={`button-gallery-down-${i}`}
                        className="p-0.5 text-white/80 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:border-input">
                {uploadingGallery ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                Hochladen
                <input
                  type="file" accept="image/*" multiple className="hidden" data-testid="input-gallery-upload"
                  onChange={(e) => { uploadGallery(e.target.files); e.target.value = ""; }}
                />
              </label>
              <MediaPickerButton
                multiple
                alreadyUsed={form.images}
                testId="button-gallery-from-library"
                onSelect={addImages}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <Button onClick={() => save("published")} disabled={busy} data-testid="button-save-publish">
              {busy ? "Speichern …" : "Veröffentlichen"}
            </Button>
            <Button variant="secondary" onClick={() => save("draft")} disabled={busy} data-testid="button-save-draft">
              Als Entwurf speichern
            </Button>
            {!isNew && (
              <Button variant="ghost" onClick={remove} className="text-destructive" data-testid="button-delete-post">
                <Trash2 className="mr-1.5 h-4 w-4" /> Löschen
              </Button>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
