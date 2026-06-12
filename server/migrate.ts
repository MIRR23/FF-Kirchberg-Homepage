/**
 * Migration: Übernimmt alle Inhalte der alten WordPress-Website (ff-kirchberg.de)
 * in die neue Datenbank. Aufruf: npx tsx server/migrate.ts
 *
 * Erwartet:
 *   ../ffk_site/json/{posts,pages,media,categories,users}.json
 *   ../ffk_site/media/<id>_<dateiname>  (heruntergeladene Originalbilder)
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { storage, db } from "./storage";
import { users, categories, posts, events, vehicles, members, pages, media } from "@shared/schema";
import { hashPassword } from "./auth";

const SRC = path.resolve(process.cwd(), "../ffk_site");
const UPLOADS = path.resolve(process.cwd(), "uploads/wp");

function readJson(name: string): any[] {
  return JSON.parse(fs.readFileSync(path.join(SRC, "json", `${name}.json`), "utf8"));
}

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—")
    .replace(/&[lr]squo;/g, "'").replace(/&[lr]dquo;/g, '"')
    .replace(/&#8211;/g, "–").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"');
}

function stripTags(html: string): string {
  return decodeEntities((html || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

// ---------- Medien vorbereiten ----------
const wpMedia = readJson("media");

// Map: WP-Media-ID -> lokale URL, und Datei-Basisname -> lokale URL
const mediaById = new Map<number, string>();
const mediaByKey = new Map<string, string>();

fs.mkdirSync(UPLOADS, { recursive: true });

let copied = 0, missing = 0;
for (const m of wpMedia) {
  const src = m.source_url as string;
  if (!src) continue;
  const basename = path.basename(src.split("?")[0]);
  const localFile = path.join(SRC, "media", `${m.id}_${basename}`);
  if (!fs.existsSync(localFile) || fs.statSync(localFile).size === 0) {
    missing++;
    continue;
  }
  const destName = `${m.id}_${basename}`;
  const dest = path.join(UPLOADS, destName);
  if (!fs.existsSync(dest)) fs.copyFileSync(localFile, dest);
  const url = `/uploads/wp/${destName}`;
  mediaById.set(m.id, url);

  // Schlüssel: "2024/05/foo.jpg" (Pfad relativ zu uploads, ohne Größensuffix)
  let relSrc = src;
  try { relSrc = decodeURIComponent(src); } catch { /* ignore */ }
  const rel = relSrc.replace(/^.*\/wp-content\/uploads\//, "").split("?")[0];
  const dir = path.dirname(rel);
  const ext = path.extname(basename);
  const stem = basename.slice(0, -ext.length);
  mediaByKey.set(`${dir}/${stem}${ext}`.toLowerCase(), url);
  copied++;
}
console.log(`Medien: ${copied} kopiert, ${missing} fehlen`);

