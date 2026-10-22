/**
 * @file Eigene Fehlerklassen.
 *
 * Fachliche Fehler werden als `HttpError` geworfen. Der zentrale
 * Fehler-Handler (`middleware/errorHandler.js`) wandelt sie automatisch in
 * eine passende HTTP-Antwort um. So muss keine Route selbst Statuscodes setzen.
 */

'use strict';

/**
 * Fehler mit zugehörigem HTTP-Statuscode und Meldung für den Benutzer.
 */
class HttpError extends Error {
  /**
   * @param {number} status   HTTP-Statuscode (z. B. 400, 404).
   * @param {string} message  Verständliche Meldung, wird im Frontend angezeigt.
   * @param {string} [code]   Maschinenlesbarer Fehlercode (z. B. "NOT_FOUND").
   */
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Erzeugt einen Fehler für ungültige Eingaben (HTTP 400).
 *
 * @param {string} message Beschreibung, was an der Eingabe falsch ist.
 * @returns {HttpError}
 */
function badRequest(message) {
  return new HttpError(400, message, 'VALIDATION_ERROR');
}

/**
 * Erzeugt einen Fehler für nicht gefundene Ressourcen (HTTP 404).
 *
 * @param {string} message Beschreibung, was nicht gefunden wurde.
 * @returns {HttpError}
 */
function notFound(message) {
  return new HttpError(404, message, 'NOT_FOUND');
}

/**
 * Erzeugt einen Fehler für Konflikte, z. B. doppelte Namen (HTTP 409).
 *
 * @param {string} message Beschreibung des Konflikts.
 * @returns {HttpError}
 */
function conflict(message) {
  return new HttpError(409, message, 'CONFLICT');
}

/**
 * Erzeugt einen Fehler für fehlende Berechtigung (HTTP 401).
 *
 * @param {string} [message] Optionale Meldung.
 * @returns {HttpError}
 */
function unauthorized(message = 'PIN fehlt oder ist falsch.') {
  return new HttpError(401, message, 'UNAUTHORIZED');
}

module.exports = { HttpError, badRequest, notFound, conflict, unauthorized };
