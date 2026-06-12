import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { SafeUser, PermissionArea } from "@shared/schema";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function safeUser(u: { password: string } & SafeUser & { password: string }): SafeUser {
  const { password, ...rest } = u as any;
  return rest;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: SafeUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Nicht angemeldet" });
  const t = storage.getToken(token);
  if (!t) return res.status(401).json({ message: "Sitzung abgelaufen" });
  const user = storage.getUser(t.userId);
  if (!user || !user.active) return res.status(401).json({ message: "Benutzer inaktiv" });
  req.currentUser = safeUser(user as any);
  next();
}

export function hasPermission(user: SafeUser, area: PermissionArea): boolean {
  if (user.role === "admin") return true;
  try {
    const perms = JSON.parse(user.permissions) as string[];
    return perms.includes(area);
  } catch {
    return false;
  }
}

export function requirePermission(area: PermissionArea) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) return res.status(401).json({ message: "Nicht angemeldet" });
    if (!hasPermission(req.currentUser, area)) {
      return res.status(403).json({ message: "Keine Berechtigung für diesen Bereich" });
    }
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) return res.status(401).json({ message: "Nicht angemeldet" });
  if (req.currentUser.role !== "admin") {
    return res.status(403).json({ message: "Nur für Administratoren" });
  }
  next();
}
