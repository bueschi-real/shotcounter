/**
 * @file Zentrale Konfiguration der Anwendung.
 *
 * Alle Einstellungen werden aus Umgebungsvariablen gelesen (z. B. aus der
 * docker-compose.yml). So muss für eine Anpassung kein Code geändert werden.
 * Neue Einstellungen werden ausschliesslich hier ergänzt und von den anderen
 * Modulen über `require('./config')` gelesen.
 */

'use strict';

const path = require('node:path');

/**
 * Liest eine Ganzzahl aus einer Umgebungsvariable.
 *
 * @param {string} name      Name der Umgebungsvariable.
 * @param {number} fallback  Wert, falls die Variable fehlt oder ungültig ist.
 * @returns {number} Die gelesene Zahl oder der Fallback.
 */
function readInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Unveränderliches Konfigurationsobjekt.
 *
 * @type {Readonly<{
 *   port: number,
 *   dataDir: string,
 *   dbFile: string,
 *   adminPin: string,
 *   appTitle: string,
 *   maxNameLength: number,
 *   maxPointsPerBooking: number,
 *   heartbeatMs: number
 * }>}
 */
const config = Object.freeze({
  /** Port, auf dem der Server im Container lauscht. */
  port: readInt('PORT', 3000),

  /** Ordner für persistente Daten (wird in Docker als Volume eingebunden). */
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),

  /** Dateiname der SQLite-Datenbank innerhalb von `dataDir`. */
  dbFile: process.env.DB_FILE || 'rangliste.db',

  /**
   * PIN zum Schutz der Erfassung (alle schreibenden Aktionen).
   * Leer lassen, um den Schutz zu deaktivieren.
   */
  adminPin: (process.env.ADMIN_PIN || '').trim(),

  /** Titel, der auf beiden Seiten angezeigt wird. */
  appTitle: process.env.APP_TITLE || 'Rangliste',

  /** Maximale Länge eines Gruppennamens. */
  maxNameLength: readInt('MAX_NAME_LENGTH', 40),

  /** Maximaler Betrag (positiv oder negativ) pro Punktebuchung. */
  maxPointsPerBooking: readInt('MAX_POINTS_PER_BOOKING', 1000),

  /** Intervall in ms, in dem ein "Lebenszeichen" an Live-Verbindungen gesendet wird. */
  heartbeatMs: readInt('HEARTBEAT_MS', 25000),
});

module.exports = config;
