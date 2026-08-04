import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Marker-Grafiken über den Bundler auflösen (Standard-Pfade von Leaflet
// funktionieren mit Vite nicht)
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/** Ungefähre Mitte der Gemeinde Kirchberg – Startansicht, solange kein Standort gesetzt ist. */
const KIRCHBERG_CENTER: [number, number] = [48.272, 12.083];

interface LeafletMapProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** Wird bei Klick auf die Karte aufgerufen (Standort-Auswahl im Redaktionsbereich). */
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}

/**
 * OpenStreetMap-Karte (Leaflet). Wird per lazy() geladen, damit die
 * Leaflet-Bibliothek erst beim tatsächlichen Anzeigen einer Karte
 * heruntergeladen wird (2-Klick-Lösung auf der öffentlichen Seite).
 */
export default function LeafletMap({ lat, lng, onPick, className }: LeafletMapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const hasPos = lat != null && lng != null;
    const map = L.map(divRef.current, { scrollWheelZoom: !onPickRef.current ? false : true }).setView(
      hasPos ? [lat!, lng!] : KIRCHBERG_CENTER,
      hasPos ? 15 : 12
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map);
    if (hasPos) markerRef.current = L.marker([lat!, lng!]).addTo(map);
    if (onPickRef.current) {
      map.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marker nachführen, wenn sich der Standort von außen ändert (Adresssuche, Klick)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = L.marker([lat, lng]).addTo(map);
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, [lat, lng]);

  return <div ref={divRef} className={className ?? "h-64 w-full"} data-testid="leaflet-map" />;
}
