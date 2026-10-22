/**
 * @file System-Endpunkte: Konfiguration, PIN-Prüfung, Live-Verbindung, Status.
 *
 * | Methode | Pfad              | Zweck                                         |
 * |---------|-------------------|-----------------------------------------------|
 * | GET     | /api/config       | Öffentliche Einstellungen fürs Frontend       |
 * | POST    | /api/auth/check   | PIN prüfen (Header X-Admin-Pin)               |
 * | GET     | /api/events       | Live-Verbindung (Server-Sent Events)          |
 * | GET     | /api/health       | Status für Docker-Healthcheck                 |
 */

'use strict';

const express = require('express');
const { isPinValid, PIN_HEADER } = require('../middleware/requirePin');
const { unauthorized } = require('../utils/errors');

/**
 * Erstellt den Router für System-Endpunkte.
 *
 * @param {object} deps
 * @param {typeof import('../config')} deps.config
 * @param {ReturnType<import('../realtime/sseHub').createSseHub>} deps.sseHub
 * @returns {import('express').Router}
 */
function createSystemRoutes({ config, sseHub }) {
  const router = express.Router();

  /**
   * Einstellungen, die das Frontend kennen muss.
   * Achtung: Hier nie die PIN selbst ausgeben!
   */
  router.get('/config', (_req, res) => {
    res.json({
      appTitle: config.appTitle,
      pinRequired: Boolean(config.adminPin),
      maxNameLength: config.maxNameLength,
      maxPointsPerBooking: config.maxPointsPerBooking,
    });
  });

  /** Prüft eine PIN, ohne etwas zu ändern (für den PIN-Dialog im Frontend). */
  router.post('/auth/check', (req, res) => {
    if (!isPinValid(config.adminPin, req.get(PIN_HEADER))) throw unauthorized();
    res.json({ ok: true });
  });

  /** Live-Verbindung für automatische Aktualisierung. */
  router.get('/events', (req, res) => sseHub.handleConnection(req, res));

  /** Einfacher Status, wird vom Docker-Healthcheck abgefragt. */
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', liveClients: sseHub.clientCount(), uptimeSeconds: Math.round(process.uptime()) });
  });

  return router;
}

module.exports = { createSystemRoutes };
