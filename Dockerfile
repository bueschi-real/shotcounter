# =============================================================================
# Docker-Image für die Rangliste
# -----------------------------------------------------------------------------
# Basis: offizielles Node.js-Image auf Alpine Linux (klein, ca. 60 MB).
# Läuft auf Intel/AMD (amd64) und ARM (arm64), es sind keine nativen
# Zusatzmodule nötig, weil SQLite in Node.js eingebaut ist (node:sqlite).
# =============================================================================
FROM node:24-alpine

# Produktionsmodus: Express arbeitet schneller und gibt weniger Details aus
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

# 1) Zuerst nur die Abhängigkeiten installieren. Docker merkt sich diesen
#    Schritt (Cache), solange sich package*.json nicht ändert -> schnellere Builds.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Danach den eigentlichen Programmcode kopieren
COPY server.js ./
COPY src ./src
COPY public ./public

# Ordner für die Datenbank (wird per Volume von aussen eingebunden)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# Docker prüft regelmässig, ob die Anwendung antwortet (Status "healthy")
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["npm", "start"]
