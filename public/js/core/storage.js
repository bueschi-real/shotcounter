/**
 * @file Sicherer Zugriff auf den Browser-Speicher (localStorage).
 *
 * localStorage kann im privaten Modus oder bei blockierten Website-Daten
 * fehlen bzw. Fehler werfen. Diese Funktionen fangen das ab, damit die Seite
 * trotzdem funktioniert (dann ohne gespeicherte Werte).
 */

/**
 * Liest einen Wert.
 *
 * @param {string} key
 * @param {string|null} [fallback=null] Rückgabewert, falls nichts gespeichert ist.
 * @returns {string|null}
 */
export function readValue(key, fallback = null) {
  try {
    const value = window.localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Speichert einen Wert.
 *
 * @param {string} key
 * @param {string} value
 * @returns {void}
 */
export function writeValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Speicher nicht verfügbar: Wert gilt nur bis zum Neuladen. */
  }
}

/**
 * Entfernt einen Wert.
 *
 * @param {string} key
 * @returns {void}
 */
export function removeValue(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignorieren */
  }
}
