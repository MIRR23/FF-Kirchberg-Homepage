/**
 * Datenmodell der Website – gemeinsame Typen für das Frontend.
 *
 * Die Tabellen selbst legt das PHP-Backend an (siehe php/db.php); diese Datei
 * beschreibt nur, wie die API die Daten ausliefert. Die Feldnamen sind
 * camelCase, die Spalten in der Datenbank snake_case – php/storage.php bildet
 * beides aufeinander ab.
 */

// ----- Benutzer -----
export const PERMISSION_AREAS = [
  "einsaetze",
  "neuigkeiten",
  "termine",
  "fahrzeuge",
  "mitglieder",
  "seiten",
  "medien",
  "dateien",
] as const;
export type PermissionArea = (typeof PERMISSION_AREAS)[number];

export interface User {
  id: number;
  username: string;
  password: string; // Hash (password_hash), verlässt den Server nie
  displayName: string;
  role: string; // 'admin' | 'editor'
  permissions: string; // JSON-Array aus PermissionArea
  active: number; // 0 | 1
}

// ----- Kategorien -----
export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string; // red | amber | blue | green | gray
  isEinsatz: number; // 0 | 1
}

// ----- Beiträge (Neuigkeiten + Einsätze) -----
export interface Post {
  id: number;
  title: string;
  slug: string;
  content: string; // HTML
  excerpt: string;
  categoryId: number;
  publishedAt: string; // ISO-Zeitstempel
  featuredImage: string | null; // Pfad unter /uploads/
  images: string; // JSON-Array von Pfaden
  authorName: string;
  status: string; // 'published' | 'draft'
  stichwort: string | null; // z. B. "Brand B1", "THL 2" (nur Einsätze)
  ort: string | null; // Einsatzort
  /** Optionaler Kartenstandort (per Adresssuche oder Klick auf die Karte gesetzt) */
  lat: number | null;
  lng: number | null;
}

// ----- Termine / Veranstaltungen -----
export interface Event {
  id: number;
  title: string;
  date: string; // ISO-Datum
  time: string; // z. B. "19:30"
  location: string;
  description: string;
  kind: string; // 'veranstaltung' | 'uebung'
  lat: number | null;
  lng: number | null;
}

// ----- Fahrzeuge -----
export interface Vehicle {
  id: number;
  name: string; // "LF 10/6"
  type: string; // "Löschgruppenfahrzeug"
  description: string; // HTML
  image: string | null;
  images: string;
  sortOrder: number;
}

// ----- Mitglieder (Vorstandschaft / Aktive) -----
export interface Member {
  id: number;
  name: string;
  funktion: string; // z. B. "1. Kommandant"
  gruppe: string; // 'vorstandschaft' | 'aktive'
  image: string | null;
  sortOrder: number;
}

// ----- Statische Seiten (Texte) -----
export interface Page {
  id: number;
  slug: string; // 'ueber-uns', 'chronik', 'impressum', ...
  title: string;
  content: string; // HTML
  updatedAt: string;
}

// ----- Medien -----
export interface MediaItem {
  id: number;
  filename: string;
  url: string; // /uploads/...
  title: string;
  uploadedAt: string;
  uploadedBy: string;
}

// ----- Dateien / Downloads (PDF, Office, …) mit stabilem Link -----
// Der Link auf ein Dokument bleibt beim Austauschen der Datei unverändert,
// sodass Verlinkungen (z. B. Organigramm, Übungsplan) nie angepasst werden müssen.
export interface DocumentItem {
  id: number;
  slug: string; // stabiler Link-Bestandteil, wird nie geändert
  title: string;
  filename: string; // aktuelle Datei unter uploads/dokumente/
  originalName: string; // Dateiname beim Download
  mimeType: string;
  size: number; // Bytes
  updatedAt: string;
  updatedBy: string;
}

// ----- Einstellungen (Hero-Bereich der Startseite) -----
export interface HeroSettings {
  /** auto = Bild des neuesten Beitrags, custom = eigenes Bild */
  mode: "auto" | "custom";
  /** eigenes Bild (bei auto: Ersatzbild) */
  image: string | null;
  /** füllend (Foto) | eingepasst (Logo/Grafik) */
  fit: "cover" | "contain";
  /** Stärke der Abdunkelung (0–100) */
  overlay: number;
  /** *Wort* wird farblich hervorgehoben (max. 200 Zeichen) */
  title: string;
  intro: string;
  /** Alternativtext (Barrierefreiheit) */
  alt: string;
}

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  mode: "auto",
  image: "/uploads/hero-standard.png",
  fit: "cover",
  overlay: 65,
  title: "Wenn jede *Minute* zählt.",
  intro:
    "Aktive Einsatzkräfte, moderne Fahrzeuge und eine eigene First-Responder-Einheit – rund um die Uhr einsatzbereit für Kirchberg und das Erdinger Holzland.",
  alt: "Wappen der Freiwilligen Feuerwehr Kirchberg und Logo der First Responder Kirchberg",
};

// ----- Allgemeine Website-Einstellungen -----
export interface SiteSettings {
  /** Links in Beitrags-/Seitentexten in neuem Tab öffnen */
  linksNewTab: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  linksNewTab: true,
};

// ----- API-Hilfstypen -----
export type SafeUser = Omit<User, "password">;
export type PostWithCategory = Post & { category: Category | null };
