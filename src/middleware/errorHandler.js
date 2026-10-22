/**
 * @file Zentrale Fehlerbehandlung.
 *
 * Alle Fehler aus Routen und Services landen hier. Bekannte Fehler
 * (`HttpError`) werden mit ihrer Meldung an das Frontend geschickt, unbekannte
 * Fehler werden protokolliert und als allgemeiner Serverfehler beantwortet,
 * ohne interne Details preiszugeben.
 *
 * Antwortformat für alle Fehler: `{ "error": { "code": "...", "message": "..." } }`
 */

'use strict';

const { HttpError } = require('../utils/errors');

/**
 * Antwortet auf unbekannte API-Pfade mit 404 im JSON-Format.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void}
 */
function apiNotFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Unbekannter API-Pfad: ${req.method} ${req.originalUrl}` },
  });
}

/**
 * Express-Fehler-Middleware (erkennbar an den vier Parametern).
 *
 * @param {unknown} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 * @returns {void}
 */
function errorHandler(err, req, res, _next) {
  // Ungültiges JSON im Request-Body (von express.json() erkannt)
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Ungültige Anfrage (JSON).' } });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  console.error(`[fehler] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Unerwarteter Fehler auf dem Server.' },
  });
}

module.exports = { errorHandler, apiNotFound };
