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

/** Erlaubte Werte für PIN_MODE. */
const PIN_MODES = ['critical', 'all'];

/**
 * Liest den PIN-Modus aus der Umgebungsvariable `PIN_MODE`.
 * Ungültige Werte werden mit einer Warnung durch den Standard ersetzt.
 *
 * @returns {'critical'|'all'}
 */
function readPinMode() {
  const value = (process.env.PIN_MODE || 'critical').trim().toLowerCase();
  if (PIN_MODES.includes(value)) return value;
  console.warn(`[config] Ungültiger PIN_MODE "${process.env.PIN_MODE}", verwende "critical".`);
  return 'critical';
}

/**
 * Unveränderliches Konfigurationsobjekt.
 *
 * @type {Readonly<{
 *   port: number,
 *   dataDir: string,
 *   dbFile: string,
 *   adminPin: string,
 *   pinMode: 'critical'|'all',
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
   * Admin-PIN. Leer lassen, um den PIN-Schutz komplett zu deaktivieren.
   * Wofür die PIN verlangt wird, bestimmt `pinMode`.
   */
  adminPin: (process.env.ADMIN_PIN || '').trim(),

  /**
   * Wann die PIN verlangt wird (Umgebungsvariable `PIN_MODE`):
   *  - 'critical' (Standard): Nur bei kritischen Aktionen (z. B. "Alle Gruppen
   *    löschen"), dort aber jedes Mal neu. Die normale Erfassung geht ohne PIN.
   *  - 'all': Zusätzlich beim Start der Erfassung. Alle schreibenden Aktionen
   *    sind geschützt, das Tablet merkt sich die PIN (frühere Funktion).
   *    Kritische Aktionen fragen die PIN trotzdem jedes Mal neu ab.
   */
  pinMode: readPinMode(),

  /** Titel, der auf beiden Seiten angezeigt wird. */
  appTitle: process.env.APP_TITLE || 'Sprützerball Shotcounter',

  /** Maximale Länge eines Gruppennamens. */
  maxNameLength: readInt('MAX_NAME_LENGTH', 40),

  /** Maximaler Betrag (positiv oder negativ) pro Punktebuchung. */
  maxPointsPerBooking: readInt('MAX_POINTS_PER_BOOKING', 1000),

  /** Intervall in ms, in dem ein "Lebenszeichen" an Live-Verbindungen gesendet wird. */
  heartbeatMs: readInt('HEARTBEAT_MS', 25000),
});

module.exports = config;
