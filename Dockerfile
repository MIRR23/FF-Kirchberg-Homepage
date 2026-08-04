# Mehrstufiger Build der FF-Kirchberg-Homepage.
# Für Selbst-Hosting (Docker/Container-Hosting, z. B. Timme Hosting ISPConfig)
# oder als Alternative zum Render-Native-Deploy.
#
#   docker build -t ff-kirchberg .
#   docker run -p 5000:5000 -v ffk-data:/app/data ff-kirchberg
#
# Alle veränderlichen Daten (Datenbank + Uploads) liegen unter /app/data –
# dieses Verzeichnis als Volume mounten, damit Inhalte Updates überleben.
# (Siehe docker-compose.yml für eine fertige Variante inkl. dauerhaftem Speicher.)

# ---------- Build-Stufe ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# ---------- Laufzeit-Stufe ----------
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000
ENV AUTO_MIGRATE=1
# Veränderliche Daten (Datenbank + Uploads) getrennt vom App-Code -> als Volume mounten
ENV DATA_DIR=/app/data

# Nur Produktionsabhängigkeiten (sharp, better-sqlite3, express … sind hier dabei)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Gebaute App + zur Auto-Migration benötigte Inhalte
COPY --from=build /app/dist ./dist
COPY migration-data ./migration-data
COPY uploads ./uploads

EXPOSE 5000
CMD ["node", "dist/index.cjs"]
