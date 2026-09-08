import { lazy, Suspense, useEffect, useState } from "react";
import { MapPin, ExternalLink, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet erst laden, wenn wirklich eine Karte angezeigt wird (eigener Chunk)
const LeafletMap = lazy(() => import("./leaflet-map"));

/** Link zur Navigation – öffnet den Standort in Google Maps. */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}

// ---------- Öffentliche Anzeige (2-Klick-Lösung) ----------

interface LocationViewProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Ortsbezeichnung (z. B. Einsatzort oder Veranstaltungsort) */
  label?: string | null;
  /** Überschrift über der Karte; ohne Angabe wird keine Überschrift gezeigt */
  heading?: string;
  compact?: boolean;
}

/**
 * Zeigt den Standort eines Eintrags: aus Datenschutzgründen zunächst nur eine
 * Platzhalter-Fläche – die OpenStreetMap-Karte wird erst nach Klick geladen
 * (2-Klick-Lösung). Der Google-Maps-Link überträgt erst beim Anklicken Daten.
 */
export function LocationView({ lat, lng, label, heading, compact }: LocationViewProps) {
  const [show, setShow] = useState(false);
  if (lat == null || lng == null) return null;

  const mapHeight = compact ? "h-52" : "h-72";
  return (
    <div className={compact ? "mt-3" : "mt-10"} data-testid="location-view">
      {heading && <h2 className="mb-3 font-display text-xl font-semibold">{heading}</h2>}
      {show ? (
        <Suspense fallback={<Skeleton className={`${mapHeight} w-full rounded-2xl`} />}>
          <LeafletMap lat={lat} lng={lng} className={`${mapHeight} w-full rounded-2xl border border-border`} />
        </Suspense>
      ) : (
        <button
          type="button"
          onClick={() => setShow(true)}
          data-testid="button-show-map"
          className={`flex ${compact ? "min-h-[7rem]" : "min-h-[10rem]"} w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-sm text-muted-foreground hover:border-input hover:text-foreground`}
        >
          <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-semibold text-foreground">Karte anzeigen{label ? ` – ${label}` : ""}</span>
          <span className="max-w-md text-center text-xs">
            Beim Anzeigen wird die Karte von OpenStreetMap geladen und dabei Ihre IP-Adresse an openstreetmap.org übertragen.
          </span>
        </button>
      )}
      <p className="mt-2 text-sm">
        <a
          href={googleMapsUrl(lat, lng)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-google-maps"
          className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          In Google Maps öffnen <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}

// ---------- Standort-Auswahl im Redaktionsbereich ----------

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationFieldProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  onChange: (lat: number | null, lng: number | null) => void;
}

/**
 * Optionales Standortfeld für Redakteure: Adresse suchen (OpenStreetMap/Nominatim)
 * oder direkt auf die Karte klicken – so lassen sich auch Wegkreuzungen oder
 * Flurstücke ohne Adresse markieren.
 */
export function LocationField({ lat, lng, onChange }: LocationFieldProps) {
  const hasPos = lat != null && lng != null;
  const [open, setOpen] = useState(hasPos);
  // Beim Bearbeiten wird das Formular erst nach dem Laden befüllt; der
  // gespeicherte Standort trifft also nach dem ersten Rendern ein. Dann das
  // Kartenfeld aufklappen, damit der Redakteur nicht denkt, es sei keiner gesetzt.
  useEffect(() => {
    if (hasPos) setOpen(true);
  }, [hasPos]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=de&q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) throw new Error();
      const list: NominatimResult[] = await res.json();
      setResults(list);
      if (!list.length) setError("Keine Treffer – ggf. Ortsnamen ergänzen (z. B. „…, Kirchberg“).");
    } catch {
      setError("Die Adresssuche ist gerade nicht erreichbar. Der Standort kann trotzdem per Klick auf die Karte gesetzt werden.");
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: NominatimResult) => {
    onChange(parseFloat(r.lat), parseFloat(r.lon));
    setResults(null);
    setQuery("");
  };

  return (
    <div className="space-y-1.5">
      <Label>Standort auf der Karte (optional)</Label>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="button-open-location"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground hover:border-input hover:text-foreground"
        >
          <MapPin className="h-4 w-4" /> Standort festlegen (Adresse oder Klick auf die Karte)
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="Adresse oder Ort suchen …"
              data-testid="input-location-search"
            />
            <Button type="button" variant="secondary" onClick={search} disabled={searching} data-testid="button-location-search">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {error && <p className="text-xs text-muted-foreground">{error}</p>}
          {results && results.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickResult(r)}
                  data-testid={`button-location-result-${i}`}
                  className="block w-full border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-secondary/60"
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
            <LeafletMap lat={lat} lng={lng} onPick={(la, ln) => onChange(la, ln)} className="h-64 w-full rounded-lg" />
          </Suspense>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {hasPos
                ? `Markierung gesetzt (${lat!.toFixed(5)}, ${lng!.toFixed(5)})`
                : "Auf die Karte klicken/tippen, um die Markierung zu setzen – auch abseits von Adressen."}
            </span>
            {hasPos && (
              <button
                type="button"
                onClick={() => onChange(null, null)}
                data-testid="button-remove-location"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" /> Standort entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
