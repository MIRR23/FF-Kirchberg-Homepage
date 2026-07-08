import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import compression from "compression";
import { MulterError } from "multer";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { storage } from "./storage";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Antworten komprimieren (HTML/JS/CSS/JSON) – deutlich schnellere Ladezeiten,
// falls kein Reverse-Proxy davor bereits komprimiert.
app.use(compression());

app.use(
  express.json({
    // Standard wären 100 kB – lange Seiten (z. B. Chronik) brauchen mehr Spielraum
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Auto-Migration: Ist die Datenbank leer (z. B. frischer Vorschau-Server ohne
  // dauerhaften Speicher), werden Inhalte automatisch aus migration-data/ erzeugt.
  // Standardmäßig aktiv; mit AUTO_MIGRATE=0 abschaltbar. Bestehende Daten bleiben
  // unangetastet, da nur bei komplett leerer Datenbank migriert wird.
  if (process.env.AUTO_MIGRATE !== "0" && storage.countUsers() === 0) {
    try {
      log("Datenbank leer – starte automatische Migration …", "migrate");
      const { runMigration } = await import("./migrate");
      await runMigration();
      log("Automatische Migration abgeschlossen.", "migrate");
    } catch (err) {
      console.error("Automatische Migration fehlgeschlagen:", err);
    }
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // Upload-Fehler verständlich auf Deutsch melden statt als Serverfehler
    if (err instanceof MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Eine Datei ist zu groß (max. 15 MB pro Bild)."
          : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
            ? "Zu viele Dateien auf einmal (max. 20 Bilder pro Upload)."
            : "Der Upload konnte nicht verarbeitet werden.";
      return res.status(400).json({ message });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ message: "Der Inhalt ist zu groß zum Speichern." });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
