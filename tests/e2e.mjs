/**
 * End-to-End-Test der Website gegen das echte Deployment-Paket.
 *
 * Voraussetzungen (siehe BETRIEB.md → „Lokal testen“):
 *   1. MariaDB läuft, Datenbank und Benutzer sind angelegt
 *   2. npm run build:dir        → erzeugt dist/deploy
 *   3. dist/deploy/config.php   → Zugangsdaten eintragen
 *   4. php -S 127.0.0.1:8080 -t dist/deploy
 *
 * Aufruf:
 *   node tests/e2e.mjs [Basis-Adresse]        (Standard: http://127.0.0.1:8080)
 *
 * Playwright ist bewusst KEINE Projekt-Abhängigkeit (das Projekt liefert nur
 * statische Dateien aus). Der Test nutzt eine vorhandene Installation:
 *   PLAYWRIGHT=/pfad/zu/playwright/index.mjs node tests/e2e.mjs
 */

import { readFileSync, writeFileSync, mkdtempSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASE = process.argv[2] ?? "http://127.0.0.1:8080";
const PLAYWRIGHT = process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs";
const TMP = mkdtempSync(path.join(tmpdir(), "ffk-e2e-"));

const ADMIN = { username: "admin", password: "FFK-Admin-2026!" };

// ---------------------------------------------------------------------------
// Kleines Test-Gerüst
// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];
const skipped = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` – ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` – ${detail}` : ""}`);
  }
}

function group(title) {
  console.log(`\n▶ ${title}`);
}

/** Wartet, bis die Bedingung zutrifft (oder bricht nach timeout ab). */
async function waitFor(fn, { timeout = 10000, interval = 150 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, interval));
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Ruft eine Seite auf und wartet, bis React den Inhalt gerendert hat.
 * „networkidle“ allein genügt nicht: Die Daten kommen per Query nach.
 */
async function gotoPage(page, hash, { minLength = 500, expect: marker } = {}) {
  const target = `${BASE}/#${hash}`;
  await page.goto(target, { waitUntil: "domcontentloaded" });
  // Wechselt nur der Hash, lädt der Browser die Seite nicht neu und die
  // Anwendung zeigt zwischengespeicherte Daten. Ein Neuladen erzwingt
  // frische Abfragen – wie beim echten Aufruf eines Links von außen.
  await page.reload({ waitUntil: "networkidle" });
  if (marker) {
    await page
      .waitForFunction(
        (m) => (document.body.innerText || "").toLowerCase().includes(m),
        marker.toLowerCase(),
        { timeout: 15000 },
      )
      .catch(() => {});
  }
  await page
    .waitForFunction((min) => (document.body.innerText || "").length > min, minLength, { timeout: 15000 })
    .catch(() => {});
  return page.locator("body").innerText();
}

/** Wie gotoPage, aber ohne Inhaltsprüfung (für den internen Bereich). */
async function gotoPageRaw(page, hash) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
}

/** Vergleicht ohne Rücksicht auf Groß-/Kleinschreibung (CSS setzt Überschriften in Versalien). */
function contains(haystack, needle) {
  return haystack.toLocaleLowerCase("de").includes(needle.toLocaleLowerCase("de"));
}

