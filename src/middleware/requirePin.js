/**
 * @file Einfacher PIN-Schutz für schreibende Aktionen.
 *
 * Das Frontend schickt die PIN im HTTP-Header `X-Admin-Pin` mit. Ist in der
 * Konfiguration keine PIN gesetzt (`ADMIN_PIN` leer), ist der Schutz aus.
 *
 * Hinweis: Das ist ein Schutz gegen versehentliche oder neugierige Zugriffe
 * im lokalen Netz, keine starke Authentifizierung. Die Anwendung soll
 * deshalb nicht aus dem Internet erreichbar sein.
 */

'use strict';

const crypto = require('node:crypto');
const { unauthorized } = require('../utils/errors');

/** Name des HTTP-Headers, in dem die PIN übertragen wird. */
const PIN_HEADER = 'x-admin-pin';

/**
 * Vergleicht zwei Zeichenketten in konstanter Zeit, damit die PIN nicht über
 * Antwortzeiten erraten werden kann.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean} `true`, wenn beide identisch sind.
 */
function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Prüft, ob eine übergebene PIN korrekt ist.
 *
 * @param {string} configuredPin  PIN aus der Konfiguration ('' = kein Schutz).
 * @param {unknown} providedPin   Vom Client gesendete PIN.
 * @returns {boolean}
 */
function isPinValid(configuredPin, providedPin) {
  if (!configuredPin) return true;
  return typeof providedPin === 'string' && safeEqual(configuredPin, providedPin);
}

/**
 * Erstellt eine Express-Middleware, die nur Anfragen mit gültiger PIN durchlässt.
 *
 * @param {string} configuredPin PIN aus der Konfiguration.
 * @returns {import('express').RequestHandler}
 */
function requirePin(configuredPin) {
  return function requirePinMiddleware(req, _res, next) {
    if (isPinValid(configuredPin, req.get(PIN_HEADER))) return next();
    next(unauthorized());
  };
}

module.exports = { requirePin, isPinValid, PIN_HEADER };
