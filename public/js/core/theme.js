/**
 * @file Hell/Dunkel-Design per URL-Parameter.
 *
 * Wird von allen Seiten verwendet (Erfassung und Rangliste), damit das Design
 * überall gleich gesteuert wird:
 *
 *   /?theme=light            Erfassung hell
 *   /rangliste?theme=light   Rangliste hell
 *   ohne Parameter           dunkel (Standard)
 *
 * Umgesetzt über das Attribut `data-theme` am <html>-Element. Die Farben
 * selbst stehen in public/css/base.css (Abschnitt "Design-Tokens").
 *
 * Über `setTheme()` kann das Design auch zur Laufzeit gewechselt werden (z. B.
 * im Menü der Erfassung). Der URL-Parameter wird dabei mitgeführt.
 */

import { setUrlParam } from './url.js';

/** Erlaubte Designs. Der erste Eintrag ist der Standard. */
const THEMES = ['dark', 'light'];

/**
 * Farbe der Browser- bzw. Statusleiste auf Tablets und Handys, passend zur
 * Kopfzeile des jeweiligen Designs (`--color-surface` in base.css).
 */
const THEME_COLORS = {
  dark: '#191f29',
  light: '#ffffff',
};

/**
 * Liest das Design aus dem URL-Parameter `theme`.
 * Unbekannte oder fehlende Werte ergeben den Standard (dunkel).
 *
 * @param {URLSearchParams} [params] Parameter der aktuellen Adresse.
 * @returns {'dark'|'light'}
 */
export function readThemeFromUrl(params = new URLSearchParams(window.location.search)) {
  const value = (params.get('theme') ?? '').toLowerCase();
  return THEMES.includes(value) ? value : THEMES[0];
}

/**
 * Aktiviert ein Design: setzt `data-theme` am <html>-Element und passt die
 * Farbe der Browserleiste an.
 *
 * @param {'dark'|'light'} theme
 * @returns {void}
 */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}


/**
 * Liefert das aktuell aktive Design.
 * @returns {'dark'|'light'}
 */
export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/**
 * Wechselt das Design zur Laufzeit und schreibt es in die Adresszeile.
 * Beim Standard-Design (dunkel) wird der Parameter entfernt, damit die
 * Adresse kurz bleibt.
 *
 * @param {'dark'|'light'} theme
 * @returns {void}
 */
export function setTheme(theme) {
  applyTheme(theme);
  setUrlParam('theme', theme === THEMES[0] ? null : theme);
}