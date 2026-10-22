/**
 * @file Zusammenbau der Anwendung ("Composition Root").
 *
 * Hier und NUR hier werden alle Module erzeugt und miteinander verbunden:
 *
 *   Datenbank → Repository → Service → Routen → Express-App
 *                               ↓
 *                          Ereignis-Bus → SSE-Hub (Live-Updates)
 *
 * Neues Modul hinzufügen (Beispiel "Statistik"):
 *   1. `src/services/statsService.js` erstellen.
 *   2. `src/routes/statsRoutes.js` erstellen.
 *   3. Beides hier erzeugen und mit `app.use('/api/stats', ...)` einhängen.
 * Bestehende Dateien müssen dafür nicht angepasst werden.
 */

'use strict';

const path = require('node:path');
const express = require('express');

const { openDatabase } = require('./db/database');
const { createGroupRepository } = require('./repositories/groupRepository');
const { createEventBus } = require('./services/eventBus');
const { createGroupService } = require('./services/groupService');
const { createSseHub } = require('./realtime/sseHub');
const { requirePin } = require('./middleware/requirePin');
const { errorHandler, apiNotFound } = require('./middleware/errorHandler');
const { createGroupRoutes } = require('./routes/groupRoutes');
const { createSystemRoutes } = require('./routes/systemRoutes');

/** Ordner mit den statischen Frontend-Dateien (HTML, CSS, JS). */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

/**
 * Erstellt die komplette Anwendung.
 *
 * @param {typeof import('./config')} config Konfiguration (in Tests anpassbar,
 *        z. B. mit `dbFile: ':memory:'`).
 * @returns {{
 *   app: import('express').Express,
 *   groupService: ReturnType<typeof createGroupService>,
 *   shutdown: () => void
 * }} Die Express-App, der Service (für Tests) und eine Funktion zum sauberen Beenden.
 */
function createApp(config) {
  // --- Daten & Logik ---------------------------------------------------------
  const db = openDatabase({ dataDir: config.dataDir, dbFile: config.dbFile });
  const repo = createGroupRepository(db);
  const eventBus = createEventBus();
  const groupService = createGroupService({ db, repo, eventBus, config });

  // --- Live-Updates ----------------------------------------------------------
  const sseHub = createSseHub({
    eventBus,
    getSnapshot: () => groupService.getSnapshot(),
    heartbeatMs: config.heartbeatMs,
  });

  // --- HTTP ------------------------------------------------------------------
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  // API
  app.use('/api', createSystemRoutes({ config, sseHub }));
  app.use('/api/groups', createGroupRoutes({ groupService, requirePin: requirePin(config.adminPin) }));
  app.use('/api', apiNotFound);

  // Frontend: Kurze URLs ohne ".html" (z. B. /rangliste statt /rangliste.html)
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

  // Fehlerbehandlung immer zuletzt
  app.use(errorHandler);

  /**
   * Schliesst Live-Verbindungen und Datenbank.
   * @returns {void}
   */
  function shutdown() {
    sseHub.close();
    db.close();
  }

  return { app, groupService, shutdown };
}

module.exports = { createApp };
