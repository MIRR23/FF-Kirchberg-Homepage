import { useState, useEffect } from "react";
import { ImagePlus, Loader2, X, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth, uploadFiles, withBase } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { MediaPickerButton } from "@/components/media-picker";

/**
 * Bildergalerien für Beiträge und Fahrzeuge.
 *
 * In der Datenbank steht die Galerie als JSON-Liste von Pfaden unterhalb von
 * /uploads/. `GalleryField` pflegt sie im internen Bereich, `ImageGallery`
 * zeigt sie Besuchern.
 */

/** Liest die gespeicherte JSON-Liste; bei fehlerhaftem Inhalt eine leere Galerie. */
export function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Interner Bereich
// ---------------------------------------------------------------------------

interface GalleryFieldProps {
  value: string[];
  onChange: (images: string[]) => void;
  label?: string;
  hint?: string;
  /** Kennung für die Testfälle, damit mehrere Galerien unterscheidbar bleiben. */
  testId?: string;
}

/** Pflege einer Bildergalerie: hochladen, aus der Mediathek wählen, sortieren. */
export function GalleryField({
  value, onChange, label = "Weitere Bilder", hint, testId = "gallery-editor",
}: GalleryFieldProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  /** Nimmt Bilder auf; bereits enthaltene werden übersprungen. */
  const add = (urls: string[]) => onChange([...value, ...urls.filter((u) => !value.includes(u))]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      add((await uploadFiles(token, files)).map((m) => m.url));
    } catch (err: any) {
      toast({ title: "Upload fehlgeschlagen", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  /** Verschiebt ein Bild um eine Position nach vorn oder hinten. */
  const move = (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= value.length) return;
    const images = [...value];
    [images[index], images[ziel]] = [images[ziel], images[index]];
    onChange(images);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">
        {hint ?? "Erscheinen als Bilderreihe unter dem Text. Reihenfolge mit den Pfeilen ändern."}
      </p>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2" data-testid={testId}>
          {value.map((url, i) => (
            <div key={url} className="relative overflow-hidden rounded-lg border border-border">
              <img src={withBase(url)} alt="" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                title="Bild entfernen"
                data-testid={`button-remove-${testId}-${i}`}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 px-1 py-0.5">
                <button
                  type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  title="Nach vorn" data-testid={`button-${testId}-up-${i}`}
                  className="p-0.5 text-white/80 hover:text-white disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1}
                  title="Nach hinten" data-testid={`button-${testId}-down-${i}`}
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
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Hochladen
          <input
            type="file" accept="image/*" multiple className="hidden"
            data-testid={`input-${testId}-upload`}
            onChange={(e) => { upload(e.target.files); e.target.value = ""; }}
          />
        </label>
        <MediaPickerButton
          multiple
          alreadyUsed={value}
          testId={`button-${testId}-from-library`}
          onSelect={add}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Öffentliche Anzeige
// ---------------------------------------------------------------------------

interface LightboxProps {
  images: string[];
  /** Index des angezeigten Bildes */
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  title: string;
  testId: string;
}

/**
 * Großansicht über der Seite. Geblättert wird mit den Pfeilen oder der
 * Tastatur, Escape schließt. Wird vom Hauptbild und von der Galerie benutzt.
 */
function Lightbox({ images, index, onIndex, onClose, title, testId }: LightboxProps) {
  const zeigen = (i: number) => onIndex(((i % images.length) + images.length) % images.length);

  // Bewusst ohne Abhängigkeitsliste: Der Handler muss den aktuellen Index
  // kennen, sonst blättert die Tastatur immer vom ersten Bild aus weiter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") zeigen(index + 1);
      if (e.key === "ArrowLeft") zeigen(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Bild ${index + 1} von ${images.length}`}
      data-testid={`${testId}-lightbox`}
    >
      <img
        src={withBase(images[index])}
        alt={`${title} – Bild ${index + 1} von ${images.length}`}
        className="max-h-full max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Schließen"
        data-testid={`button-${testId}-close`}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); zeigen(index - 1); }}
            aria-label="Vorheriges Bild"
            className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-6"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); zeigen(index + 1); }}
            aria-label="Nächstes Bild"
            data-testid={`button-${testId}-next`}
            className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-6"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <span className="absolute bottom-5 rounded-full bg-black/60 px-3 py-1 text-sm text-white/90">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}

interface LeadImageProps {
  /** Pfad unterhalb von /uploads/ */
  image: string | null | undefined;
  title: string;
  testId?: string;
}

/**
 * Das Hauptbild eines Beitrags, groß über dem Text. Ein Klick zeigt es
 * bildschirmfüllend – auf dem Handy ist das der einzige Weg, Details zu
 * erkennen.
 */
export function LeadImage({ image, title, testId = "post-lead-image" }: LeadImageProps) {
  const [offen, setOffen] = useState(false);
  if (!image) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Bild groß anzeigen"
        data-testid={`button-${testId}`}
        className="mt-6 block w-full overflow-hidden rounded-2xl border border-border transition-opacity hover:opacity-95"
      >
        <img
          src={withBase(image)}
          alt={title}
          data-testid={testId}
          className="max-h-[32rem] w-full bg-secondary object-cover"
        />
      </button>
      {offen && (
        <Lightbox
          images={[image]}
          index={0}
          onIndex={() => {}}
          onClose={() => setOffen(false)}
          title={title}
          testId={testId}
        />
      )}
    </>
  );
}

interface ImageGalleryProps {
  /** JSON-Liste aus der Datenbank */
  images: string;
  /** Für die Alternativtexte, z. B. der Beitrags- oder Fahrzeugname */
  title: string;
  heading?: string;
  testId?: string;
  /** Bild, das an anderer Stelle schon groß zu sehen ist (Hauptbild) */
  exclude?: string | null;
}

/**
 * Bilderreihe mit Großansicht. Ein Klick öffnet das Bild groß; geblättert
 * wird mit den Pfeilen oder der Tastatur, Escape schließt.
 */
export function ImageGallery({
  images, title, heading = "Bilder", testId = "post-gallery", exclude,
}: ImageGalleryProps) {
  const [offen, setOffen] = useState<number | null>(null);
  const liste = parseImages(images).filter((url) => url !== exclude);

  if (!liste.length) return null;

  return (
    <section className="mt-6" data-testid={testId}>
      {heading && <h2 className="mb-3 font-display text-xl font-semibold">{heading}</h2>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {liste.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setOffen(i)}
            data-testid={`button-${testId}-image-${i}`}
            className="overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90"
          >
            <img
              src={withBase(url)}
              alt={`${title} – Bild ${i + 1} von ${liste.length}`}
              loading="lazy"
              className="aspect-[4/3] w-full bg-secondary object-cover"
            />
          </button>
        ))}
      </div>

      {offen !== null && (
        <Lightbox
          images={liste}
          index={offen}
          onIndex={setOffen}
          onClose={() => setOffen(null)}
          title={title}
          testId={testId}
        />
      )}
    </section>
  );
}
