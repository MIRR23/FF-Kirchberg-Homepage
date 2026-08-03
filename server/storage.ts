import {
  users, authTokens, categories, posts, events, vehicles, members, pages, media, documents, settings,
} from "@shared/schema";
import type {
  User, InsertUser, Category, InsertCategory, Post, InsertPost,
  Event, InsertEvent, Vehicle, InsertVehicle, Member, InsertMember,
  Page, InsertPage, MediaItem, InsertMedia, InsertDocument,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, asc, and, like, lt } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Tabellen anlegen (idempotent)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  permissions TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'red',
  is_einsatz INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  category_id INTEGER NOT NULL,
  published_at TEXT NOT NULL,
  featured_image TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  author_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published',
  stichwort TEXT,
  ort TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'veranstaltung'
);
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  funktion TEXT NOT NULL DEFAULT '',
  gruppe TEXT NOT NULL DEFAULT 'aktive',
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL DEFAULT '',
  uploaded_by TEXT NOT NULL DEFAULT ''
);
`);

export class DatabaseStorage {
  // --- Users ---
  getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  listUsers() {
    return db.select().from(users).orderBy(asc(users.username)).all();
  }
  createUser(u: InsertUser) {
    return db.insert(users).values(u).returning().get();
  }
  updateUser(id: number, u: Partial<InsertUser>) {
    return db.update(users).set(u).where(eq(users.id, id)).returning().get();
  }
  deleteUser(id: number) {
    db.delete(authTokens).where(eq(authTokens.userId, id)).run();
    return db.delete(users).where(eq(users.id, id)).run();
  }
  countUsers() {
    return db.select().from(users).all().length;
  }

  // --- Tokens ---
  createToken(token: string, userId: number) {
    return db.insert(authTokens).values({ token, userId, createdAt: new Date().toISOString() }).returning().get();
  }
  getToken(token: string) {
    return db.select().from(authTokens).where(eq(authTokens.token, token)).get();
  }
  deleteToken(token: string) {
    return db.delete(authTokens).where(eq(authTokens.token, token)).run();
  }
  /** Entfernt alle Tokens, die vor dem Stichtag erstellt wurden (abgelaufene Sitzungen). */
  deleteTokensCreatedBefore(cutoffIso: string) {
    return db.delete(authTokens).where(lt(authTokens.createdAt, cutoffIso)).run();
  }

  // --- Categories ---
  listCategories() {
    return db.select().from(categories).orderBy(asc(categories.name)).all();
  }
  getCategory(id: number) {
    return db.select().from(categories).where(eq(categories.id, id)).get();
  }
  getCategoryBySlug(slug: string) {
    return db.select().from(categories).where(eq(categories.slug, slug)).get();
  }
  createCategory(c: InsertCategory) {
    return db.insert(categories).values(c).returning().get();
  }

  // --- Posts ---
  listPosts(opts: { categoryId?: number; status?: string; year?: string } = {}) {
    const conds = [];
    if (opts.categoryId) conds.push(eq(posts.categoryId, opts.categoryId));
    if (opts.status) conds.push(eq(posts.status, opts.status));
    if (opts.year) conds.push(like(posts.publishedAt, `${opts.year}-%`));
    const q = conds.length
      ? db.select().from(posts).where(and(...conds))
      : db.select().from(posts);
    return q.orderBy(desc(posts.publishedAt)).all();
  }
  getPost(id: number) {
    return db.select().from(posts).where(eq(posts.id, id)).get();
  }
  getPostBySlug(slug: string) {
    return db.select().from(posts).where(eq(posts.slug, slug)).get();
  }
  createPost(p: InsertPost) {
    return db.insert(posts).values(p).returning().get();
  }
  updatePost(id: number, p: Partial<InsertPost>) {
    return db.update(posts).set(p).where(eq(posts.id, id)).returning().get();
  }
  deletePost(id: number) {
    return db.delete(posts).where(eq(posts.id, id)).run();
  }

  // --- Events ---
  listEvents() {
    return db.select().from(events).orderBy(asc(events.date)).all();
  }
  getEvent(id: number) {
    return db.select().from(events).where(eq(events.id, id)).get();
  }
  createEvent(e: InsertEvent) {
    return db.insert(events).values(e).returning().get();
  }
  updateEvent(id: number, e: Partial<InsertEvent>) {
    return db.update(events).set(e).where(eq(events.id, id)).returning().get();
  }
  deleteEvent(id: number) {
    return db.delete(events).where(eq(events.id, id)).run();
  }

  // --- Vehicles ---
  listVehicles() {
    return db.select().from(vehicles).orderBy(asc(vehicles.sortOrder)).all();
  }
  getVehicle(id: number) {
    return db.select().from(vehicles).where(eq(vehicles.id, id)).get();
  }
  createVehicle(v: InsertVehicle) {
    return db.insert(vehicles).values(v).returning().get();
  }
  updateVehicle(id: number, v: Partial<InsertVehicle>) {
    return db.update(vehicles).set(v).where(eq(vehicles.id, id)).returning().get();
  }
  deleteVehicle(id: number) {
    return db.delete(vehicles).where(eq(vehicles.id, id)).run();
  }

  // --- Members ---
  listMembers() {
    return db.select().from(members).orderBy(asc(members.sortOrder), asc(members.name)).all();
  }
  getMember(id: number) {
    return db.select().from(members).where(eq(members.id, id)).get();
  }
  createMember(m: InsertMember) {
    return db.insert(members).values(m).returning().get();
  }
  updateMember(id: number, m: Partial<InsertMember>) {
    return db.update(members).set(m).where(eq(members.id, id)).returning().get();
  }
  deleteMember(id: number) {
    return db.delete(members).where(eq(members.id, id)).run();
  }

  // --- Pages ---
  listPages() {
    return db.select().from(pages).orderBy(asc(pages.title)).all();
  }
  getPageBySlug(slug: string) {
    return db.select().from(pages).where(eq(pages.slug, slug)).get();
  }
  getPage(id: number) {
    return db.select().from(pages).where(eq(pages.id, id)).get();
  }
  createPage(p: InsertPage) {
    return db.insert(pages).values(p).returning().get();
  }
  updatePage(id: number, p: Partial<InsertPage>) {
    return db.update(pages).set(p).where(eq(pages.id, id)).returning().get();
  }

  // --- Media ---
  listMedia() {
    return db.select().from(media).orderBy(desc(media.id)).all();
  }
  createMedia(m: InsertMedia) {
    return db.insert(media).values(m).returning().get();
  }
  deleteMedia(id: number) {
    return db.delete(media).where(eq(media.id, id)).run();
  }
  getMedia(id: number) {
    return db.select().from(media).where(eq(media.id, id)).get();
  }

  // --- Dokumente (Dateien mit stabilem Link) ---
  listDocuments() {
    return db.select().from(documents).orderBy(asc(documents.title)).all();
  }
  getDocument(id: number) {
    return db.select().from(documents).where(eq(documents.id, id)).get();
  }
  getDocumentBySlug(slug: string) {
    return db.select().from(documents).where(eq(documents.slug, slug)).get();
  }
  createDocument(d: InsertDocument) {
    return db.insert(documents).values(d).returning().get();
  }
  updateDocument(id: number, d: Partial<InsertDocument>) {
    return db.update(documents).set(d).where(eq(documents.id, id)).returning().get();
  }
  deleteDocument(id: number) {
    return db.delete(documents).where(eq(documents.id, id)).run();
  }

  // --- Settings (Schlüssel/Wert) ---
  getSetting(key: string) {
    return db.select().from(settings).where(eq(settings.key, key)).get();
  }
  setSetting(key: string, value: string) {
    return db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .returning()
      .get();
  }
}

export const storage = new DatabaseStorage();
