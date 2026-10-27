/**
 * @file Ranglisten-Darstellung für den Anzeigebildschirm.
 *
 * Funktionen:
 *  - Zeilen werden pro Gruppe wiederverwendet (keine flackernde Neuzeichnung).
 *  - Rangänderungen werden mit einer Verschiebe-Animation gezeigt
 *    ("FLIP"-Technik: alte Position merken → neu anordnen → hinüber animieren).
 *  - Die zuletzt geänderte Gruppe wird hervorgehoben, mit "+5"-Anzeige.
 *    Weitere Buchungen derselben Gruppe, solange die Anzeige noch sichtbar
 *    ist, werden aufsummiert (z. B. +5 und +1 ergibt "+6").
 *  - Passen nicht alle Zeilen auf den Bildschirm, wird auf mehrere Spalten verteilt.
 */

import { el, restartAnimation, playAnimationOnce } from '../core/dom.js';
import { formatPoints, formatSigned } from '../core/format.js';

/**
 * Erstellt die Rangliste in einem Container-Element.
 *
 * @param {HTMLElement} container Element, in das die Liste gezeichnet wird.
 * @param {object} options
 * @param {number} options.highlightMs      Dauer der Hervorhebung.
 * @param {number} options.moveAnimationMs  Dauer der Verschiebe-Animation.
 * @param {number} options.minRowHeightPx   Minimale Zeilenhöhe.
 * @param {number} options.minRows          Mindestanzahl Zeilen pro Spalte.
 * @param {number} options.maxColumns       Maximale Spaltenzahl.
 * @param {number} options.podiumPlaces     Anzahl hervorgehobener Plätze.
 * @param {number} [options.limit]          Nur die ersten N Gruppen anzeigen.
 * @returns {{ render: (groups: object[], lastChange: object|null) => void }}
 */
