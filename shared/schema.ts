import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ----- Benutzer -----
export const PERMISSION_AREAS = [
  "einsaetze",
  "neuigkeiten",
  "termine",
  "fahrzeuge",
  "mitglieder",
  "seiten",
  "medien",
] as const;
export type PermissionArea = (typeof PERMISSION_AREAS)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // scrypt hash
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("editor"), // 'admin' | 'editor'
  permissions: text("permissions").notNull().default("[]"), // JSON array of PermissionArea
  active: integer("active").notNull().default(1),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const authTokens = sqliteTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export type AuthToken = typeof authTokens.$inferSelect;

// ----- Kategorien -----
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("red"), // red | amber | blue | green | gray
  isEinsatz: integer("is_einsatz").notNull().default(0),
});
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// ----- Beiträge (Neuigkeiten + Einsätze) -----
export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default(""), // HTML
  excerpt: text("excerpt").notNull().default(""),
  categoryId: integer("category_id").notNull(),
  publishedAt: text("published_at").notNull(), // ISO datetime
  featuredImage: text("featured_image"), // url path
  images: text("images").notNull().default("[]"), // JSON array of url paths
  authorName: text("author_name").notNull().default(""),
  status: text("status").notNull().default("published"), // 'published' | 'draft'
  stichwort: text("stichwort"), // z.B. "Brand B1", "THL 2" (nur Einsätze)
  ort: text("ort"), // Einsatzort
});
export const insertPostSchema = createInsertSchema(posts).omit({ id: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof posts.$inferSelect;

// ----- Termine / Veranstaltungen -----
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  date: text("date").notNull(), // ISO date
  time: text("time").notNull().default(""), // z.B. "19:30"
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull().default("veranstaltung"), // 'veranstaltung' | 'uebung'
});
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// ----- Fahrzeuge -----
export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // "LF 10/6"
  type: text("type").notNull().default(""), // "Löschgruppenfahrzeug"
  description: text("description").notNull().default(""), // HTML
  image: text("image"),
  images: text("images").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
});
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// ----- Mitglieder (Vorstandschaft / Aktive) -----
export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  funktion: text("funktion").notNull().default(""), // z.B. "1. Kommandant"
  gruppe: text("gruppe").notNull().default("aktive"), // 'vorstandschaft' | 'aktive'
  image: text("image"),
  sortOrder: integer("sort_order").notNull().default(0),
});
export const insertMemberSchema = createInsertSchema(members).omit({ id: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof members.$inferSelect;

// ----- Statische Seiten (Texte) -----
export const pages = sqliteTable("pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(), // 'ueber-uns', 'chronik', 'impressum', ...
  title: text("title").notNull(),
  content: text("content").notNull().default(""), // HTML
  updatedAt: text("updated_at").notNull().default(""),
});
export const insertPageSchema = createInsertSchema(pages).omit({ id: true });
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;

// ----- Medien -----
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  url: text("url").notNull(), // /uploads/...
  title: text("title").notNull().default(""),
  uploadedAt: text("uploaded_at").notNull().default(""),
  uploadedBy: text("uploaded_by").notNull().default(""),
});
export const insertMediaSchema = createInsertSchema(media).omit({ id: true });
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type MediaItem = typeof media.$inferSelect;

// ----- API-Hilfstypen -----
export type SafeUser = Omit<User, "password">;
export type PostWithCategory = Post & { category: Category | null };
