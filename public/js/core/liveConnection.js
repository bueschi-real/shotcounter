/**
 * @file Live-Verbindung zum Server (Server-Sent Events).
 *
 * Kapselt `EventSource` und ergänzt eine robuste Wiederverbindung: Der Browser
 * verbindet sich zwar selbst neu, gibt aber bei manchen Fehlern (z. B. wenn
 * das NAS neu startet und kurz eine Fehlerseite liefert) endgültig auf. Dann
 * baut dieses Modul die Verbindung nach einer Wartezeit selbst wieder auf.
 * So läuft die Ranglisten-Anzeige auch über Tage ohne Eingriff.
 */

/**
 * @typedef {'connecting'|'online'|'offline'} ConnectionStatus
 */

/**
 * Baut eine Live-Verbindung auf.
 *
 * @param {object} handlers
 * @param {(snapshot: object) => void} handlers.onSnapshot
 *        Wird bei jedem neuen Stand aufgerufen (auch direkt nach dem Verbinden).
 * @param {(status: ConnectionStatus) => void} [handlers.onStatus]
 *        Wird aufgerufen, wenn sich der Verbindungsstatus ändert.
 * @param {object} [options]
 * @param {string} [options.url='/api/events']
 * @param {number} [options.retryMs=5000] Wartezeit für die eigene Wiederverbindung.
 * @returns {{ close: () => void }} Objekt zum Schliessen der Verbindung.
 */
export function connectLive({ onSnapshot, onStatus = () => {} }, { url = '/api/events', retryMs = 5000 } = {}) {
  /** @type {EventSource|null} */
  let source = null;
  let retryTimer = null;
  let closed = false;

  /** Öffnet eine neue EventSource-Verbindung. */
  function open() {
    if (closed) return;
    onStatus('connecting');
    source = new EventSource(url);

    source.addEventListener('open', () => onStatus('online'));

    source.addEventListener('snapshot', (event) => {
      try {
        onSnapshot(JSON.parse(event.data));
      } catch (err) {
        console.error('Ungültige Daten vom Server', err);
      }
    });

    source.addEventListener('error', () => {
      onStatus('offline');
      // CLOSED = Browser versucht es nicht mehr selbst -> eigener Neuversuch.
      if (source.readyState === EventSource.CLOSED) scheduleReconnect();
    });
  }

  /** Plant einen Neuaufbau der Verbindung. */
  function scheduleReconnect() {
    source?.close();
    clearTimeout(retryTimer);
    retryTimer = setTimeout(open, retryMs);
  }

  // Wird ein Tablet aus dem Standby geholt, sofort neu verbinden.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && source?.readyState === EventSource.CLOSED) open();
  });

  open();

  return {
    /** Beendet die Verbindung dauerhaft. */
    close() {
      closed = true;
      clearTimeout(retryTimer);
      source?.close();
    },
  };
}
