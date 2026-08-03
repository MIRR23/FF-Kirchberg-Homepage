import type { Express, Request } from "express";
import express from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import sharp from "sharp";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import {
  insertPostSchema, insertEventSchema, insertVehicleSchema,
  insertMemberSchema, insertPageSchema, insertUserSchema,
  PERMISSION_AREAS, heroSettingsSchema, DEFAULT_HERO_SETTINGS,
} from "@shared/schema";
import type { HeroSettings } from "@shared/schema";
import type { PermissionArea } from "@shared/schema";
import {
  hashPassword, verifyPassword, newToken, safeUser, tokenCutoffIso,
  requireAuth, requirePermission, requireAdmin, hasPermission,
} from "./auth";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const DOC_DIR = path.join(UPLOAD_DIR, "dokumente");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(UPLOAD_DIR, "neu");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  // Handy-Fotos dürfen groß sein – sie werden nach dem Upload ohnehin verkleinert
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /image\/(jpeg|png|gif|webp|avif)/.test(file.mimetype));
  },
});

/**
 * Verkleinert und optimiert ein hochgeladenes Bild für das Web:
 * EXIF-Drehung übernehmen, auf max. 1600 px begrenzen, als WebP (Qualität 82)
 * neu kodieren. Metadaten (inkl. GPS-Position vom Handy) werden dabei entfernt.
 * Animierte GIFs bleiben unverändert. Gibt den neuen Dateinamen zurück.
 */
async function optimizeImage(file: Express.Multer.File): Promise<string> {
  const meta = await sharp(file.path).metadata();
  if (!meta.width || !meta.height) throw new Error("kein Bild");
  if (file.mimetype === "image/gif") return file.filename; // Animationen nicht zerstören

  const tmp = `${file.path}.tmp`;
  await sharp(file.path)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(tmp);
  fs.unlinkSync(file.path);
  const newFilename = file.filename.replace(/\.[a-z0-9]+$/i, "") + ".webp";
  const newPath = path.join(path.dirname(file.path), newFilename);
  fs.renameSync(tmp, newPath);
  file.filename = newFilename;
  file.path = newPath;
  return newFilename;
}

// ---------- Dateien / Downloads ----------
// Erlaubte Dateitypen (Endung -> Content-Type). Bewusst keine HTML/SVG-Dateien,
// da diese im Browser Skripte ausführen könnten.
const DOCUMENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".rtf": "application/rtf",
  ".zip": "application/zip",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
export const DOCUMENT_EXTENSIONS = Object.keys(DOCUMENT_TYPES).map((e) => e.slice(1)).join(", ").toUpperCase();

const docUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(DOC_DIR, { recursive: true });
      cb(null, DOC_DIR);
    },
    filename: (_req, file, cb) => {
      const safe = file.originalname.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() in DOCUMENT_TYPES) return cb(null, true);
    const err = new Error(`Dieser Dateityp ist nicht erlaubt. Erlaubt sind: ${DOCUMENT_EXTENSIONS}.`) as Error & { status: number };
    err.status = 400;
    cb(err);
  },
});

function deleteDocumentFile(filename: string) {
  const fp = path.join(DOC_DIR, filename);
  if (fp.startsWith(DOC_DIR) && fs.existsSync(fp)) {
    try { fs.unlinkSync(fp); } catch { /* ignore */ }
  }
}

function getHeroSettings(): HeroSettings {
  const row = storage.getSetting("hero");
  if (!row) return DEFAULT_HERO_SETTINGS;
  try {
    return heroSettingsSchema.parse({ ...DEFAULT_HERO_SETTINGS, ...JSON.parse(row.value) });
  } catch {
    return DEFAULT_HERO_SETTINGS;
  }
}

function postArea(categoryId: number): PermissionArea {
  const cat = storage.getCategory(categoryId);
  return cat?.isEinsatz ? "einsaetze" : "neuigkeiten";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "beitrag";
}

