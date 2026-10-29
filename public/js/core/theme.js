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
 *
 * Fernsteuerung der Rangliste: Die Erfassung kann das Design der Rangliste
 * umschalten, ohne ihr eigenes Design zu ändern (`sendThemeToRanking()`).
 * Die Rangliste meldet ihr aktuelles Design, damit die Erfassung im Menü den
 * passenden Text anzeigen kann (`watchRankingTheme()`). Das funktioniert für
 * Tabs IM SELBEN BROWSER (Technik: BroadcastChannel, ohne Server).
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
 * Kanal für Nachrichten zwischen Tabs desselben Browsers.
 * `null`, falls der Browser BroadcastChannel nicht unterstützt.
 * @type {BroadcastChannel|null}
 */
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('rangliste-theme') : null;

/** Nachrichtentypen auf dem Kanal. */
const MESSAGES = Object.freeze({
  /** Erfassung → Rangliste: "Welches Design hast du?" */
  QUERY_RANKING_THEME: 'query-ranking-theme',
  /** Erfassung → Rangliste: Design umschalten. Daten: `{ theme }` */
  SET_RANKING_THEME: 'set-ranking-theme',
  /** Rangliste → alle: aktuelles Design der Rangliste. Daten: `{ theme }` */
  RANKING_THEME: 'ranking-theme',
});

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


/**
 * Für die Rangliste: meldet das eigene Design an andere Tabs und reagiert auf
 * Umschalt-Befehle aus der Erfassung. Einmal beim Start der Ranglisten-Seite
 * aufrufen. Der URL-Parameter wird mit angepasst, damit das Design auch nach
 * dem Neuladen erhalten bleibt.
 *
 * @returns {void}
 */
export function listenForRankingTheme() {
  if (!channel) return;
  const announce = () => channel.postMessage({ type: MESSAGES.RANKING_THEME, theme: getTheme() });

  channel.addEventListener('message', (event) => {
    const { type, theme } = event.data ?? {};
    if (type === MESSAGES.SET_RANKING_THEME && THEMES.includes(theme)) {
      setTheme(theme);
      announce();
    } else if (type === MESSAGES.QUERY_RANKING_THEME) {
      announce();
    }
  });

  announce(); // Erfassung über das Design beim Start informieren
}

/**
 * Für die Erfassung: verfolgt das aktuelle Design der Rangliste.
 * Fragt beim Aufruf einmal nach und ruft danach bei jeder Meldung einer
 * Rangliste `onChange` auf.
 *
 * @param {(theme: 'dark'|'light') => void} onChange
 * @returns {void}
 */
export function watchRankingTheme(onChange) {
  if (!channel) return;
  channel.addEventListener('message', (event) => {
    const { type, theme } = event.data ?? {};
    if (type === MESSAGES.RANKING_THEME && THEMES.includes(theme)) onChange(theme);
  });
  channel.postMessage({ type: MESSAGES.QUERY_RANKING_THEME });
}

/**
 * Für die Erfassung: schaltet das Design aller offenen Ranglisten-Tabs in
 * diesem Browser um. Das eigene Design bleibt unverändert.
 *
 * @param {'dark'|'light'} theme Gewünschtes Design der Rangliste.
 * @param {object} [options]
 * @param {number} [options.waitMs=500] Wie lange auf Bestätigungen gewartet wird.
 * @returns {Promise<number>} Anzahl Ranglisten-Tabs, die umgeschaltet haben
 *          (0 = keine Rangliste in diesem Browser offen).
 */
export function sendThemeToRanking(theme, { waitMs = 500 } = {}) {
  if (!channel || !THEMES.includes(theme)) return Promise.resolve(0);

  return new Promise((resolve) => {
    let confirmed = 0;
    const onMessage = (event) => {
      if (event.data?.type === MESSAGES.RANKING_THEME && event.data.theme === theme) confirmed++;
    };
    channel.addEventListener('message', onMessage);
    channel.postMessage({ type: MESSAGES.SET_RANKING_THEME, theme });

    setTimeout(() => {
      channel.removeEventListener('message', onMessage);
      resolve(confirmed);
    }, waitMs);
  });
}