/** Findet die lokale URL für eine alte WP-Upload-URL (auch mit Größensuffix -300x225). */
function resolveUploadUrl(oldUrl: string): string | null {
  let decoded = oldUrl;
  try { decoded = decodeURIComponent(oldUrl); } catch { /* ignore */ }
  const rel = decoded.replace(/^.*\/wp-content\/uploads\//, "").split("?")[0];
  const dir = path.dirname(rel);
  const base = path.basename(rel);
  const ext = path.extname(base);
  let stem = base.slice(0, -ext.length);
  const direct = mediaByKey.get(`${dir}/${stem}${ext}`.toLowerCase());
  if (direct) return direct;
  // Größensuffix entfernen: foo-300x225 -> foo
  const noSize = stem.replace(/-\d+x\d+$/, "");
  const bySize = mediaByKey.get(`${dir}/${noSize}${ext}`.toLowerCase());
  if (bySize) return bySize;
  // "-scaled" Variante probieren
  const scaled = mediaByKey.get(`${dir}/${noSize}-scaled${ext}`.toLowerCase());
  if (scaled) return scaled;
  return null;
}

/** Bereinigt WordPress-HTML: Bild-URLs lokal, srcset/sizes entfernen, alte Links anpassen. */
function processContent(html: string): string {
  let out = html || "";
  // srcset / sizes / loading / decoding Attribute entfernen
  out = out.replace(/\s(srcset|sizes|decoding|fetchpriority)="[^"]*"/g, "");
  // Bild- und Link-URLs auf lokale Kopien umschreiben (absolute URLs)
  out = out.replace(/(https?:)?\/\/(www\.)?ff-kirchberg\.de\/wp-content\/uploads\/[^"'\s\\)]+/g, (m0) => {
    const local = resolveUploadUrl(m0);
    return local ?? m0;
  });
  // Relative Upload-URLs umschreiben
  out = out.replace(/(src|href)="\/wp-content\/uploads\/([^"]+)"/g, (m0, attr, rel) => {
    const local = resolveUploadUrl(`/wp-content/uploads/${rel}`);
    return local ? `${attr}="${local}"` : m0;
  });
  // Verbliebene kaputte Bilder (externe Hosts, wp-includes-Icons) entfernen
  out = out.replace(/<img[^>]+src="(?:https?:)?\/\/(?!localhost)[^"]*"[^>]*\/?>/g, "");
  out = out.replace(/<img[^>]+src="\/wp-[^"]*"[^>]*\/?>/g, "");
  // Links auf alte Seiten -> Hash-Routen (best effort)
  out = out.replace(/href="https?:\/\/(www\.)?ff-kirchberg\.de\/?([^"]*)"/g, (m0, _w, p) => {
    if (String(p).startsWith("wp-content")) return m0;
    const clean = String(p).replace(/\/$/, "");
    if (!clean) return 'href="#/"';
    return `href="#/beitrag/${clean.split("/").pop()}"`;
  });
  return out;
}

/** Erzeugt ein performantes Vorschaubild (max. 1280px, JPEG) für Titelbilder. */
const THUMBS = path.join(UPLOADS, "thumbs");
fs.mkdirSync(THUMBS, { recursive: true });
const thumbCache = new Map<string, string>();
async function makeThumb(localUrl: string | null): Promise<string | null> {
  if (!localUrl || !localUrl.startsWith("/uploads/wp/")) return localUrl;
  if (!/\.(jpe?g|png|webp)$/i.test(localUrl)) return localUrl;
  if (thumbCache.has(localUrl)) return thumbCache.get(localUrl)!;
  const srcFile = path.join(UPLOADS, path.basename(localUrl));
  if (!fs.existsSync(srcFile)) return localUrl;
  const name = path.basename(localUrl).replace(/\.(jpe?g|png|webp)$/i, ".jpg");
  const dest = path.join(THUMBS, name);
  const url = `/uploads/wp/thumbs/${name}`;
  try {
    if (!fs.existsSync(dest)) {
      await sharp(srcFile).rotate().resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(dest);
    }
    thumbCache.set(localUrl, url);
    return url;
  } catch {
    thumbCache.set(localUrl, localUrl);
    return localUrl;
  }
}

