/**
 * Erzeugt das Standard-Hero-Bild der Startseite (uploads/hero-standard.png):
 * dunkle Grafik mit dem Wappen der FF Kirchberg und dem First-Responder-Logo.
 * Die dunklen/blauen Schriftanteile des First-Responder-Logos werden für den
 * dunklen Hintergrund aufgehellt; das eingebettete Wappen bleibt unverändert.
 *
 * Aufruf: npx tsx script/make-hero.ts
 */
import sharp from "sharp";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "uploads", "hero-standard.png");

const W = 1920;
const H = 1080;

// Wappen-Bereich im FR-Logo (bleibt unverändert farbig)
const WAPPEN_BOX = { x0: 250, x1: 375, y0: 115, y1: 242 };

/**
 * Das FR-Logo liegt auf weißem Hintergrund. Für die dunkle Hero-Grafik:
 * - weißen Hintergrund entfernen (Flood-Fill von den Rändern + Luminanz-Alpha)
 * - graue/schwarze Schrift ("RESPONDER", Herzlinie) → helle Schrift
 * - blaues "KIRCHBERG" aufhellen, Rot erhalten
 * - eingebettetes Wappen unverändert lassen
 */
async function recolorFrLogo(): Promise<Buffer> {
  const src = sharp(path.join(ROOT, "uploads/wp/1950_Logo-First-Responder-Kirchberg.png"));
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const idx = (x: number, y: number) => (y * width + x) * channels;
  const isWhiteBg = (x: number, y: number) => {
    const i = idx(x, y);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) < 30 && (r + g + b) / 3 > 235;
  };

  // Flood-Fill von allen Bildrändern über weiße Pixel → Hintergrund
  const bg = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (bg[p] || !isWhiteBg(x, y)) return;
    bg[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width, y = (p / width) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y);
      if (bg[y * width + x]) { data[i + 3] = 0; continue; }
      if (x >= WAPPEN_BOX.x0 && x <= WAPPEN_BOX.x1 && y >= WAPPEN_BOX.y0 && y <= WAPPEN_BOX.y1) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const min = Math.min(r, g, b);
      const sat = Math.max(r, g, b) - min;
      const lum = (r + g + b) / 3;
      if (sat < 40) {
        // Grautöne → helle Schrift, Deckkraft nach Dunkelheit (Weiß → transparent)
        data[i] = 236; data[i + 1] = 238; data[i + 2] = 242;
        data[i + 3] = Math.min(255, Math.round(1.6 * (255 - lum)));
      } else {
        // Farbige Pixel: Weiß herausrechnen (Kantenglättung gegen Weiß entfernen)
        const alpha = (255 - min) / 255;
        const un = (c: number) => Math.max(0, Math.min(255, Math.round((c - (1 - alpha) * 255) / alpha)));
        let nr = un(r), ng = un(g), nb = un(b);
        if (nb > nr && nb > ng) {
          // Blaues "KIRCHBERG" aufhellen
          nr = Math.min(255, Math.round(nr * 1.5 + 95));
          ng = Math.min(255, Math.round(ng * 1.5 + 95));
          nb = Math.min(255, Math.round(nb * 1.1 + 65));
        }
        data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
        data[i + 3] = Math.round(alpha * 255);
      }
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function main() {
  // Hintergrund: dunkler Verlauf passend zum Seitendesign (hsl(228 11% 7%)) + dezente rote Aura
  const bg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#171920"/>
          <stop offset="0.55" stop-color="#121319"/>
          <stop offset="1" stop-color="#0f1014"/>
        </linearGradient>
        <radialGradient id="glow" cx="0.68" cy="0.42" r="0.55">
          <stop offset="0" stop-color="#d92b3a" stop-opacity="0.14"/>
          <stop offset="0.6" stop-color="#d92b3a" stop-opacity="0.05"/>
          <stop offset="1" stop-color="#d92b3a" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.6" stop-color="#000000" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0.35"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#base)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <rect width="${W}" height="${H}" fill="url(#vignette)"/>
    </svg>
  `);

  const wappen = await sharp(path.join(ROOT, "client/public/wappen.png"))
    .resize({ height: 340 })
    .png()
    .toBuffer();
  const wappenMeta = await sharp(wappen).metadata();

  const fr = await recolorFrLogo();
  const frResized = await sharp(fr).resize({ width: 640 }).png().toBuffer();
  const frMeta = await sharp(frResized).metadata();

  // Logos nebeneinander, rechts der Mitte und im oberen Drittel gruppieren
  // (links liegt später der Hero-Text, unten läuft der Verlauf in die Seite aus)
  const gap = 70;
  const wappenW = wappenMeta.width ?? 0;
  const frW = frMeta.width ?? 0;
  const frH = frMeta.height ?? 0;
  const groupCx = Math.round(W * 0.7);
  const groupCy = 430;
  const left0 = groupCx - Math.round((wappenW + gap + frW) / 2);

  await sharp(bg)
    .composite([
      { input: wappen, left: left0, top: groupCy - 170 },
      { input: frResized, left: left0 + wappenW + gap, top: groupCy - Math.round(frH / 2) },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT);
  console.log("geschrieben:", OUT);
}

main();
