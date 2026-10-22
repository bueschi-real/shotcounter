/**
 * @file Formatierung von Zahlen und Texten für die Anzeige.
 */

/** Zahlenformat nach Schweizer Schreibweise (Tausendertrennzeichen ’). */
const numberFormat = new Intl.NumberFormat('de-CH');

/**
 * Formatiert eine Punktzahl, z. B. 12500 → "12’500".
 *
 * @param {number} points
 * @returns {string}
 */
export function formatPoints(points) {
  return numberFormat.format(points);
}

/**
 * Formatiert eine Punktzahl immer mit Vorzeichen, z. B. 5 → "+5", -3 → "−3".
 *
 * @param {number} points
 * @returns {string}
 */
export function formatSigned(points) {
  const sign = points > 0 ? '+' : points < 0 ? '−' : '±';
  return `${sign}${numberFormat.format(Math.abs(points))}`;
}

/**
 * Liefert "Shot" oder "Shots" passend zur Zahl.
 *
 * @param {number} points
 * @returns {string}
 */
export function pointsLabel(points) {
  return Math.abs(points) === 1 ? 'Shot' : 'Shots';
}