async function main() {
  // ---------- Tabellen leeren ----------
  db.delete(posts).run();
  db.delete(categories).run();
  db.delete(events).run();
  db.delete(vehicles).run();
  db.delete(members).run();
  db.delete(pages).run();
  db.delete(media).run();
  db.delete(users).run();

  // ---------- Benutzer ----------
  storage.createUser({
    username: "admin",
    password: hashPassword("FFK-Admin-2026!"),
    displayName: "Administrator",
    role: "admin",
    permissions: "[]",
    active: 1,
  });
  storage.createUser({
    username: "redakteur",
    password: hashPassword("FFK-Redakteur-2026!"),
    displayName: "Max Beispiel-Redakteur",
    role: "editor",
    permissions: JSON.stringify(["einsaetze", "neuigkeiten", "termine"]),
    active: 1,
  });
  console.log("Benutzer angelegt: admin, redakteur");

  // ---------- Kategorien ----------
  const wpCats = readJson("categories");
  const catConfig: Record<string, { color: string; isEinsatz: number }> = {
    "einsaetze": { color: "red", isEinsatz: 1 },
    "first-responder": { color: "blue", isEinsatz: 1 },
    "veranstaltungen": { color: "amber", isEinsatz: 0 },
    "pressemeldungen": { color: "green", isEinsatz: 0 },
    "allgemein": { color: "gray", isEinsatz: 0 },
  };
  const catMap = new Map<number, number>(); // WP-ID -> neue ID
  for (const c of wpCats) {
    const cfg = catConfig[c.slug] ?? { color: "gray", isEinsatz: 0 };
    const created = storage.createCategory({
      name: decodeEntities(c.name),
      slug: c.slug,
      color: cfg.color,
      isEinsatz: cfg.isEinsatz,
    });
    catMap.set(c.id, created.id);
  }
  console.log(`Kategorien: ${wpCats.length}`);

  // ---------- Autoren ----------
  const wpUsers = readJson("users");
  const authorMap = new Map<number, string>();
  for (const u of wpUsers) authorMap.set(u.id, u.name);

  // ---------- Beiträge ----------
  const wpPosts = readJson("posts");
  const fallbackCat = storage.getCategoryBySlug("allgemein")!.id;
  let postCount = 0;
  for (const p of wpPosts) {
    const content = processContent(p.content?.rendered ?? "");
    // Nur lokale (erfolgreich migrierte) Bilder als Titelbild verwenden
    const imgMatches = [...content.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    const firstLocalImg = imgMatches.find((src) => src.startsWith("/uploads")) ?? null;
    const featured = await makeThumb((p.featured_media && mediaById.get(p.featured_media)) || firstLocalImg);
    const excerpt = stripTags(p.excerpt?.rendered ?? "").replace(/\s*(Weiterlesen|→).*$/, "").slice(0, 300);
    // Spezifischere Kategorie bevorzugen (viele Beiträge sind zusätzlich in "Allgemein")
    const wpCatIds: number[] = p.categories ?? [];
    const allgemeinWpId = wpCats.find((c: any) => c.slug === "allgemein")?.id;
    const wpCatId = wpCatIds.find((cid) => cid !== allgemeinWpId) ?? wpCatIds[0];
    storage.createPost({
      title: decodeEntities(stripTags(p.title?.rendered ?? "")) || "(ohne Titel)",
      slug: p.slug,
      content,
      excerpt,
      categoryId: catMap.get(wpCatId) ?? fallbackCat,
      publishedAt: p.date ?? new Date().toISOString(),
      featuredImage: featured && featured.startsWith("/uploads") ? featured : featured ?? null,
      images: "[]",
      authorName: authorMap.get(p.author) ?? "",
      status: "published",
      stichwort: null,
      ort: null,
    });
    postCount++;
  }
  console.log(`Beiträge: ${postCount}`);

  // ---------- Seiten ----------
  const wpPages = readJson("pages");
  const bySlug = new Map<string, any>(wpPages.map((p: any) => [p.slug, p]));

  const pageDefs: { slug: string; title: string; wpSlug?: string; fallback?: string }[] = [
    { slug: "ueber-uns", title: "Über uns", wpSlug: "ueber-uns" },
    { slug: "chronik", title: "Chronik", wpSlug: "geschichte" },
    { slug: "historische-braende", title: "Historische Brände", wpSlug: "historische-braende" },
    { slug: "impressum", title: "Impressum", wpSlug: "impressum" },
    { slug: "datenschutz", title: "Datenschutzerklärung", wpSlug: "datenschutzerklaerung" },
    { slug: "links", title: "Links", wpSlug: "links" },
  ];
  for (const def of pageDefs) {
    const wp = def.wpSlug ? bySlug.get(def.wpSlug) : null;
    storage.createPage({
      slug: def.slug,
      title: wp ? decodeEntities(stripTags(wp.title?.rendered ?? "")) || def.title : def.title,
      content: wp ? processContent(wp.content?.rendered ?? "") : (def.fallback ?? "<p>Inhalt folgt.</p>"),
      updatedAt: new Date().toISOString(),
    });
  }
  console.log(`Seiten: ${pageDefs.length}`);

  // ---------- Fahrzeuge (aus Gerätehaus-Unterseiten) ----------
  const vehicleDefs = [
    { wpSlug: "lf106", name: "LF 10/6", type: "Löschgruppenfahrzeug", sort: 1 },
    { wpSlug: "tsf-8", name: "TSF 8", type: "Tragkraftspritzenfahrzeug", sort: 2 },
    { wpSlug: "mzf", name: "MZF", type: "Mehrzweckfahrzeug", sort: 3 },
  ];
  for (const v of vehicleDefs) {
    const wp = bySlug.get(v.wpSlug);
    const content = wp ? processContent(wp.content?.rendered ?? "") : "";
    const firstImg = await makeThumb(content.match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null);
    storage.createVehicle({
      name: v.name,
      type: v.type,
      description: content || "<p>Beschreibung folgt.</p>",
      image: firstImg,
      images: "[]",
      sortOrder: v.sort,
    });
  }
  console.log(`Fahrzeuge: ${vehicleDefs.length}`);

  // ---------- Mitglieder (Beispieldaten — echte Daten bitte im Backend pflegen) ----------
  const sampleMembers = [
    { name: "Max Mustermann", funktion: "1. Kommandant", gruppe: "vorstandschaft", sortOrder: 1 },
    { name: "Martin Beispiel", funktion: "2. Kommandant", gruppe: "vorstandschaft", sortOrder: 2 },
    { name: "Josef Beispiel", funktion: "1. Vorstand", gruppe: "vorstandschaft", sortOrder: 3 },
    { name: "Andreas Beispiel", funktion: "Kassier", gruppe: "vorstandschaft", sortOrder: 4 },
    { name: "Stefan Beispiel", funktion: "Atemschutzträger", gruppe: "aktive", sortOrder: 1 },
    { name: "Thomas Beispiel", funktion: "Maschinist", gruppe: "aktive", sortOrder: 2 },
    { name: "Lisa Beispiel", funktion: "Gruppenführerin", gruppe: "aktive", sortOrder: 3 },
  ];
  for (const m of sampleMembers) storage.createMember({ ...m, image: null });
  console.log(`Mitglieder (Beispiele): ${sampleMembers.length}`);

  // ---------- Termine (Beispieldaten) ----------
  const sampleEvents = [
    { title: "Monatsübung", date: "2026-07-03", time: "19:00", location: "Gerätehaus Kirchberg", description: "Beispieltermin – bitte im internen Bereich anpassen.", kind: "uebung" },
    { title: "Monatsübung", date: "2026-08-07", time: "19:00", location: "Gerätehaus Kirchberg", description: "Beispieltermin – bitte im internen Bereich anpassen.", kind: "uebung" },
    { title: "Christbaumversteigerung 2027", date: "2027-01-09", time: "19:30", location: "Gasthaus Müller, Schröding", description: "Beispieltermin – bitte im internen Bereich anpassen.", kind: "veranstaltung" },
  ];
  for (const e of sampleEvents) storage.createEvent(e);
  console.log(`Termine (Beispiele): ${sampleEvents.length}`);

  // ---------- Mediathek ----------
  let mediaCount = 0;
  for (const m of wpMedia) {
    const url = mediaById.get(m.id);
    if (!url) continue;
    storage.createMedia({
      filename: path.basename(url),
      url,
      title: decodeEntities(stripTags(m.title?.rendered ?? "")),
      uploadedAt: m.date ?? "",
      uploadedBy: "Migration",
    });
    mediaCount++;
  }
  console.log(`Mediathek: ${mediaCount}`);

  console.log("\nMigration abgeschlossen.");
}

main();