function uniquePostSlug(base: string, excludeId?: number): string {
  let slug = base;
  let i = 2;
  for (;;) {
    const existing = storage.getPostBySlug(slug);
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i++}`;
  }
}

function uniqueDocumentSlug(base: string): string {
  let slug = base;
  let i = 2;
  while (storage.getDocumentBySlug(slug)) slug = `${base}-${i++}`;
  return slug;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(DOC_DIR, { recursive: true });
  app.set("trust proxy", 1); // hinter Reverse-Proxy (X-Forwarded-For) korrekt arbeiten
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen." },
  });

  // ---------- AUTH ----------
  app.post("/api/auth/login", loginLimiter, (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) return res.status(400).json({ message: "Benutzername und Passwort erforderlich" });
    const user = storage.getUserByUsername(String(username).toLowerCase().trim());
    if (!user || !user.active || !verifyPassword(String(password), user.password)) {
      return res.status(401).json({ message: "Benutzername oder Passwort falsch" });
    }
    storage.deleteTokensCreatedBefore(tokenCutoffIso()); // abgelaufene Sitzungen aufräumen
    const token = newToken();
    storage.createToken(token, user.id);
    res.json({ token, user: safeUser(user as any) });
  });

  app.post("/api/auth/logout", requireAuth, (req, res) => {
    const header = req.headers.authorization || "";
    storage.deleteToken(header.slice(7));
    res.json({ ok: true });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json(req.currentUser);
  });

  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body ?? {};
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ message: "Neues Passwort muss mindestens 8 Zeichen haben" });
    }
    const user = storage.getUser(req.currentUser!.id);
    if (!user || !verifyPassword(String(oldPassword ?? ""), user.password)) {
      return res.status(401).json({ message: "Aktuelles Passwort falsch" });
    }
    storage.updateUser(user.id, { password: hashPassword(String(newPassword)) });
    res.json({ ok: true });
  });

  // ---------- PUBLIC ----------
  app.get("/api/categories", (_req, res) => {
    res.json(storage.listCategories());
  });

  app.get("/api/posts", (req, res) => {
    const { category, year, einsatz, limit } = req.query;
    let categoryId: number | undefined;
    if (category) {
      const cat = storage.getCategoryBySlug(String(category));
      if (!cat) return res.json([]);
      categoryId = cat.id;
    }
    let list = storage.listPosts({
      categoryId,
      status: "published",
      year: year ? String(year) : undefined,
    });
    if (einsatz === "1") {
      const einsatzIds = new Set(storage.listCategories().filter((c) => c.isEinsatz).map((c) => c.id));
      list = list.filter((p) => einsatzIds.has(p.categoryId));
    }
    if (limit) list = list.slice(0, Number(limit));
    // Inhalte in Listen nicht mitschicken (Performance)
    res.json(list.map(({ content, ...rest }) => ({ ...rest, content: "" })));
  });

  app.get("/api/posts/years", (_req, res) => {
    const list = storage.listPosts({ status: "published" });
    const years = Array.from(new Set(list.map((p) => p.publishedAt.slice(0, 4)))).sort().reverse();
    res.json(years);
  });

  app.get("/api/posts/slug/:slug", (req, res) => {
    const post = storage.getPostBySlug(req.params.slug);
    if (!post || post.status !== "published") return res.status(404).json({ message: "Beitrag nicht gefunden" });
    res.json(post);
  });

  app.get("/api/events", (_req, res) => {
    res.json(storage.listEvents());
  });

  app.get("/api/vehicles", (_req, res) => {
    res.json(storage.listVehicles());
  });

  app.get("/api/members", (_req, res) => {
    res.json(storage.listMembers());
  });

  app.get("/api/pages/:slug", (req, res) => {
    const page = storage.getPageBySlug(req.params.slug);
    if (!page) return res.status(404).json({ message: "Seite nicht gefunden" });
    res.json(page);
  });

  app.get("/api/settings/hero", (_req, res) => {
    res.json(getHeroSettings());
  });

  // Stabiler Datei-Link: /dateien/<slug> liefert immer die aktuell hinterlegte
  // Datei aus. Beim Austauschen der Datei bleibt der Link unverändert gültig.
  app.get("/dateien/:slug", (req, res) => {
    const doc = storage.getDocumentBySlug(String(req.params.slug));
    if (!doc) return res.status(404).json({ message: "Datei nicht gefunden" });
    const fp = path.join(DOC_DIR, doc.filename);
    if (!fp.startsWith(DOC_DIR) || !fs.existsSync(fp)) {
      return res.status(404).json({ message: "Datei nicht gefunden" });
    }
    // Nicht cachen: hinter dem Link kann jederzeit eine neue Version liegen
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", doc.mimeType);
    // PDFs und Bilder direkt im Browser anzeigen, alles andere herunterladen
    const inline = doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/");
    const asciiName = (doc.originalName || doc.filename).normalize("NFKD").replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
    res.setHeader(
      "Content-Disposition",
      `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(doc.originalName || doc.filename)}`
    );
    res.sendFile(fp);
  });

  app.get("/api/stats", (_req, res) => {
    const allPosts = storage.listPosts({ status: "published" });
    const einsatzIds = new Set(storage.listCategories().filter((c) => c.isEinsatz).map((c) => c.id));
    const einsaetze = allPosts.filter((p) => einsatzIds.has(p.categoryId));
    const thisYear = new Date().getFullYear().toString();
    res.json({
      einsaetzeGesamt: einsaetze.length,
      einsaetzeJahr: einsaetze.filter((p) => p.publishedAt.startsWith(thisYear)).length,
      fahrzeuge: storage.listVehicles().length,
      aktive: storage.listMembers().filter((m) => m.gruppe === "aktive").length,
    });
  });

  // ---------- ADMIN: Beiträge ----------
  app.get("/api/admin/posts", requireAuth, (req, res) => {
    const all = storage.listPosts({});
    const visible = all.filter((p) =>
      hasPermission(req.currentUser!, postArea(p.categoryId))
    );
    res.json(visible.map(({ content, ...rest }) => ({ ...rest, content: "" })));
  });

  app.get("/api/admin/posts/:id", requireAuth, (req, res) => {
    const post = storage.getPost(Number(req.params.id));
    if (!post) return res.status(404).json({ message: "Nicht gefunden" });
    if (!hasPermission(req.currentUser!, postArea(post.categoryId))) {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }
    res.json(post);
  });

  app.post("/api/admin/posts", requireAuth, (req, res) => {
    const parsed = insertPostSchema.omit({ slug: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Ungültige Daten" });
    if (!hasPermission(req.currentUser!, postArea(parsed.data.categoryId))) {
      return res.status(403).json({ message: "Keine Berechtigung für diese Kategorie" });
    }
    const slug = uniquePostSlug(slugify(parsed.data.title));
    const post = storage.createPost({
      ...parsed.data,
      slug,
      authorName: parsed.data.authorName || req.currentUser!.displayName,
    });
    res.json(post);
  });

  app.patch("/api/admin/posts/:id", requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const existing = storage.getPost(id);
    if (!existing) return res.status(404).json({ message: "Nicht gefunden" });
    if (!hasPermission(req.currentUser!, postArea(existing.categoryId))) {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }
    // Slug bleibt stabil (eindeutig, in Links verwendet) – wird beim Bearbeiten nie geändert
    const parsed = insertPostSchema.omit({ slug: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    if (parsed.data.categoryId && !hasPermission(req.currentUser!, postArea(parsed.data.categoryId))) {
      return res.status(403).json({ message: "Keine Berechtigung für die Ziel-Kategorie" });
    }
    const post = storage.updatePost(id, parsed.data);
    res.json(post);
  });

  app.delete("/api/admin/posts/:id", requireAuth, (req, res) => {
    const existing = storage.getPost(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Nicht gefunden" });
    if (!hasPermission(req.currentUser!, postArea(existing.categoryId))) {
      return res.status(403).json({ message: "Keine Berechtigung" });
    }
    storage.deletePost(existing.id);
    res.json({ ok: true });
  });

  // ---------- ADMIN: Termine ----------
  app.post("/api/admin/events", requireAuth, requirePermission("termine"), (req, res) => {
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.createEvent(parsed.data));
  });
  app.patch("/api/admin/events/:id", requireAuth, requirePermission("termine"), (req, res) => {
    const parsed = insertEventSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.updateEvent(Number(req.params.id), parsed.data));
  });
  app.delete("/api/admin/events/:id", requireAuth, requirePermission("termine"), (req, res) => {
    storage.deleteEvent(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- ADMIN: Fahrzeuge ----------
  app.post("/api/admin/vehicles", requireAuth, requirePermission("fahrzeuge"), (req, res) => {
    const parsed = insertVehicleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.createVehicle(parsed.data));
  });
  app.patch("/api/admin/vehicles/:id", requireAuth, requirePermission("fahrzeuge"), (req, res) => {
    const parsed = insertVehicleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.updateVehicle(Number(req.params.id), parsed.data));
  });
  app.delete("/api/admin/vehicles/:id", requireAuth, requirePermission("fahrzeuge"), (req, res) => {
    storage.deleteVehicle(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- ADMIN: Mitglieder ----------
  app.post("/api/admin/members", requireAuth, requirePermission("mitglieder"), (req, res) => {
    const parsed = insertMemberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.createMember(parsed.data));
  });
  app.patch("/api/admin/members/:id", requireAuth, requirePermission("mitglieder"), (req, res) => {
    const parsed = insertMemberSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.updateMember(Number(req.params.id), parsed.data));
  });
  app.delete("/api/admin/members/:id", requireAuth, requirePermission("mitglieder"), (req, res) => {
    storage.deleteMember(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- ADMIN: Seiten ----------
  app.get("/api/admin/pages", requireAuth, requirePermission("seiten"), (_req, res) => {
    res.json(storage.listPages());
  });
  app.patch("/api/admin/pages/:id", requireAuth, requirePermission("seiten"), (req, res) => {
    // Slug bleibt stabil – die Website verlinkt Seiten fest über ihren Slug
    const parsed = insertPageSchema.omit({ slug: true }).partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    res.json(storage.updatePage(Number(req.params.id), { ...parsed.data, updatedAt: new Date().toISOString() }));
  });

  // ---------- ADMIN: Startseite / Hero ----------
  app.put("/api/admin/settings/hero", requireAuth, requirePermission("seiten"), (req, res) => {
    const parsed = heroSettingsSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Ungültige Daten" });
    const merged: HeroSettings = { ...getHeroSettings(), ...parsed.data };
    storage.setSetting("hero", JSON.stringify(merged));
    res.json(merged);
  });

  // ---------- ADMIN: Medien ----------
  app.get("/api/admin/media", requireAuth, (_req, res) => {
    res.json(storage.listMedia());
  });

  app.post("/api/admin/media", requireAuth, upload.array("files", 20), async (req, res) => {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ message: "Keine Bilder hochgeladen (JPG, PNG, GIF, WebP, max. 30 MB)" });
    // Validieren (muss ein echtes Bild sein) und automatisch fürs Web optimieren:
    // verkleinern (max. 1600 px), als WebP neu kodieren, Metadaten/GPS entfernen.
    const validFiles: Express.Multer.File[] = [];
    for (const f of files) {
      try {
        await optimizeImage(f);
        validFiles.push(f);
      } catch {
        // Ungültige Datei löschen statt behalten
        try { fs.unlinkSync(f.path); } catch { /* ignore */ }
      }
    }
    if (!validFiles.length) {
      return res.status(400).json({ message: "Die Datei(en) konnten nicht als Bild verarbeitet werden." });
    }
    const created = validFiles.map((f) =>
      storage.createMedia({
        filename: f.filename,
        url: `/uploads/neu/${f.filename}`,
        title: f.originalname,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.currentUser!.displayName,
      })
    );
    res.json(created);
  });

  app.delete("/api/admin/media/:id", requireAuth, requirePermission("medien"), (req, res) => {
    const item = storage.getMedia(Number(req.params.id));
    if (item) {
      const fp = path.join(process.cwd(), item.url.replace(/^\//, ""));
      if (fp.startsWith(UPLOAD_DIR) && fs.existsSync(fp)) fs.unlinkSync(fp);
      storage.deleteMedia(item.id);
    }
    res.json({ ok: true });
  });

  // ---------- ADMIN: Dateien / Downloads ----------
  // Alle angemeldeten Benutzer sehen die Liste (um Links kopieren zu können),
  // Anlegen/Austauschen/Löschen erfordert die Berechtigung "dateien".
  app.get("/api/admin/documents", requireAuth, (_req, res) => {
    res.json(storage.listDocuments());
  });

  app.post("/api/admin/documents", requireAuth, requirePermission("dateien"), docUpload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: `Keine gültige Datei hochgeladen (erlaubt: ${DOCUMENT_EXTENSIONS}, max. 25 MB)` });
    }
    const title = String(req.body?.title ?? "").trim() || file.originalname.replace(/\.[a-z0-9]+$/i, "");
    const slug = uniqueDocumentSlug(slugify(title));
    const doc = storage.createDocument({
      slug,
      title,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: DOCUMENT_TYPES[path.extname(file.originalname).toLowerCase()] ?? "application/octet-stream",
      size: file.size,
      updatedAt: new Date().toISOString(),
      updatedBy: req.currentUser!.displayName,
    });
    res.json(doc);
  });

  // Austauschen der Datei und/oder Umbenennen – der Slug (und damit der Link) bleibt stabil
  app.patch("/api/admin/documents/:id", requireAuth, requirePermission("dateien"), docUpload.single("file"), (req, res) => {
    const existing = storage.getDocument(Number(req.params.id));
    if (!existing) {
      if (req.file) deleteDocumentFile(req.file.filename);
      return res.status(404).json({ message: "Nicht gefunden" });
    }
    const update: Record<string, unknown> = {};
    const title = String(req.body?.title ?? "").trim();
    if (title) update.title = title;
    if (req.file) {
      deleteDocumentFile(existing.filename);
      update.filename = req.file.filename;
      update.originalName = req.file.originalname;
      update.mimeType = DOCUMENT_TYPES[path.extname(req.file.originalname).toLowerCase()] ?? "application/octet-stream";
      update.size = req.file.size;
    }
    update.updatedAt = new Date().toISOString();
    update.updatedBy = req.currentUser!.displayName;
    res.json(storage.updateDocument(existing.id, update as any));
  });

  app.delete("/api/admin/documents/:id", requireAuth, requirePermission("dateien"), (req, res) => {
    const existing = storage.getDocument(Number(req.params.id));
    if (existing) {
      deleteDocumentFile(existing.filename);
      storage.deleteDocument(existing.id);
    }
    res.json({ ok: true });
  });

  // ---------- ADMIN: Benutzerverwaltung (nur Admin) ----------
  app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
    res.json(storage.listUsers().map((u) => safeUser(u as any)));
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, (req, res) => {
    const body = req.body ?? {};
    if (!body.username || !body.password || !body.displayName) {
      return res.status(400).json({ message: "Benutzername, Passwort und Anzeigename erforderlich" });
    }
    if (String(body.password).length < 8) {
      return res.status(400).json({ message: "Passwort muss mindestens 8 Zeichen haben" });
    }
    if (storage.getUserByUsername(String(body.username).toLowerCase().trim())) {
      return res.status(400).json({ message: "Benutzername bereits vergeben" });
    }
    const perms = Array.isArray(body.permissions)
      ? body.permissions.filter((p: string) => (PERMISSION_AREAS as readonly string[]).includes(p))
      : [];
    const user = storage.createUser({
      username: String(body.username).toLowerCase().trim(),
      password: hashPassword(String(body.password)),
      displayName: String(body.displayName),
      role: body.role === "admin" ? "admin" : "editor",
      permissions: JSON.stringify(perms),
      active: 1,
    });
    res.json(safeUser(user as any));
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const existing = storage.getUser(id);
    if (!existing) return res.status(404).json({ message: "Nicht gefunden" });
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.displayName) update.displayName = String(body.displayName);
    if (body.role) update.role = body.role === "admin" ? "admin" : "editor";
    if (typeof body.active === "number") update.active = body.active ? 1 : 0;
    if (Array.isArray(body.permissions)) {
      update.permissions = JSON.stringify(
        body.permissions.filter((p: string) => (PERMISSION_AREAS as readonly string[]).includes(p))
      );
    }
    if (body.password) {
      if (String(body.password).length < 8) return res.status(400).json({ message: "Passwort muss mindestens 8 Zeichen haben" });
      update.password = hashPassword(String(body.password));
    }
    // Sicherheitsnetz: letzten aktiven Admin nicht degradieren/deaktivieren
    if (existing.role === "admin" && (update.role === "editor" || update.active === 0)) {
      const admins = storage.listUsers().filter((u) => u.role === "admin" && u.active && u.id !== id);
      if (!admins.length) return res.status(400).json({ message: "Der letzte Administrator kann nicht deaktiviert werden" });
    }
    res.json(safeUser(storage.updateUser(id, update as any) as any));
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const existing = storage.getUser(id);
    if (!existing) return res.status(404).json({ message: "Nicht gefunden" });
    if (existing.role === "admin") {
      const admins = storage.listUsers().filter((u) => u.role === "admin" && u.active && u.id !== id);
      if (!admins.length) return res.status(400).json({ message: "Der letzte Administrator kann nicht gelöscht werden" });
    }
    storage.deleteUser(id);
    res.json({ ok: true });
  });

  return httpServer;
}
