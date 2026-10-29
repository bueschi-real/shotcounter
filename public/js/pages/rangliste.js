/**
 * @file Seiten-Controller für die Ranglisten-Anzeige (Bildschirm).
 *
 * Diese Seite braucht keinerlei Bedienung: Sie verbindet sich selbst mit dem
 * Server, aktualisiert sich bei jeder Änderung und verbindet sich nach
 * Unterbrüchen automatisch neu.
 *
 * Optionen per URL-Parameter (z. B. /rangliste?top=10&theme=light):
 *   top=N          Nur die ersten N Gruppen anzeigen.
 *   theme=light    Helles Design statt dunkel.
 *   clock=0        Uhr ausblenden.
 *   title=Text     Überschrift überschreiben.
 */

import { api } from '../core/api.js';
import { connectLive } from '../core/liveConnection.js';
import { applyTheme, readThemeFromUrl, listenForRankingTheme } from '../core/theme.js';
import { $ } from '../core/dom.js';
import { RANGLISTE } from '../settings.js';
import { createRankingBoard } from '../components/rankingBoard.js';

/**
 * Liest die Optionen aus der URL.
 * @returns {{ top: number|undefined, theme: string, showClock: boolean, title: string|null }}
 */
function readUrlOptions() {
  const params = new URLSearchParams(window.location.search);
  const top = Number.parseInt(params.get('top') ?? '', 10);
  return {
    top: Number.isInteger(top) && top > 0 ? top : undefined,
    theme: readThemeFromUrl(params),
    showClock: params.get('clock') !== '0',
    title: params.get('title'),
  };
}

/**
 * Zeigt die aktuelle Uhrzeit an und aktualisiert sie jede Sekunde.
 * @param {HTMLElement} target
 * @returns {void}
 */
function startClock(target) {
  const format = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
  const tick = () => {
    target.textContent = format.format(new Date());
  };
  tick();
  setInterval(tick, 1000);
}

/**
 * Blendet den Mauszeiger aus, wenn er einige Sekunden nicht bewegt wird
 * (angenehmer auf einem Anzeigebildschirm).
 * @param {number} [idleMs=3000]
 * @returns {void}
 */
function autoHideCursor(idleMs = 3000) {
  let timer;
  const show = () => {
    document.body.classList.remove('hide-cursor');
    clearTimeout(timer);
    timer = setTimeout(() => document.body.classList.add('hide-cursor'), idleMs);
  };
  window.addEventListener('mousemove', show);
  show();
}

/**
 * Initialisiert die Anzeige.
 * @returns {Promise<void>}
 */
async function init() {
  const options = readUrlOptions();
  applyTheme(options.theme);
  
    // Design-Wechsel aus der Erfassung (Tab im selben Browser) übernehmen
  listenForRankingTheme();

  const config = await api.getConfig().catch(() => ({ appTitle: 'Rangliste' }));
  const title = options.title ?? config.appTitle;
  $('#app-title').textContent = title;
  document.title = title;

  const clock = $('#clock');
  if (options.showClock) startClock(clock);
  else clock.hidden = true;

  //const badge = createConnectionBadge();
  //$('#conn').replaceWith(badge.element);

  const board = createRankingBoard($('#board'), { ...RANGLISTE, limit: options.top });

  connectLive({
    onSnapshot: (snapshot) => board.render(snapshot.groups, snapshot.lastChange),
    //onStatus: badge.setStatus,
  });

  autoHideCursor();
}

init();
