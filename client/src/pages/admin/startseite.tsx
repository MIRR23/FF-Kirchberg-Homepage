import { useEffect, useState } from "react";
import type { HeroSettings } from "@shared/schema";
import { DEFAULT_HERO_SETTINGS } from "@shared/schema";
import { useAuth, authRequest, withBase } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { renderHeroTitle } from "@/components/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminLayout, useAdminQuery } from "./core";
import { ImageField } from "./content";

/** Verwaltung des Hero-Bereichs (großes Bild + Texte) der Startseite. */
export function AdminStartseite() {
  const { token } = useAuth();
  const { toast } = useToast();
  const { data: saved, isLoading } = useAdminQuery<HeroSettings>("/api/settings/hero");
  const [form, setForm] = useState<HeroSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved && !form) setForm(saved);
  }, [saved, form]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await authRequest(token, "PUT", "/api/admin/settings/hero", form);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/hero"] });
      toast({ title: "Startseite gespeichert" });
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setForm({ ...DEFAULT_HERO_SETTINGS });

  if (isLoading || !form) {
    return (
      <AdminLayout title="Startseite">
        <Skeleton className="h-64 rounded-2xl" />
      </AdminLayout>
    );
  }

  const overlay = form.overlay / 100;
  const previewImage = form.image; // Vorschau zeigt bei Automatik das Ersatzbild

  return (
    <AdminLayout title="Startseite">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Hier wird der obere Bereich der Startseite (großes Bild, Überschrift und Einleitungstext) gepflegt.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formular */}
        <div className="space-y-5 rounded-2xl border border-card-border bg-card p-5">
          <div className="space-y-1.5">
            <Label>Bildquelle</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as HeroSettings["mode"] })}>
              <SelectTrigger data-testid="select-hero-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Eigenes Bild</SelectItem>
                <SelectItem value="auto">Automatisch – Bild des neuesten Einsatzberichts</SelectItem>
              </SelectContent>
            </Select>
            {form.mode === "auto" && (
              <p className="text-xs text-muted-foreground">
                Ist kein Beitragsbild vorhanden, wird das unten gewählte Bild als Ersatz angezeigt.
              </p>
            )}
          </div>

          <ImageField
            value={form.image}
            onChange={(v) => setForm({ ...form, image: v })}
            label={form.mode === "custom" ? "Hero-Bild" : "Ersatzbild"}
            aspect="aspect-[21/9]"
          />

          <div className="space-y-1.5">
            <Label>Darstellung</Label>
            <Select value={form.fit} onValueChange={(v) => setForm({ ...form, fit: v as HeroSettings["fit"] })}>
              <SelectTrigger data-testid="select-hero-fit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Füllend – Bild füllt die ganze Fläche (Fotos)</SelectItem>
                <SelectItem value="contain">Eingepasst – Bild wird vollständig gezeigt (Logos/Grafiken)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Abdunkelung: {form.overlay} %</Label>
            <Slider
              value={[form.overlay]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => setForm({ ...form, overlay: v })}
              data-testid="slider-hero-overlay"
            />
            <p className="text-xs text-muted-foreground">
              Dunkelt das Bild ab, damit die Überschrift gut lesbar bleibt.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Überschrift</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              data-testid="input-hero-title"
            />
            <p className="text-xs text-muted-foreground">
              Ein Wort zwischen zwei Sternchen wird rot hervorgehoben, z. B. „Wenn jede *Minute* zählt."
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Einleitungstext</Label>
            <Textarea
              value={form.intro}
              onChange={(e) => setForm({ ...form, intro: e.target.value })}
              rows={3}
              data-testid="input-hero-intro"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Alternativtext des Bildes (Barrierefreiheit)</Label>
            <Input
              value={form.alt}
              onChange={(e) => setForm({ ...form, alt: e.target.value })}
              placeholder="Kurze Beschreibung des Bildinhalts"
              data-testid="input-hero-alt"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={save} disabled={busy} className="flex-1" data-testid="button-save-hero">
              {busy ? "Speichern …" : "Speichern"}
            </Button>
            <Button variant="outline" onClick={reset} data-testid="button-reset-hero">
              Standard wiederherstellen
            </Button>
          </div>
        </div>

        {/* Vorschau */}
        <div>
          <p className="mb-2 text-sm font-medium">Vorschau</p>
          <div className="relative overflow-hidden rounded-2xl border border-border" style={{ background: "hsl(228 11% 7%)" }}>
            {previewImage && (
              <img
                src={withBase(previewImage)}
                alt=""
                className={`absolute inset-0 h-full w-full ${form.fit === "contain" ? "object-contain" : "object-cover"}`}
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, hsl(228 11% 7% / ${overlay.toFixed(2)}) 0%, hsl(228 11% 7% / ${(overlay * 0.55).toFixed(2)}) 40%, hsl(228 11% 7% / .94) 88%, hsl(228 11% 7%) 100%)`,
              }}
            />
            <div className="relative px-6 pb-10 pt-16">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-chart-2">
                <span className="inline-block h-0.5 w-5 bg-chart-2" />
                Freiwillige Feuerwehr Kirchberg · seit 1879
              </p>
              <h2 className="mt-3 max-w-[14ch] font-display text-2xl font-semibold leading-[1.05]">
                {renderHeroTitle(form.title)}
              </h2>
              <p className="mt-3 max-w-md text-xs leading-relaxed text-foreground/80">{form.intro}</p>
            </div>
          </div>
          {form.mode === "auto" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Hinweis: Bei „Automatisch" zeigt die Website das Titelbild des neuesten Einsatzberichts – die Vorschau hier zeigt nur das Ersatzbild.
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
