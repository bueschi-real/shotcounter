/**
 * @file Lesen und Ändern von URL-Parametern (z. B. ?theme=light).
 *
 * Wird verwendet, wenn eine Einstellung im Menü geändert wird und danach in
 * der Adresszeile stehen soll. So bleibt sie beim Neuladen der Seite und in
 * Lesezeichen erhalten.
 */

/**
 * Liest einen URL-Parameter der aktuellen Adresse.
 *
 * @param {string} name Name des Parameters, z. B. "theme".
 * @returns {string|null} Wert oder `null`, wenn der Parameter fehlt.
 */
export function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Setzt oder entfernt einen URL-Parameter, OHNE die Seite neu zu laden.
 * Andere Parameter in der Adresse bleiben erhalten.
 *
 * @example
 *   setUrlParam('theme', 'light');  // → /?theme=light
 *   setUrlParam('theme', null);     // → /
 *
 * @param {string} name Name des Parameters.
 * @param {string|null} value Neuer Wert. `null` oder `''` entfernt den Parameter.
 * @returns {void}
 */
export function setUrlParam(name, value) {
  const url = new URL(window.location.href);
  if (value === null || value === '') url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  // replaceState: ändert die Adresse ohne Neuladen und ohne neuen Eintrag im
  // Browser-Verlauf ("Zurück" führt also nicht durch jede Umschaltung).
  window.history.replaceState(null, '', url);
}