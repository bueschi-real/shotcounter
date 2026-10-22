/**
 * @file Interner Ereignis-Bus.
 *
 * Entkoppelt die Fachlogik (Services) von der Auslieferung der Live-Updates.
 * Der Service meldet nur "es hat sich etwas geändert". Wer darauf reagiert
 * (heute: Server-Sent Events, später evtl. Logging, WebSockets, Statistiken),
 * meldet sich einfach mit `eventBus.on(...)` an, ohne den Service anzupassen.
 */

'use strict';

const { EventEmitter } = require('node:events');

/**
 * Namen aller Ereignisse, die über den Bus verschickt werden.
 * Neue Ereignisse hier ergänzen, damit sie an einer Stelle dokumentiert sind.
 *
 * @readonly
 * @enum {string}
 */
const EVENTS = Object.freeze({
  /**
   * Die Rangliste hat sich geändert.
   * Payload: `{ action: string, groupId?: number, points?: number }`
   */
  RANKING_CHANGED: 'ranking:changed',
});

/**
 * Erstellt einen neuen Ereignis-Bus.
 * Pro Anwendung wird genau einer erzeugt (in `src/app.js`).
 *
 * @returns {EventEmitter}
 */
function createEventBus() {
  const bus = new EventEmitter();
  // Viele gleichzeitige Bildschirme/Tablets sind erlaubt.
  bus.setMaxListeners(0);
  return bus;
}

module.exports = { createEventBus, EVENTS };