export function createRankingBoard(container, options) {
  const list = el('ol', { class: 'board', 'aria-live': 'polite' });
  const emptyState = el('p', { class: 'board__empty' }, 'Noch keine Gruppen erfasst.');
  container.append(list, emptyState);

  /** @type {Map<number, {row: HTMLElement, rank: HTMLElement, name: HTMLElement, score: HTMLElement, delta: HTMLElement, score_: number, deltaSum: number}>} */
  const rows = new Map();

  /** Zeitpunkt der zuletzt hervorgehobenen Änderung (verhindert doppeltes Hervorheben). */
  let lastHighlightedAt = null;

  /** Beim ersten Zeichnen wird nichts hervorgehoben. */
  let isFirstRender = true;

  /** Aktuell hervorgehobene Zeile. Es ist immer höchstens eine hervorgehoben. */
  let highlightedEntry = null;

  /**
   * Erstellt eine neue Zeile für eine Gruppe.
   * @param {number} id
   */
  function createRow(id) {
    const rank = el('span', { class: 'row__rank' });
    const name = el('span', { class: 'row__name' });
    const score = el('span', { class: 'row__score' });
    const delta = el('span', { class: 'row__delta', 'aria-hidden': 'true' });
    const row = el('li', { class: 'row', dataset: { id } }, rank, name, delta, score);
    const entry = { row, rank, name, score, delta, score_: null, deltaSum: 0 };
    rows.set(id, entry);
    return entry;
  }

  /**
   * Verteilt die Zeilen auf Spalten, abhängig von Bildschirmhöhe und Anzahl.
   * @param {number} count Anzahl angezeigter Zeilen.
   */
  function updateLayout(count) {
    const available = list.clientHeight || window.innerHeight;
    const rowsFit = Math.max(1, Math.floor(available / options.minRowHeightPx));
    const columns = Math.min(options.maxColumns, Math.max(1, Math.ceil(count / rowsFit)));
    const rowsPerColumn = Math.max(options.minRows, Math.ceil(count / columns));
    list.style.setProperty('--columns', String(columns));
    list.style.setProperty('--rows', String(rowsPerColumn));

    // Schriftgrösse an die Zeilenhöhe anpassen (bei vielen Gruppen kleiner)
    const rowHeight = available / rowsPerColumn;
    list.style.setProperty('--row-font', `${Math.round(Math.min(56, Math.max(14, rowHeight * 0.42)))}px`);
  }

  /**
   * Entfernt die Hervorhebung einer Zeile (Rahmen und "+5"-Anzeige) und setzt
   * die aufsummierten Punkte zurück.
   * @param {object} entry Zeilen-Objekt.
   */
  function clearHighlight(entry) {
    clearTimeout(entry.timer);
    entry.row.classList.remove('is-highlighted');
    entry.delta.classList.remove('is-visible');
    entry.deltaSum = 0;
    if (highlightedEntry === entry) highlightedEntry = null;
  }

  /**
   * Hebt eine Zeile hervor und zeigt die Punkteänderung an.
   * Eine vorher hervorgehobene andere Zeile wird dabei sofort zurückgesetzt,
   * damit immer nur die zuletzt geänderte Gruppe hervorgehoben ist.
   *
   * Summierung: Ist die Punkteanzeige dieser Gruppe noch sichtbar (letzte
   * Änderung liegt weniger als `highlightMs` zurück), werden die neuen Punkte
   * dazugezählt und die Anzeigedauer beginnt von vorne. Ist die Anzeige
   * bereits verschwunden oder wurde zwischendurch eine andere Gruppe geändert,
   * beginnt die Zählung neu.
   *
   * @param {object} entry Zeilen-Objekt.
   * @param {number|undefined} points Geänderte Punkte.
   */
  function highlight(entry, points) {
    if (highlightedEntry && highlightedEntry !== entry) clearHighlight(highlightedEntry);
    highlightedEntry = entry;

    restartAnimation(entry.row, 'is-highlighted');
    if (typeof points === 'number') {
      const isStillVisible = entry.delta.classList.contains('is-visible');
      entry.deltaSum = isStillVisible ? entry.deltaSum + points : points;
      entry.delta.textContent = formatSigned(entry.deltaSum);
      entry.delta.classList.toggle('is-negative', entry.deltaSum < 0);
      restartAnimation(entry.delta, 'is-visible');
    }
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => clearHighlight(entry), options.highlightMs);
  }

  /**
   * Zeichnet die Rangliste neu.
   *
   * @param {object[]} groups Bereits sortierte Gruppen mit `rank`.
   * @param {object|null} lastChange Letzte Änderung aus dem Snapshot.
   * @returns {void}
   */
  function render(groups, lastChange) {
    const visible = options.limit ? groups.slice(0, options.limit) : groups;
    emptyState.hidden = visible.length > 0;

    // 1. FIRST: Alte Positionen merken
    const before = new Map();
    for (const [id, entry] of rows) before.set(id, entry.row.getBoundingClientRect());

    // 2. Zeilen anlegen/aktualisieren und in neue Reihenfolge bringen
    const visibleIds = new Set();
    visible.forEach((group, index) => {
      visibleIds.add(group.id);
      const entry = rows.get(group.id) ?? createRow(group.id);
      entry.rank.textContent = String(group.rank);
      entry.name.textContent = group.name;
      entry.score.textContent = formatPoints(group.score);
      entry.row.dataset.podium = group.rank <= options.podiumPlaces ? String(group.rank) : '';
      if (entry.score_ !== null && entry.score_ !== group.score) playAnimationOnce(entry.score, 'is-bumped');
      entry.score_ = group.score;

      // Nur verschieben, wenn die Zeile nicht schon an der richtigen Stelle
      // steht. Wichtig: Jedes Verschieben im DOM startet laufende
      // CSS-Animationen der Zeile neu. Würden immer alle Zeilen neu
      // eingehängt, würden alte Hervorhebungen erneut aufblinken.
      if (list.children[index] !== entry.row) {
        list.insertBefore(entry.row, list.children[index] ?? null);
      }
    });

    // Nicht mehr vorhandene Gruppen entfernen
    for (const [id, entry] of rows) {
      if (!visibleIds.has(id)) {
        if (highlightedEntry === entry) clearHighlight(entry);
        entry.row.remove();
        rows.delete(id);
      }
    }

    updateLayout(visible.length);

    // 3. LAST + INVERT + PLAY: Von alter zu neuer Position animieren
    for (const [id, entry] of rows) {
      const old = before.get(id);
      if (!old) {
        entry.row.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], {
          duration: options.moveAnimationMs,
          easing: 'ease-out',
        });
        continue;
      }
      const now = entry.row.getBoundingClientRect();
      const dx = old.left - now.left;
      const dy = old.top - now.top;
      if (dx || dy) {
        entry.row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: options.moveAnimationMs,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    }

    // 4. Letzte Änderung hervorheben (nur einmal pro Änderung; beim ersten
    //    Laden der Seite nicht, sonst würde eine alte Änderung aufblinken)
    if (isFirstRender) {
      isFirstRender = false;
      lastHighlightedAt = lastChange?.at ?? null;
    } else if (lastChange?.groupId && lastChange.at !== lastHighlightedAt && rows.has(lastChange.groupId)) {
      lastHighlightedAt = lastChange.at;
      highlight(rows.get(lastChange.groupId), lastChange.points);
    }
  }

  // Bei Grössenänderung des Fensters Spalten neu berechnen.
  window.addEventListener('resize', () => updateLayout(rows.size));

  return { render };
}