/**
 * @file Live-Updates per Server-Sent Events (SSE).
 *
 * Funktionsweise:
 *  1. Ein Browser öffnet `GET /api/events` und hält die Verbindung offen.
 *  2. Sofort nach dem Verbinden erhält er den aktuellen Stand ("snapshot").
 *  3. Bei jeder Änderung (Ereignis aus dem Ereignis-Bus) wird allen
 *     verbundenen Browsern der neue Stand geschickt.
 *  4. Regelmässige Lebenszeichen ("heartbeat") verhindern, dass Router oder
 *     Proxies die ruhende Verbindung trennen.
 *
 * Bricht die Verbindung ab (WLAN, Neustart des NAS), verbindet sich der
 * Browser automatisch neu und erhält wieder den vollständigen Stand.
 *
 * Es wird immer der GESAMTE Stand verschickt, nicht nur die Änderung. Bei
 * einer Rangliste mit einigen Dutzend Gruppen ist das wenig Datenmenge und
 * macht das Frontend sehr robust (kein "verpasstes" Update möglich).
 */

'use strict';

const { EVENTS } = require('../services/eventBus');

/**
 * Erstellt den SSE-Verteiler.
 *
 * @param {object} deps
 * @param {import('node:events').EventEmitter} deps.eventBus  Ereignis-Bus.
 * @param {() => object} deps.getSnapshot  Liefert den aktuellen Stand.
 * @param {number} deps.heartbeatMs        Intervall für Lebenszeichen.
 */
function createSseHub({ eventBus, getSnapshot, heartbeatMs }) {
  /** @type {Set<import('express').Response>} Alle offenen Verbindungen. */
  const clients = new Set();

  /**
   * Schreibt ein Ereignis im SSE-Format in eine Verbindung.
   *
   * @param {import('express').Response} res Offene Verbindung.
   * @param {string} event Ereignisname (im Browser per addEventListener abfragbar).
   * @param {unknown} data Beliebige JSON-fähige Daten.
   * @returns {void}
   */
  function send(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Schickt den aktuellen Stand an alle verbundenen Browser.
   * @returns {void}
   */
  function broadcastSnapshot() {
    if (clients.size === 0) return;
    const snapshot = getSnapshot();
    for (const res of clients) send(res, 'snapshot', snapshot);
  }

  // Bei jeder fachlichen Änderung allen Clients den neuen Stand schicken.
  eventBus.on(EVENTS.RANKING_CHANGED, broadcastSnapshot);

  // Lebenszeichen: Kommentarzeilen (beginnen mit ":") werden vom Browser ignoriert.
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, heartbeatMs);
  heartbeat.unref(); // Hält den Prozess beim Beenden nicht künstlich am Leben.

  return {
    /**
     * Express-Handler für `GET /api/events`.
     * Registriert die Verbindung und schickt sofort den aktuellen Stand.
     *
     * @param {import('express').Request} req
     * @param {import('express').Response} res
     * @returns {void}
     */
    handleConnection(req, res) {
      res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Pufferung in vorgeschalteten Proxies vermeiden
      });
      res.flushHeaders();

      // Wartezeit in ms, nach der der Browser bei Abbruch neu verbindet.
      res.write('retry: 3000\n\n');
      send(res, 'snapshot', getSnapshot());

      clients.add(res);
      req.on('close', () => clients.delete(res));
    },

    /**
     * Anzahl aktuell verbundener Browser (für Statusanzeige / Health-Check).
     * @returns {number}
     */
    clientCount() {
      return clients.size;
    },

    /**
     * Schliesst alle Verbindungen und stoppt den Heartbeat (beim Herunterfahren).
     * @returns {void}
     */
    close() {
      clearInterval(heartbeat);
      eventBus.off(EVENTS.RANKING_CHANGED, broadcastSnapshot);
      for (const res of clients) res.end();
      clients.clear();
    },
  };
}

module.exports = { createSseHub };