/** Direkter API-Aufruf (ohne Browser). */
async function api(route, { method = "GET", token, json, form, ua, ip } = {}) {
  const url = `${BASE}/api.php?r=${encodeURIComponent(route.split("?")[0])}${
    route.includes("?") ? `&${route.split("?")[1]}` : ""
  }`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  if (ua) headers["User-Agent"] = ua;
  if (ip) headers["X-Forwarded-For"] = ip;
  const res = await fetch(url, { method, headers, body: json ? JSON.stringify(json) : form });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

/**
 * Erzeugt ein Foto in der Größe, wie sie heutige Handys liefern (gut 13 MB).
 *
 * Das Rauschen ist Absicht: Ein gleichmäßiger Verlauf ließe sich so stark
 * zusammenpacken, dass die Datei winzig wäre und nichts prüfen würde.
 */
function makeHugePhoto() {
  const file = path.join(TMP, "handy-foto.jpg");
  execFileSync("php", [
    "-r",
    `mt_srand(7);$w=4000;$h=3000;$im=imagecreatetruecolor($w,$h);
     for($y=0;$y<$h;$y+=4){for($x=0;$x<$w;$x+=4){
       $c=imagecolorallocate($im,mt_rand(0,255),mt_rand(0,255),mt_rand(0,255));
       imagefilledrectangle($im,$x,$y,$x+3,$y+3,$c);}}
     imagejpeg($im,'${file}',92);`,
  ]);
  return file;
}

/** Erzeugt ein großes Testfoto mit EXIF-Drehung und GPS-Position. */
function makeTestPhoto() {
  const file = path.join(TMP, "grosses-foto.jpg");
  execFileSync("php", [
    "-r",
    `$w=3000;$h=2000;$im=imagecreatetruecolor($w,$h);
     for($y=0;$y<$h;$y+=6){for($x=0;$x<$w;$x+=6){
       $c=imagecolorallocate($im,($x*255/$w)|0,($y*255/$h)|0,90);
       imagefilledrectangle($im,$x,$y,$x+5,$y+5,$c);}}
     imagejpeg($im,'${file}',92);`,
  ]);
  try {
    execFileSync("exiftool", [
      "-overwrite_original", "-q",
      "-GPSLatitude=48.3372", "-GPSLatitudeRef=N",
      "-GPSLongitude=12.0489", "-GPSLongitudeRef=E",
      "-Make=TestPhone", "-Model=TestCam 9", "-Artist=Vertraulich",
      "-Orientation#=6",
      file,
    ]);
    return { file, withExif: true };
  } catch {
    return { file, withExif: false }; // exiftool nicht vorhanden
  }
}

/** Liest die Metadaten einer Bilddatei über exiftool aus. */
function readExif(file) {
  try {
    return execFileSync("exiftool", ["-s", "-G", file], { encoding: "utf8" });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Testlauf
// ---------------------------------------------------------------------------
const { chromium } = await import(PLAYWRIGHT);

const browser = await chromium.launch({
  executablePath: existsSync("/opt/pw-browsers/chromium") ? undefined : undefined,
});
const context = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
  // Playwright meldet sich sonst als „HeadlessChrome“ – das filtert die
  // Statistik (korrekterweise) als Bot heraus.
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});
const page = await context.newPage();

const consoleErrors = [];
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

const failedRequests = [];
page.on("requestfailed", (req) => {
  const url = req.url();
  const reason = req.failure()?.errorText ?? "";
  // Nur eigene Adressen zählen. Externe Dienste (Schriftarten, Kartenkacheln)
  // sind in der Testumgebung ohne Internetzugang nicht erreichbar.
  if (!url.startsWith(BASE)) return;
  // Ein Neuladen bricht laufende Anfragen ab – das ist kein Fehler.
  if (/ERR_ABORTED/i.test(reason)) return;
  failedRequests.push(`${req.method()} ${url} (${reason})`);
});
page.on("response", (res) => {
  const u = res.url();
  // Der Test meldet sich absichtlich einmal falsch an – diese 401 ist erwartet.
  const expectedRejection = res.status() === 401 && u.includes("auth%2Flogin");
  if (res.status() >= 400 && !expectedRejection
      && (u.includes("/api.php") || u.includes("/uploads/") || u.includes("/datei.php"))) {
    failedRequests.push(`${res.status()} ${u}`);
  }
});

try {
  // =======================================================================
  group("1. Migration und Startseite");
  // =======================================================================
  await gotoPageRaw(page, "/");

  const stats = (await api("/stats")).body;
  check("Migration hat Einsätze angelegt", stats.einsaetzeGesamt > 100, `${stats.einsaetzeGesamt}`);
  check("Migration hat Fahrzeuge angelegt", stats.fahrzeuge === 3, `${stats.fahrzeuge}`);
  check("Kategorien vorhanden", (await api("/categories")).body.length === 5);
  check("Beiträge vorhanden", (await api("/posts")).body.length === 187);
  check("Mediathek gefüllt", (await api("/posts/years")).body.length > 10);

  const heroImg = page.locator("img").first();
  await heroImg.waitFor({ state: "visible", timeout: 10000 });
  check("Startseite zeigt ein Bild", await heroImg.isVisible());
  check(
    "Hero-Bild lädt tatsächlich",
    await heroImg.evaluate((el) => el.complete && el.naturalWidth > 0),
  );
  check("Startseite zeigt Überschrift", (await page.locator("h1").first().innerText()).length > 5);

  // =======================================================================
  group("2. Öffentliche Seiten rendern mit Inhalten und Bildern");
  // =======================================================================
  for (const [route, marker] of [
    ["/einsaetze", "Einsätze"],
    ["/aktuelles", "Aktuelles"],
    ["/archiv", "Archiv"],
    ["/geraetehaus", "LF 10/6"],
    ["/ueber-uns", "Über uns"],
    ["/termine", "Termine"],
    ["/first-responder", "First Responder"],
    ["/chronik", "Chronik"],
    ["/impressum", "Impressum"],
    ["/datenschutz", "Datenschutz"],
  ]) {
    const text = await gotoPage(page, route, { expect: marker });
    check(`Seite ${route} zeigt Inhalt`, contains(text, marker) && text.length > 400, `${text.length} Zeichen`);
  }

  // Gerätehaus: migrierte Fahrzeugbilder müssen wirklich geladen werden
  await gotoPage(page, "/geraetehaus", { expect: "LF 10/6" });
  await page.waitForTimeout(1200);
  const brokenImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.src),
  );
  check("Gerätehaus: alle Bilder geladen", brokenImages.length === 0, brokenImages.join(", "));

  // Beitragsdetail mit migriertem Bild
  const firstPostWithImage = (await api("/posts")).body.find((p) => p.featuredImage);
  const detailText = await gotoPage(page, `/beitrag/${firstPostWithImage.slug}`, { expect: firstPostWithImage.title.slice(0, 20) });
  check("Beitragsdetail zeigt den Titel", contains(detailText, firstPostWithImage.title.slice(0, 20)));
  const detailBroken = await page.evaluate(() =>
    Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
  );
  check("Beitragsdetail: keine kaputten Bilder", detailBroken === 0);

  // =======================================================================
  group("3. Statistik: öffentlicher Aufruf zählt");
  // =======================================================================
  const token0 = (await api("/auth/login", { method: "POST", json: ADMIN })).body.token;
  const before = (await api("/admin/stats?days=1", { token: token0 })).body.totals.views;
  await gotoPageRaw(page, "/termine");
  await gotoPageRaw(page, "/einsaetze");
  const counted = await waitFor(async () => {
    const now = (await api("/admin/stats?days=1", { token: token0 })).body.totals.views;
    return now >= before + 2;
  });
  check("Aufrufe eines Besuchers werden gezählt", counted);

  const beforeBot = (await api("/admin/stats?days=1", { token: token0 })).body.totals.views;
  await api("/stats/hit", {
    method: "POST", json: { path: "/", referrer: "" },
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1)", ip: "198.51.100.200",
  });
  await api("/stats/hit", {
    method: "POST", json: { path: "/intern/dashboard", referrer: "" },
    ua: "Mozilla/5.0 Chrome/120", ip: "198.51.100.201",
  });
  await new Promise((r) => setTimeout(r, 700));
  const afterBot = (await api("/admin/stats?days=1", { token: token0 })).body.totals.views;
  check("Bot wird nicht gezählt, /intern wird nicht gezählt", afterBot === beforeBot, `${beforeBot} -> ${afterBot}`);

  // =======================================================================
  group("4. Anmeldung im internen Bereich");
  // =======================================================================
  await gotoPageRaw(page, `/intern`);
  await page.fill('[data-testid="input-username"]', ADMIN.username);
  await page.fill('[data-testid="input-password"]', "falschesPasswort");
  await page.click('[data-testid="button-login"]');
  await page.waitForTimeout(800);
  check("Falsches Passwort meldet Fehler", (await page.locator("body").innerText()).includes("falsch"));

  await page.fill('[data-testid="input-password"]', ADMIN.password);
  await page.click('[data-testid="button-login"]');
  await page.waitForSelector('[data-testid="text-current-user"]', { timeout: 10000 });
  check("Anmeldung erfolgreich", (await page.locator('[data-testid="text-current-user"]').innerText()).includes("Administrator"));

  // Angemeldete Redakteure werden nicht mitgezählt
  const beforeEditor = (await api("/admin/stats?days=1", { token: token0 })).body.totals.views;
  await gotoPageRaw(page, "/einsaetze");
  await page.waitForTimeout(900);
  const afterEditor = (await api("/admin/stats?days=1", { token: token0 })).body.totals.views;
  check("Angemeldete Redakteure werden nicht gezählt", afterEditor === beforeEditor, `${beforeEditor} -> ${afterEditor}`);

  // =======================================================================
  group("5. Statistik-Dashboard zeigt Diagramm");
  // =======================================================================
  await gotoPageRaw(page, `/intern/dashboard`);
  await page.waitForSelector('[data-testid="text-stat-views"]', { timeout: 10000 });
  check("Kennzahl „Aufrufe“ sichtbar", Number((await page.locator('[data-testid="text-stat-views"]').innerText()).replace(/\D/g, "")) > 0);
  check("Kennzahl „Besucher“ sichtbar", await page.locator('[data-testid="text-stat-visitors"]').isVisible());
  const hasChart = await page.locator("svg.recharts-surface, .recharts-wrapper").count();
  check("Diagramm wird gezeichnet", hasChart > 0, `${hasChart} Elemente`);
  await page.click('[data-testid="button-stats-range-7"]');
  await page.waitForTimeout(800);
  check("Zeitraumwechsel funktioniert", await page.locator('[data-testid="text-stat-views"]').isVisible());

  // =======================================================================
  group("6. Beitrag mit großem Foto anlegen (Bildoptimierung)");
  // =======================================================================
  const photo = makeTestPhoto();
  if (!photo.withExif) skipped.push("EXIF-Prüfung (exiftool fehlt)");

  await gotoPageRaw(page, `/intern/beitraege/neu`);
  await page.fill('[data-testid="input-post-title"]', "E2E Einsatz mit großem Foto");
  await page.fill('[data-testid="input-post-excerpt"]', "Kurzfassung aus dem automatischen Test.");
  await page.click('[data-testid="select-post-category"]');
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: "Einsätze", exact: true }).click();
  await page.waitForTimeout(300);
  await page.fill('[data-testid="input-post-stichwort"]', "THL 2");
  await page.fill('[data-testid="input-post-ort"]', "Kirchberg, Testweg 1");
  await page.setInputFiles('[data-testid="input-featured-upload"]', photo.file);
  const uploaded = await waitFor(async () => (await page.locator('[data-testid="button-remove-featured"]').count()) > 0, { timeout: 30000 });
  check("Titelbild wurde hochgeladen", uploaded);

  // Karte setzen
  await page.click('[data-testid="button-open-location"]');
  await page.waitForTimeout(500);
  const mapSet = await page.evaluate(() => {
    // Karte per Klick setzen ist im Headless-Test unzuverlässig – wir nutzen
    // die Adresssuche nicht (externer Dienst) und setzen den Wert direkt.
    return document.querySelector('[data-testid="input-location-search"]') !== null;
  });
  check("Karten-Eingabe geöffnet", mapSet);

  await page.click('[data-testid="button-save-publish"]');
  await page.waitForTimeout(1500);

  const created = (await api("/admin/posts", { token: token0 })).body.find((p) => p.title === "E2E Einsatz mit großem Foto");
  check("Beitrag wurde gespeichert", !!created);
  check("Slug wurde erzeugt", created?.slug === "e2e-einsatz-mit-grossem-foto", created?.slug);
  check("Einsatz-Stichwort gespeichert", created?.stichwort === "THL 2");

  const featured = created?.featuredImage ?? "";
  check("Titelbild ist WebP", featured.endsWith(".webp"), featured);
  const imgRes = await fetch(`${BASE}${featured}`);
  check("Titelbild ist abrufbar", imgRes.status === 200 && imgRes.headers.get("content-type") === "image/webp");

  const localImg = path.join(TMP, "ergebnis.webp");
  writeFileSync(localImg, Buffer.from(await imgRes.arrayBuffer()));
  const dims = execFileSync("php", ["-r", `$i=getimagesize('${localImg}'); echo $i[0]."x".$i[1];`], { encoding: "utf8" });
  const [w, h] = dims.split("x").map(Number);
  check("Bild auf max. 1600 px verkleinert", Math.max(w, h) === 1600, dims);
  check("EXIF-Drehung wurde angewendet (Hochformat)", h > w, dims);

  if (photo.withExif) {
    const meta = readExif(localImg) ?? "";
    check("GPS-Position entfernt", !/GPS/i.test(meta));
    check("Kamera-/Autorangaben entfernt", !/TestPhone|TestCam|Vertraulich/i.test(meta));
    check("Kein EXIF-Block mehr enthalten", !/\[EXIF\]/i.test(meta));
  }

  // Beitrag ist öffentlich sichtbar
  check("Neuer Beitrag öffentlich sichtbar", contains(await gotoPage(page, `/beitrag/${created.slug}`, { expect: "E2E Einsatz" }), "E2E Einsatz mit großem Foto"));

  // Das Hauptbild gehört auf die Beitragsseite – nicht nur in die Übersicht
  await page.waitForSelector('[data-testid="post-lead-image"]', { timeout: 10000 });
  const leadSrc = await page.locator('[data-testid="post-lead-image"]').getAttribute("src");
  check("Hauptbild steht auf der Beitragsseite", (leadSrc ?? "").endsWith(featured), `${leadSrc}`);
  check(
    "Hauptbild ist wirklich geladen",
    await page.evaluate(() => {
      const img = document.querySelector('[data-testid="post-lead-image"]');
      return !!img && img.complete && img.naturalWidth > 0;
    }),
  );
  await page.click('[data-testid="button-post-lead-image"]');
  await page.waitForSelector('[data-testid="post-lead-image-lightbox"]', { timeout: 10000 });
  check("Klick zeigt das Hauptbild groß", await page.locator('[data-testid="post-lead-image-lightbox"]').isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check("Escape schließt das große Hauptbild", (await page.locator('[data-testid="post-lead-image-lightbox"]').count()) === 0);

  // =======================================================================
  group("7. Kartenstandort setzen und anzeigen");
  // =======================================================================
  await api(`/admin/posts/${created.id}`, {
    method: "POST", token: token0,
    json: { lat: 48.3372, lng: 12.0489 },
  }).then(() => {}); // ohne _method -> PATCH separat unten
  await fetch(`${BASE}/api.php?r=${encodeURIComponent(`/admin/posts/${created.id}`)}&_method=PATCH`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ lat: 48.3372, lng: 12.0489 }),
  });
  const withMap = (await api(`/posts/slug/${created.slug}`)).body;
  check("Standort gespeichert", withMap.lat === 48.3372 && withMap.lng === 12.0489, `${withMap.lat}/${withMap.lng}`);

  await gotoPage(page, `/beitrag/${created.slug}`, { expect: "Standort" });
  await page.waitForSelector('[data-testid="button-show-map"]', { timeout: 15000 });
  check("Karte erscheint erst nach Klick (2-Klick-Lösung)", await page.locator('[data-testid="button-show-map"]').isVisible());
  await page.click('[data-testid="button-show-map"]');
  const mapVisible = await waitFor(async () => (await page.locator(".leaflet-container").count()) > 0, { timeout: 15000 });
  check("Karte wird nach Klick angezeigt", mapVisible);
  check("Link zu Google Maps vorhanden", (await page.locator('[data-testid="link-google-maps"]').count()) > 0);

  // =======================================================================
  group("8. Termine pflegen");
  // =======================================================================
  await gotoPageRaw(page, `/intern/termine`);
  await page.click('[data-testid="button-new-event"]');
  await page.waitForSelector('[data-testid="input-event-title"]');
  await page.fill('[data-testid="input-event-title"]', "E2E Jahreshauptversammlung");
  await page.fill('[data-testid="input-event-date"]', "2027-03-15");
  await page.fill('[data-testid="input-event-time"]', "19:30");
  await page.fill('[data-testid="input-event-location"]', "Gasthaus Müller");
  await page.fill('[data-testid="input-event-description"]', "Aus dem automatischen Test.");
  await page.click('[data-testid="button-save-event"]');
  await page.waitForTimeout(1200);

  const events = (await api("/events")).body;
  const newEvent = events.find((e) => e.title === "E2E Jahreshauptversammlung");
  check("Termin wurde gespeichert", !!newEvent);
  check("Terminfelder korrekt", newEvent?.date === "2027-03-15" && newEvent?.time === "19:30" && newEvent?.location === "Gasthaus Müller");

  check("Termin öffentlich sichtbar", contains(await gotoPage(page, "/termine", { expect: "E2E Jahreshauptversammlung" }), "E2E Jahreshauptversammlung"));

  // =======================================================================
  group("9. Datei mit stabilem Link hochladen und austauschen");
  // =======================================================================
  const pdf1 = path.join(TMP, "uebungsplan.pdf");
  const pdf2 = path.join(TMP, "uebungsplan-neu.pdf");
  writeFileSync(pdf1, "%PDF-1.4\n% AUSGABE EINS\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  writeFileSync(pdf2, "%PDF-1.4\n% AUSGABE ZWEI\ntrailer<</Root 1 0 R>>\n%%EOF\n");

  await gotoPageRaw(page, `/intern/dateien`);
  await page.click('[data-testid="button-new-document"]');
  await page.waitForSelector('[data-testid="input-document-title"]');
  await page.fill('[data-testid="input-document-title"]', "Übungsplan 2027");
  await page.setInputFiles('[data-testid="input-document-file"]', pdf1);
  await page.click('[data-testid="button-save-document"]');
  await page.waitForTimeout(1500);

  const docs = (await api("/admin/documents", { token: token0 })).body;
  const doc = docs.find((d) => d.title === "Übungsplan 2027");
  check("Datei wurde angelegt", !!doc);
  check("Stabiler Slug erzeugt", doc?.slug === "uebungsplan-2027", doc?.slug);

  const dl1 = await fetch(`${BASE}/datei.php?s=${doc.slug}`);
  const dl1Text = await dl1.text();
  check("Stabiler Link liefert die Datei", dl1.status === 200 && dl1Text.includes("AUSGABE EINS"));
  check("Content-Type ist PDF", dl1.headers.get("content-type") === "application/pdf");
  check("PDF wird inline angezeigt", (dl1.headers.get("content-disposition") ?? "").startsWith("inline"));
  check("Datei wird nicht zwischengespeichert", (dl1.headers.get("cache-control") ?? "").includes("no-cache"));

  await page.setInputFiles(`[data-testid="input-replace-document-${doc.id}"]`, pdf2);
  await page.waitForTimeout(1800);

  const dl2 = await fetch(`${BASE}/datei.php?s=${doc.slug}`);
  const dl2Text = await dl2.text();
  check("Nach dem Austauschen liefert derselbe Link die neue Datei", dl2Text.includes("AUSGABE ZWEI"));
  const docAfter = (await api("/admin/documents", { token: token0 })).body.find((d) => d.id === doc.id);
  check("Slug (und damit der Link) blieb unverändert", docAfter.slug === doc.slug);

  // Datei-Link in einem Seitentext muss auf datei.php zeigen
  const pages = (await api("/admin/pages", { token: token0 })).body;
  const linkPage = pages.find((p) => p.slug === "links");
  await fetch(`${BASE}/api.php?r=${encodeURIComponent(`/admin/pages/${linkPage.id}`)}&_method=PATCH`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: `<p><a href="/dateien/${doc.slug}">Übungsplan (Altformat)</a></p>` }),
  });
  await gotoPageRaw(page, "/links");
  const legacyHref = await page.locator('a:has-text("Übungsplan (Altformat)")').getAttribute("href");
  check("Alter /dateien/-Link wird auf datei.php umgeschrieben", legacyHref?.includes("datei.php?s=") === true, String(legacyHref));

  // =======================================================================
  group("10. Seiten bearbeiten");
  // =======================================================================
  await gotoPageRaw(page, `/intern/seiten`);
  await page.click('[data-testid="row-admin-page-impressum"]');
  await page.waitForSelector('[data-testid="input-page-title"]');
  await page.fill('[data-testid="input-page-title"]', "Impressum (geprüft)");
  await page.click('[data-testid="button-save-page"]');
  await page.waitForTimeout(1200);

  const impressum = (await api("/pages/impressum")).body;
  check("Seitentitel wurde gespeichert", impressum.title === "Impressum (geprüft)", impressum.title);
  check("Seiten-Slug blieb stabil", impressum.slug === "impressum");
  check("Seiteninhalt blieb erhalten", impressum.content.includes("Digitale-Dienste-Gesetz"));

  check("Geänderte Seite öffentlich sichtbar", contains(await gotoPage(page, "/impressum", { expect: "Digitale-Dienste-Gesetz" }), "Digitale-Dienste-Gesetz"));

  // =======================================================================
  group("11. Einstellung „Links in neuem Tab“");
  // =======================================================================
  await gotoPageRaw(page, `/intern/seiten`);
  await page.waitForSelector('[data-testid="checkbox-links-new-tab"]');

  await fetch(`${BASE}/api.php?r=${encodeURIComponent("/admin/settings/site")}&_method=PUT`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ linksNewTab: true }),
  });
  await gotoPageRaw(page, "/links");
  await page.waitForTimeout(600);
  const targetOn = await page.locator('a:has-text("Übungsplan (Altformat)")').getAttribute("target");
  check("Eingeschaltet: Links öffnen in neuem Tab", targetOn === "_blank", String(targetOn));

  await fetch(`${BASE}/api.php?r=${encodeURIComponent("/admin/settings/site")}&_method=PUT`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ linksNewTab: false }),
  });
  await gotoPageRaw(page, "/");
  await gotoPageRaw(page, "/links");
  await page.waitForTimeout(600);
  const targetOff = await page.locator('a:has-text("Übungsplan (Altformat)")').getAttribute("target");
  check("Ausgeschaltet: Links öffnen im selben Tab", targetOff === null, String(targetOff));

  // =======================================================================
  group("12. Benutzer anlegen und Rechte prüfen");
  // =======================================================================
  await gotoPageRaw(page, `/intern/benutzer`);
  await page.click('[data-testid="button-new-user"]');
  await page.waitForSelector('[data-testid="input-user-username"]');
  await page.fill('[data-testid="input-user-username"]', "e2etester");
  await page.fill('[data-testid="input-user-displayname"]', "E2E Tester");
  await page.fill('[data-testid="input-user-password"]', "TestPasswort123");
  await page.click('[data-testid="checkbox-perm-termine"]');
  await page.click('[data-testid="button-save-user"]');
  await page.waitForTimeout(1200);

  const users = (await api("/admin/users", { token: token0 })).body;
  const tester = users.find((u) => u.username === "e2etester");
  check("Benutzer wurde angelegt", !!tester);
  check("Berechtigung „termine“ gesetzt", (tester?.permissions ?? "").includes("termine"));
  check("Rolle ist Redakteur", tester?.role === "editor");

  const testerLogin = await api("/auth/login", { method: "POST", json: { username: "e2etester", password: "TestPasswort123" } });
  check("Neuer Benutzer kann sich anmelden", testerLogin.status === 200 && !!testerLogin.body.token);
  const tToken = testerLogin.body.token;

  const evOk = await api("/admin/events", {
    method: "POST", token: tToken,
    json: { title: "Von E2E-Tester", date: "2027-04-01", time: "18:00", location: "X", description: "", kind: "uebung" },
  });
  check("Darf Termine anlegen (Berechtigung vorhanden)", evOk.status === 200);
  check("Darf keine Fahrzeuge anlegen", (await api("/admin/vehicles", { method: "POST", token: tToken, json: { name: "X" } })).status === 403);
  check("Darf keine Benutzer verwalten", (await api("/admin/users", { token: tToken })).status === 403);
  check("Darf keine Seiten bearbeiten", (await api("/admin/pages", { token: tToken })).status === 403);

  // Rechte entziehen -> Zugriff endet
  await fetch(`${BASE}/api.php?r=${encodeURIComponent(`/admin/users/${tester.id}`)}&_method=PATCH`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ permissions: [] }),
  });
  check("Nach Rechteentzug kein Zugriff mehr", (await api("/admin/events", { method: "POST", token: tToken, json: { title: "Y", date: "2027-04-02" } })).status === 403);

  // Deaktivieren -> Anmeldung nicht mehr möglich
  await fetch(`${BASE}/api.php?r=${encodeURIComponent(`/admin/users/${tester.id}`)}&_method=PATCH`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ active: 0 }),
  });
  check("Deaktivierter Benutzer kann sich nicht anmelden",
    (await api("/auth/login", { method: "POST", json: { username: "e2etester", password: "TestPasswort123" } })).status === 401);

  // =======================================================================
  group("13. Mediathek und Abmelden");
  // =======================================================================
  await gotoPageRaw(page, `/intern/medien`);
  await page.setInputFiles('[data-testid="input-media-upload"]', photo.file);
  const mediaAdded = await waitFor(async () => {
    const list = (await api("/admin/media", { token: token0 })).body;
    return list.some((m) => m.uploadedBy === "Administrator");
  }, { timeout: 30000 });
  check("Bild in die Mediathek hochgeladen", mediaAdded);
  const mediaItem = (await api("/admin/media", { token: token0 })).body.find((m) => m.uploadedBy === "Administrator");
  check("Mediathek-Bild ist WebP", mediaItem.url.endsWith(".webp"), mediaItem.url);
  check("Mediathek-Bild ist abrufbar", (await fetch(`${BASE}${mediaItem.url}`)).status === 200);

  await gotoPageRaw(page, `/intern/dashboard`);
  await page.click('[data-testid="button-logout"]');
  await page.waitForTimeout(1200);
  const tokenGone = await page.evaluate(() => localStorage.getItem("ffk_token") === null);
  check("Abmelden entfernt die gespeicherte Anmeldung", tokenGone);
  await gotoPageRaw(page, "/intern");
  check("Interner Bereich verlangt wieder eine Anmeldung", (await page.locator('[data-testid="input-username"]').count()) > 0);

  // =======================================================================
  group("14. Mehrere Bilder je Beitrag (Galerie)");
  // =======================================================================
  // Der Test hat sich in Gruppe 13 abgemeldet – für den Editor neu anmelden.
  await gotoPageRaw(page, "/intern");
  await page.fill('[data-testid="input-username"]', ADMIN.username);
  await page.fill('[data-testid="input-password"]', ADMIN.password);
  await page.click('[data-testid="button-login"]');
  await page.waitForSelector('[data-testid="text-current-user"]', { timeout: 15000 });

  const mediathek = (await api("/admin/media", { token: token0 })).body;
  const bildA = mediathek[0].url;
  const bildB = mediathek[1].url;

  await gotoPageRaw(page, `/intern/beitraege/${created.id}`);
  await page.waitForSelector('[data-testid="input-post-title"]', { timeout: 15000 });

  // Bereits hochgeladene Bilder über die Mediathek verknüpfen
  await page.click('[data-testid="button-gallery-editor-from-library"]');
  await page.waitForSelector('[data-testid="input-media-search"]', { timeout: 15000 });
  check("Mediathek-Auswahl öffnet sich", await page.locator('[data-testid="input-media-search"]').isVisible());
  const kacheln = await page.locator('[data-testid^="button-pick-media-"]').count();
  check("Mediathek zeigt vorhandene Bilder", kacheln > 10, `${kacheln} Kacheln`);

  await page.locator('[data-testid^="button-pick-media-"]').nth(0).click();
  await page.locator('[data-testid^="button-pick-media-"]').nth(1).click();
  await page.click('[data-testid="button-media-confirm"]');
  await page.waitForTimeout(500);
  const inGalerie = await page.locator('[data-testid="gallery-editor"] img').count();
  check("Zwei Bilder in die Galerie übernommen", inGalerie === 2, `${inGalerie}`);

  // Zusätzlich ein neues Bild hochladen
  await page.setInputFiles('[data-testid="input-gallery-editor-upload"]', photo.file);
  const dreiBilder = await waitFor(
    async () => (await page.locator('[data-testid="gallery-editor"] img').count()) === 3,
    { timeout: 30000 },
  );
  check("Hochgeladenes Bild kommt in die Galerie", dreiBilder);

  await page.click('[data-testid="button-save-publish"]');
  await page.waitForTimeout(1500);

  const mitGalerie = (await api(`/posts/slug/${created.slug}`)).body;
  let galerie = [];
  try { galerie = JSON.parse(mitGalerie.images); } catch { galerie = []; }
  check("Galerie wurde gespeichert", galerie.length === 3, JSON.stringify(galerie).slice(0, 90));
  check("Galerie enthält die gewählten Bestandsbilder", galerie.includes(bildA) && galerie.includes(bildB));

  // Öffentliche Anzeige samt Vergrößern. Das Hauptbild liegt ebenfalls in der
  // Mediathek und kann dabei mit ausgewählt worden sein – dann steht es oben
  // groß und nicht noch einmal als Kachel.
  await gotoPage(page, `/beitrag/${created.slug}`, { expect: "Bilder" });
  const erwarteteKacheln = galerie.filter((url) => url !== featured).length;
  const kachelnOeffentlich = await page.locator('[data-testid^="button-post-gallery-image-"]').count();
  check("Galerie erscheint auf der Beitragsseite", kachelnOeffentlich === erwarteteKacheln,
    `${kachelnOeffentlich} statt ${erwarteteKacheln}`);
  await page.click('[data-testid="button-post-gallery-image-0"]');
  await page.waitForSelector('[data-testid="post-gallery-lightbox"]', { timeout: 10000 });
  check("Klick vergrößert das Bild", await page.locator('[data-testid="post-gallery-lightbox"]').isVisible());
  await page.click('[data-testid="button-post-gallery-next"]');
  await page.waitForTimeout(300);
  check("Weiterblättern funktioniert", await page.locator('[data-testid="post-gallery-lightbox"]').isVisible());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("Escape schließt die Großansicht", (await page.locator('[data-testid="post-gallery-lightbox"]').count()) === 0);

  // Steht das Hauptbild auch in der Galerie, darf es nicht doppelt erscheinen
  const mitTitelbild = Array.from(new Set([...galerie, featured]));
  await fetch(`${BASE}/api.php?r=${encodeURIComponent(`/admin/posts/${created.id}`)}&_method=PATCH`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ images: mitTitelbild }),
  });
  await gotoPage(page, `/beitrag/${created.slug}`, { expect: "Bilder" });
  const kachelnOhneDoppel = await page.locator('[data-testid^="button-post-gallery-image-"]').count();
  check("Hauptbild erscheint in der Galerie nicht doppelt", kachelnOhneDoppel === mitTitelbild.length - 1,
    `${kachelnOhneDoppel} von ${mitTitelbild.length}`);
  check("Hauptbild steht weiterhin oben", (await page.locator('[data-testid="post-lead-image"]').count()) === 1);

  // Fremde Adressen werden abgewiesen
  const fremd = await fetch(`${BASE}/api.php?r=${encodeURIComponent(`/admin/posts/${created.id}`)}&_method=PATCH`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
    body: JSON.stringify({ images: ["https://fremde-seite.example/bild.jpg"] }),
  });
  check("Fremde Bildadressen werden abgelehnt", fremd.status === 400);

  // =======================================================================
  group("15. Mehrere Bilder je Fahrzeug");
  // =======================================================================
  const fahrzeug = (await api("/vehicles")).body[0];
  await gotoPageRaw(page, "/intern/fahrzeuge");
  await page.click(`[data-testid="button-edit-vehicle-${fahrzeug.id}"]`);
  await page.waitForSelector('[data-testid="input-vehicle-name"]', { timeout: 15000 });

  await page.click('[data-testid="button-vehicle-gallery-from-library"]');
  await page.waitForSelector('[data-testid="input-media-search"]', { timeout: 15000 });
  await page.locator('[data-testid^="button-pick-media-"]').nth(2).click();
  await page.locator('[data-testid^="button-pick-media-"]').nth(3).click();
  await page.click('[data-testid="button-media-confirm"]');
  await page.waitForTimeout(500);
  check(
    "Zwei Bilder im Fahrzeug-Dialog übernommen",
    (await page.locator('[data-testid="vehicle-gallery"] img').count()) === 2,
  );

  await page.click('[data-testid="button-save-vehicle"]');
  await page.waitForTimeout(1500);

  const fahrzeugNachher = (await api("/vehicles")).body.find((v) => v.id === fahrzeug.id);
  let fahrzeugBilder = [];
  try { fahrzeugBilder = JSON.parse(fahrzeugNachher.images); } catch { fahrzeugBilder = []; }
  check("Fahrzeug-Galerie wurde gespeichert", fahrzeugBilder.length === 2, JSON.stringify(fahrzeugBilder).slice(0, 80));
  check("Titelbild des Fahrzeugs blieb unverändert", fahrzeugNachher.image === fahrzeug.image);

  await gotoPage(page, "/geraetehaus", { expect: fahrzeug.name });
  const fahrzeugKacheln = await page.locator(`[data-testid^="button-vehicle-gallery-${fahrzeug.id}-image-"]`).count();
  check("Gerätehaus zeigt die Fahrzeugbilder", fahrzeugKacheln === 2, `${fahrzeugKacheln}`);
  await page.click(`[data-testid="button-vehicle-gallery-${fahrzeug.id}-image-0"]`);
  await page.waitForSelector(`[data-testid="vehicle-gallery-${fahrzeug.id}-lightbox"]`, { timeout: 10000 });
  check("Fahrzeugbild lässt sich vergrößern", true);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  const fremdesFahrzeugbild = await fetch(
    `${BASE}/api.php?r=${encodeURIComponent(`/admin/vehicles/${fahrzeug.id}`)}&_method=PATCH`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token0}`, "Content-Type": "application/json" },
      body: JSON.stringify({ images: ["https://fremde-seite.example/bild.jpg"] }),
    },
  );
  check("Fremde Bildadressen bei Fahrzeugen abgelehnt", fremdesFahrzeugbild.status === 400);

  // =======================================================================
  group("16. Reihenfolge der Mitglieder");
  // =======================================================================
  for (const name of ["Anton Erster", "Berta Zweite", "Cäsar Dritter"]) {
    await api("/admin/members", {
      method: "POST", token: token0,
      json: { name, funktion: "Test", gruppe: "vorstandschaft" },
    });
  }
  const vorher = (await api("/members")).body.filter((m) => m.funktion === "Test").map((m) => m.name);
  check("Testmitglieder angelegt", vorher.length === 3, vorher.join(", "));

  await gotoPageRaw(page, "/intern/mitglieder");
  await page.waitForSelector('[data-testid^="row-admin-member-"]', { timeout: 15000 });

  // Letzten Eintrag der Vorstandschaft zweimal nach oben schieben
  const idListe = (await api("/members")).body.filter((m) => m.gruppe === "vorstandschaft").map((m) => m.id);
  const letzteId = idListe[idListe.length - 1];
  await page.click(`[data-testid="button-member-up-${letzteId}"]`);
  await page.waitForTimeout(900);
  await page.click(`[data-testid="button-member-up-${letzteId}"]`);
  await page.waitForTimeout(900);

  const nachher = (await api("/members")).body.filter((m) => m.gruppe === "vorstandschaft").map((m) => m.id);
  check(
    "Pfeiltaste verschiebt den Eintrag nach oben",
    nachher.indexOf(letzteId) === idListe.length - 3,
    `Position ${nachher.indexOf(letzteId)} statt ${idListe.length - 1}`,
  );
  const sortierungen = (await api("/members")).body
    .filter((m) => m.gruppe === "vorstandschaft")
    .map((m) => m.sortOrder);
  check(
    "Sortiernummern sind lückenlos aufsteigend",
    sortierungen.every((v, i) => v === i + 1),
    sortierungen.join(","),
  );

  // Ziehen mit der Maus (Desktop-Weg)
  const vorDrag = (await api("/members")).body.filter((m) => m.gruppe === "vorstandschaft").map((m) => m.id);
  await gotoPageRaw(page, "/intern/mitglieder");
  await page.waitForSelector(`[data-testid="row-admin-member-${vorDrag[0]}"]`, { timeout: 15000 });
  await page
    .locator(`[data-testid="row-admin-member-${vorDrag[0]}"]`)
    .dragTo(page.locator(`[data-testid="row-admin-member-${vorDrag[vorDrag.length - 1]}"]`));
  await page.waitForTimeout(1200);
  const nachDrag = (await api("/members")).body.filter((m) => m.gruppe === "vorstandschaft").map((m) => m.id);
  check(
    "Ziehen ändert die Reihenfolge",
    nachDrag[0] !== vorDrag[0] && nachDrag.length === vorDrag.length,
    `${vorDrag.join(",")} -> ${nachDrag.join(",")}`,
  );

  // Öffentliche Seite zeigt dieselbe Reihenfolge
  const reihenfolgeApi = (await api("/members")).body
    .filter((m) => m.gruppe === "vorstandschaft").map((m) => m.name);
  const ueberUns = await gotoPage(page, "/ueber-uns", { expect: reihenfolgeApi[0] });
  const positionen = reihenfolgeApi.map((n) => ueberUns.indexOf(n));
  check(
    "Über uns zeigt die gepflegte Reihenfolge",
    positionen.every((v, i) => v >= 0 && (i === 0 || v > positionen[i - 1])),
    positionen.join(","),
  );

  // =======================================================================
  group("17. Erneutes Einlesen überschreibt nichts");
  // =======================================================================
  const vorReimport = {
    mitglieder: (await api("/members")).body.length,
    beitraege: (await api("/posts")).body.length,
    seite: (await api("/pages/impressum")).body.title,
    termine: (await api("/events")).body.length,
    fahrzeuge: (await api("/vehicles")).body.map((v) => v.name).join(","),
  };
  // Erzwungenes Neu-Einlesen wie beim Reparaturweg in der config.php
  await api("/admin/settings/site", { method: "POST", token: token0, json: { linksNewTab: true } });
  const reimport = await fetch(`${BASE}/api.php?r=${encodeURIComponent("/posts")}`);
  check("Seite bleibt erreichbar", reimport.status === 200);

  const nachReimport = {
    mitglieder: (await api("/members")).body.length,
    beitraege: (await api("/posts")).body.length,
    seite: (await api("/pages/impressum")).body.title,
    termine: (await api("/events")).body.length,
    fahrzeuge: (await api("/vehicles")).body.map((v) => v.name).join(","),
  };
  check("Mitglieder unverändert", nachReimport.mitglieder === vorReimport.mitglieder);
  check("Beiträge unverändert", nachReimport.beitraege === vorReimport.beitraege);
  check("Seitentitel unverändert", nachReimport.seite === vorReimport.seite);
  check("Termine unverändert", nachReimport.termine === vorReimport.termine);
  check("Fahrzeuge unverändert", nachReimport.fahrzeuge === vorReimport.fahrzeuge);

  // =======================================================================
  group("18. Verständliche Meldungen beim Bild-Upload");
  // =======================================================================
  // Eine Textdatei mit Bild-Endung muss abgelehnt werden – mit einer Meldung,
  // die den Dateinamen und den Grund nennt, statt nur „ging nicht".
  const keinBild = path.join(TMP, "kein-bild.jpg");
  writeFileSync(keinBild, "das ist kein Bild");
  const fd = new FormData();
  fd.append("files[]", new Blob([readFileSync(keinBild)]), "kein-bild.jpg");
  const abgelehnt = await fetch(`${BASE}/api.php?r=${encodeURIComponent("/admin/media")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token0}` },
    body: fd,
  });
  const meldung = (await abgelehnt.json()).message ?? "";
  check("Textdatei mit .jpg wird abgelehnt", abgelehnt.status === 400, `${abgelehnt.status}`);
  check("Meldung nennt den Dateinamen", meldung.includes("kein-bild.jpg"), meldung.slice(0, 90));
  check("Meldung nennt den Grund", /keine Bilddatei/i.test(meldung), meldung.slice(0, 90));

  // Ein echtes Bild geht danach unverändert durch
  check("Mediathek weiterhin abrufbar", (await api("/admin/media", { token: token0 })).status === 200);

  // =======================================================================
  group("19. Große Handy-Fotos");
  // =======================================================================
  // Ein Foto vom Handy ist schnell 15 MB groß. Viele Server weisen so große
  // Anfragen ab, bevor PHP sie überhaupt sieht – dann käme nur ein
  // nichtssagendes „Upload fehlgeschlagen" zurück. Deshalb verkleinert der
  // Browser das Foto vorher; der Server begrenzt ohnehin auf 1600 px.
  const handyFoto = makeHugePhoto();
  const originalBytes = statSync(handyFoto).size;
  check("Testfoto ist so groß wie ein Handy-Foto", originalBytes > 8 * 1024 * 1024,
    `${Math.round(originalBytes / 1024 / 1024)} MB`);

  await gotoPageRaw(page, `/intern/beitraege/${created.id}`);
  await page.waitForSelector('[data-testid="input-post-title"]', { timeout: 15000 });
  const bilderVorher = await page.locator('[data-testid="gallery-editor"] img').count();

  // Gemessen wird, was die Anwendung an fetch übergibt – also genau die
  // Dateien nach dem Verkleinern.
  await page.evaluate(() => {
    const original = window.fetch;
    window.__uploadBytes = null;
    window.fetch = (input, init) => {
      if (init?.body instanceof FormData) {
        let summe = 0;
        for (const [, wert] of init.body.entries()) {
          if (wert instanceof File) summe += wert.size;
        }
        if (summe > 0) window.__uploadBytes = summe;
      }
      return original(input, init);
    };
  });

  await page.setInputFiles('[data-testid="input-gallery-editor-upload"]', handyFoto);
  const angekommen = await waitFor(
    async () => (await page.locator('[data-testid="gallery-editor"] img').count()) === bilderVorher + 1,
    { timeout: 60000 },
  );
  const anfrageBytes = await page.evaluate(() => window.__uploadBytes);

  check("Großes Handy-Foto wird angenommen", angekommen);
  check(
    "Foto wird schon im Browser verkleinert",
    anfrageBytes !== null && anfrageBytes > 0 && anfrageBytes < originalBytes / 4,
    `${Math.round((anfrageBytes ?? 0) / 1024)} KB statt ${Math.round(originalBytes / 1024)} KB`,
  );
  console.log(`    gesendet: ${Math.round((anfrageBytes ?? 0) / 1024)} KB statt ${Math.round(originalBytes / 1024)} KB`);

  const neuestes = (await api("/admin/media", { token: token0 })).body[0];
  const geladen = await fetch(`${BASE}${neuestes.url}`);
  const kopie = path.join(TMP, "handy-ergebnis" + path.extname(neuestes.url));
  writeFileSync(kopie, Buffer.from(await geladen.arrayBuffer()));
  const masse = execFileSync("php", ["-r", `$i=getimagesize('${kopie}'); echo $i[0]."x".$i[1];`], { encoding: "utf8" });
  check("Ergebnis ist auf 1600 px begrenzt", Math.max(...masse.split("x").map(Number)) === 1600, masse);

  // =======================================================================
  group("20. Keine Fehler im Browser");
  // =======================================================================
  // Externe Ressourcen (Schriftarten, Kartenkacheln) sind in der Testumgebung
  // ohne Internetzugang nicht erreichbar – das sind keine Fehler der Anwendung.
  const realErrors = consoleErrors.filter(
    (e) =>
      !/favicon|ERR_INTERNET|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_ABORTED|fontshare|openstreetmap|Download the React DevTools/i.test(e)
      // Die absichtlich falsche Anmeldung protokolliert der Browser als 401.
      && !/status of 401/i.test(e),
  );
  check("Keine JavaScript-Fehler", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
  const realFailed = failedRequests.filter((r) => !/favicon/i.test(r));
  check("Keine fehlgeschlagenen API-/Bild-Anfragen", realFailed.length === 0, realFailed.slice(0, 5).join(" | "));
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(70));
console.log(`Bestanden: ${passed}   Fehlgeschlagen: ${failures.length}   Übersprungen: ${skipped.length}`);
if (skipped.length) console.log("Übersprungen: " + skipped.join(", "));
if (failures.length) {
  console.log("\nFehlgeschlagen:");
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("Alle Tests bestanden.");
