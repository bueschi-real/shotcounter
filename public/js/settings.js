/**
 * @file Einstellungen der Benutzeroberfläche.
 *
 * Werte, die man häufig anpassen möchte, stehen hier gesammelt, damit dafür
 * keine Logik-Dateien geändert werden müssen.
 */

/** Einstellungen für die Erfassungsseite (Tablet). */
export const ERFASSUNG = Object.freeze({
  /** Schnellbuttons pro Gruppe. Negative Werte sind ebenfalls möglich, z. B. -1. */
  quickPoints: [1, 5, 10],

  /** Vorgeschlagene Werte im Punkte-Dialog (Ziffernblock). */
  dialogPresets: [], //[-5, -1, 1, 5, 10, 20],

  /** Standard-Sortierung der Karten: 'name' | 'score' | 'newest'. */
  defaultSort: 'name',
  
  /**
   * Quickbuttons standardmässig anzeigen? Kann pro Gerät im Menü umgeschaltet
   * werden, die Wahl wird im Browser gespeichert.
   */
  showQuickButtons: true,

  /** Anzeigedauer der Rückmeldungen unten am Bildschirm (ms). */
  toastDurationMs: 4000,

  /** Anzeigedauer der Meldung nach einer Punktebuchung, mit "Rückgängig" (ms). */
  bookingToastDurationMs: 4000,
});

/** Einstellungen für die Ranglisten-Anzeige (Bildschirm). */
export const RANGLISTE = Object.freeze({
  /** Wie lange eine geänderte Zeile hervorgehoben wird (ms). */
  highlightMs: 4000,

  /** Dauer der Verschiebe-Animation, wenn sich Ränge ändern (ms). */
  moveAnimationMs: 700,

  /** Minimale Zeilenhöhe in px. Passen nicht alle Zeilen hin, wird auf mehrere Spalten verteilt. */
  minRowHeightPx: 64,

  /**
   * Mindestanzahl Zeilen pro Spalte. Bei wenigen Gruppen werden die Zeilen
   * dadurch nicht übermässig hoch.
   */
  minRows: 10,

  /** Maximale Anzahl Spalten. */
  maxColumns: 3,

  /** Anzahl Plätze mit Medaillen-Farbe (Gold, Silber, Bronze). */
  podiumPlaces: 3,
});

/** Schlüssel für Werte, die im Browser gespeichert werden (localStorage). */
export const STORAGE_KEYS = Object.freeze({
  /** Gespeicherte PIN, nur bei PIN_MODE=all verwendet. */
  pin: 'rangliste.pin',
  sort: 'rangliste.sort',
  quickButtons: 'rangliste.quickButtons',
});
