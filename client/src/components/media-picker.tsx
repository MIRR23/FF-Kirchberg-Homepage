import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, Search, Check, Images } from "lucide-react";
import type { MediaItem } from "@shared/schema";
import { useAuth, uploadFiles, withBase, authQueryFn } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Auswahl von Bildern aus der Mediathek.
 *
 * Damit lassen sich bereits hochgeladene Bilder – auch die rund 460 von der
 * alten Website übernommenen – mit Beiträgen, Fahrzeugen oder Mitgliedern
 * verknüpfen, ohne sie erneut hochladen zu müssen. Neue Bilder können direkt
 * im Dialog hinzugefügt werden; sie sind danach ebenfalls in der Mediathek.
 */
interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  /** Ausgewählte Bilder übernehmen (bei Einzelauswahl genau eines). */
  onSelect: (urls: string[]) => void;
  /** true = mehrere Bilder auf einmal auswählbar */
  multiple?: boolean;
  /** Bereits verwendete Bilder – werden als „schon verwendet" markiert. */
  alreadyUsed?: string[];
  title?: string;
}

/** Wie viele Bilder zunächst angezeigt werden (die Mediathek ist groß). */
const PAGE_SIZE = 60;

export function MediaPicker({
  open, onClose, onSelect, multiple = false, alreadyUsed = [], title,
}: MediaPickerProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [uploading, setUploading] = useState(false);

  const { data: media, isLoading } = useQuery<MediaItem[]>({
    queryKey: ["/api/admin/media"],
    queryFn: authQueryFn(token),
    enabled: open,
  });

  const used = useMemo(() => new Set(alreadyUsed), [alreadyUsed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("de");
    if (!q) return media ?? [];
    return (media ?? []).filter(
      (m) =>
        m.title.toLocaleLowerCase("de").includes(q) ||
        m.filename.toLocaleLowerCase("de").includes(q),
    );
  }, [media, search]);

  const toggle = (url: string) => {
    if (multiple) {
      setChosen((c) => (c.includes(url) ? c.filter((u) => u !== url) : [...c, url]));
    } else {
      setChosen([url]);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const created = await uploadFiles(token, files);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/media"] });
      // Frisch Hochgeladenes ist fast immer das, was eingefügt werden soll
      const urls = created.map((m: MediaItem) => m.url);
      setChosen((c) => (multiple ? [...c, ...urls] : urls.slice(0, 1)));
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const close = () => {
    setChosen([]);
    setSearch("");
    setShown(PAGE_SIZE);
    onClose();
  };

  const confirm = () => {
    if (chosen.length) onSelect(chosen);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>{title ?? (multiple ? "Bilder auswählen" : "Bild auswählen")}</DialogTitle>
          <DialogDescription>
            {multiple
              ? "Mehrere Bilder anklicken und mit „Übernehmen“ einfügen."
              : "Ein Bild anklicken und mit „Übernehmen“ einfügen."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShown(PAGE_SIZE); }}
              placeholder="Nach Name suchen …"
              className="pl-9"
              data-testid="input-media-search"
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:border-input">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Neue hochladen
            <input
              type="file" accept="image/*" multiple className="hidden"
              data-testid="input-picker-upload"
              onChange={(e) => { upload(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
            </div>
          ) : !filtered.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {search ? "Keine Bilder gefunden." : "Die Mediathek ist noch leer."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {filtered.slice(0, shown).map((m) => {
                  const active = chosen.includes(m.url);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggle(m.url)}
                      title={m.title || m.filename}
                      data-testid={`button-pick-media-${m.id}`}
                      className={`group relative overflow-hidden rounded-lg border-2 transition-colors ${
                        active ? "border-primary" : "border-transparent hover:border-border"
                      }`}
                    >
                      <img
                        src={withBase(m.url)} alt={m.title} loading="lazy"
                        className="aspect-square w-full bg-secondary object-cover"
                      />
                      {active && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {used.has(m.url) && !active && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[10px] text-white/90">
                          schon verwendet
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {filtered.length > shown && (
                <div className="mt-4 text-center">
                  <Button variant="secondary" onClick={() => setShown(shown + PAGE_SIZE)}>
                    Mehr anzeigen ({filtered.length - shown} weitere)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            {chosen.length ? `${chosen.length} ausgewählt` : "Nichts ausgewählt"}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>Abbrechen</Button>
            <Button onClick={confirm} disabled={!chosen.length} data-testid="button-media-confirm">
              Übernehmen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Knopf, der die Mediathek-Auswahl öffnet. */
export function MediaPickerButton({
  onSelect, multiple, alreadyUsed, label = "Aus Mediathek", testId,
}: {
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
  alreadyUsed?: string[];
  label?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} data-testid={testId}>
        <Images className="mr-1.5 h-4 w-4" /> {label}
      </Button>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
        multiple={multiple}
        alreadyUsed={alreadyUsed}
      />
    </>
  );
}
